import { pgTable, uuid, text, doublePrecision, boolean, jsonb, timestamp, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const devices = pgTable('devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  uniqueId: text('unique_id').notNull().unique(),
  plate: text('plate'),
  vin: text('vin'),
  status: text('status', { enum: ['online', 'offline', 'unknown'] }).default('unknown').notNull(),
  approved: boolean('approved').default(false).notNull(),
  attributes: jsonb('attributes').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const positions = pgTable('positions', {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  altitude: doublePrecision('altitude'),
  speed: doublePrecision('speed'),
  bearing: doublePrecision('bearing'),
  accuracy: doublePrecision('accuracy'),
  course: doublePrecision('course'),
  ignition: boolean('ignition'),
  engineHours: doublePrecision('engine_hours'),
  odometer: doublePrecision('odometer'),
  fuelLevel: doublePrecision('fuel_level'),
  batteryLevel: doublePrecision('battery_level'),
  rpm: doublePrecision('rpm'),
  fuelConsumption: doublePrecision('fuel_consumption'),
  speedLimit: doublePrecision('speed_limit'),
  valid: boolean('valid').default(true).notNull(),
  protocol: text('protocol').notNull(),
  attributes: jsonb('attributes').default({}).notNull(),
  deviceTimestamp: timestamp('device_timestamp', { withTimezone: true }).notNull(),
  serverTimestamp: timestamp('server_timestamp', { withTimezone: true }).defaultNow().notNull(),
});

// Geospatial index — requires PostGIS extension
export const positionsGeoIndex = sql`CREATE INDEX IF NOT EXISTS idx_positions_geom ON positions USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326))`;

export const trips = pgTable('trips', {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  startPositionId: uuid('start_position_id').references(() => positions.id),
  endPositionId: uuid('end_position_id').references(() => positions.id),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  startLat: doublePrecision('start_lat').notNull(),
  startLng: doublePrecision('start_lng').notNull(),
  endLat: doublePrecision('end_lat').notNull(),
  endLng: doublePrecision('end_lng').notNull(),
  startAddress: text('start_address'),
  endAddress: text('end_address'),
  distance: doublePrecision('distance').default(0).notNull(),
  duration: integer('duration').default(0).notNull(),
  avgSpeed: doublePrecision('avg_speed').default(0),
  maxSpeed: doublePrecision('max_speed').default(0),
  stopDuration: integer('stop_duration').default(0),
  attributes: jsonb('attributes').default({}).notNull(),
});

export const geofences = pgTable('geofences', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ['circle', 'polygon', 'polyline'] }).notNull(),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  radius: doublePrecision('radius'),
  polygon: jsonb('polygon'),
  polyline: jsonb('polyline'),
  attributes: jsonb('attributes').default({}).notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'manager', 'viewer'] }).default('admin').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  positionId: uuid('position_id').references(() => positions.id),
  geofenceId: uuid('geofence_id'),
  attributes: jsonb('attributes').default({}).notNull(),
  time: timestamp('time', { withTimezone: true }).defaultNow().notNull(),
});

export const maintenance = pgTable('maintenance', {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type', { enum: ['oil', 'tires', 'brakes', 'service', 'inspection', 'other'] }).default('other').notNull(),
  intervalDays: integer('interval_days'),
  intervalMeters: integer('interval_meters'),
  lastOdometer: doublePrecision('last_odometer'),
  lastDate: timestamp('last_date', { withTimezone: true }),
  dueOdometer: doublePrecision('due_odometer'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  notes: text('notes'),
  attributes: jsonb('attributes').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const fuelEntries = pgTable('fuel_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  date: timestamp('date', { withTimezone: true }).notNull(),
  odometer: doublePrecision('odometer'),
  gallons: doublePrecision('gallons').notNull(),
  pricePerGallon: doublePrecision('price_per_gallon'),
  mpg: doublePrecision('mpg'),
  station: text('station'),
  notes: text('notes'),
  attributes: jsonb('attributes').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
