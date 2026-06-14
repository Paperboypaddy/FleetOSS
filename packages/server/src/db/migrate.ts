import { getPool } from './connection.js';

async function migrate() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
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
        valid BOOLEAN NOT NULL DEFAULT true,
        protocol TEXT NOT NULL,
        attributes JSONB NOT NULL DEFAULT '{}',
        device_timestamp TIMESTAMPTZ NOT NULL,
        server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_positions_device_time ON positions (device_id, device_timestamp DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_positions_geom ON positions USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326))`);

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
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'manager', 'viewer')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
