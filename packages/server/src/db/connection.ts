import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config/index.js';
import * as schema from './schema.js';

const { Pool } = pg;

let pool: pg.Pool;
let db: ReturnType<typeof drizzle>;

export function getDb() {
  if (!db) {
    pool = new Pool({ connectionString: config.databaseUrl });
    db = drizzle(pool, { schema });
  }
  return db;
}

export function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: config.databaseUrl });
  }
  return pool;
}

export async function closeDb() {
  if (pool) await pool.end();
}
