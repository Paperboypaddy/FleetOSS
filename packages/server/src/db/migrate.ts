import { getPool } from './connection.js';

async function migrate() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
    } catch {
      console.warn('PostGIS extension not available (not installed on this server)');
    }
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await client.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        unique_id TEXT NOT NULL UNIQUE,
        plate TEXT,
        vin TEXT,
        status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('online', 'offline', 'unknown')),
        approved BOOLEAN NOT NULL DEFAULT false,
        attributes JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Add approved column if upgrading from older schema
    await client.query(`
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT false
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS positions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        altitude DOUBLE PRECISION,
        speed DOUBLE PRECISION,
        bearing DOUBLE PRECISION,
        accuracy DOUBLE PRECISION,
        course DOUBLE PRECISION,
        ignition BOOLEAN,
        engine_hours DOUBLE PRECISION,
        odometer DOUBLE PRECISION,
        fuel_level DOUBLE PRECISION,
        battery_level DOUBLE PRECISION,
        rpm DOUBLE PRECISION,
        fuel_consumption DOUBLE PRECISION,
        speed_limit DOUBLE PRECISION,
        valid BOOLEAN NOT NULL DEFAULT true,
        protocol TEXT NOT NULL,
        attributes JSONB NOT NULL DEFAULT '{}',
        device_timestamp TIMESTAMPTZ NOT NULL,
        server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_positions_device_time ON positions (device_id, device_timestamp DESC)`);
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_positions_geom ON positions USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326))`);
    } catch {
      console.warn('PostGIS geospatial index not created (PostGIS not available)');
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        start_position_id UUID REFERENCES positions(id),
        end_position_id UUID REFERENCES positions(id),
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        start_lat DOUBLE PRECISION NOT NULL,
        start_lng DOUBLE PRECISION NOT NULL,
        end_lat DOUBLE PRECISION NOT NULL,
        end_lng DOUBLE PRECISION NOT NULL,
        start_address TEXT,
        end_address TEXT,
        distance DOUBLE PRECISION NOT NULL DEFAULT 0,
        duration INTEGER NOT NULL DEFAULT 0,
        avg_speed DOUBLE PRECISION DEFAULT 0,
        max_speed DOUBLE PRECISION DEFAULT 0,
        stop_duration INTEGER DEFAULT 0,
        attributes JSONB NOT NULL DEFAULT '{}'
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        position_id UUID REFERENCES positions(id),
        geofence_id UUID,
        attributes JSONB NOT NULL DEFAULT '{}',
        time TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS geofences (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('circle', 'polygon', 'polyline')),
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        radius DOUBLE PRECISION,
        polygon JSONB,
        polyline JSONB,
        attributes JSONB NOT NULL DEFAULT '{}'
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT,
        role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'manager', 'viewer')),
        auth_provider TEXT NOT NULL DEFAULT 'local' CHECK (auth_provider IN ('local', 'ldap', 'oidc', 'oauth2', 'saml')),
        auth_provider_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Add columns if upgrading from older schema
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'local'`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider_id TEXT`);
    await client.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS maintenance (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'other' CHECK (type IN ('oil', 'tires', 'brakes', 'service', 'inspection', 'other')),
        interval_days INTEGER,
        interval_meters INTEGER,
        last_odometer DOUBLE PRECISION,
        last_date TIMESTAMPTZ,
        due_odometer DOUBLE PRECISION,
        due_date TIMESTAMPTZ,
        notes TEXT,
        attributes JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS fuel_entries (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        date TIMESTAMPTZ NOT NULL,
        odometer DOUBLE PRECISION,
        gallons DOUBLE PRECISION NOT NULL,
        price_per_gallon DOUBLE PRECISION,
        mpg DOUBLE PRECISION,
        station TEXT,
        notes TEXT,
        attributes JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_providers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        provider_type TEXT NOT NULL CHECK (provider_type IN ('ldap', 'oidc', 'oauth2', 'saml')),
        name TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT false,
        config JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        key_prefix TEXT NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        permissions JSONB NOT NULL DEFAULT '["read"]',
        enabled BOOLEAN NOT NULL DEFAULT true,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS group_devices (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'manage', 'admin'))
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_groups (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE
      )
    `);

    console.log('Migration complete');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
