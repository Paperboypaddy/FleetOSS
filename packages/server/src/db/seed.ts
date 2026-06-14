import { getPool } from './connection.js';
import { config } from '../config/index.js';

async function seed() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    // Create a demo device
    const device = await client.query(`
      INSERT INTO devices (name, unique_id, plate, status) 
      VALUES ('T1N Sprinter', 't1n-sprinter-001', 'ABC-1234', 'online')
      RETURNING id
    `);
    const deviceId = device.rows[0].id;

    // Insert some sample positions along a route
    const positions = [
      [47.7193, -116.9454, 0, 0],
      [47.7211, -117.0000, 34, 90],
      [47.7100, -117.0800, 42, 120],
      [47.6900, -117.1800, 55, 180],
      [47.6730, -117.2200, 45, 200],
      [47.6680, -117.1900, 38, 250],
      [47.6620, -117.1400, 30, 300],
      [47.6570, -117.0900, 0, 0],
    ];

    const baseTime = new Date('2026-06-12T07:14:00Z');
    for (let i = 0; i < positions.length; i++) {
      const [lat, lng, speed, bearing] = positions[i];
      const ts = new Date(baseTime.getTime() + i * 5 * 60000);
      await client.query(`
        INSERT INTO positions (device_id, latitude, longitude, speed, bearing, protocol, device_timestamp)
        VALUES ($1, $2, $3, $4, $5, 'http-json', $6)
      `, [deviceId, lat, lng, speed, bearing, ts]);
    }

    // Create a trip
    await client.query(`
      INSERT INTO trips (device_id, start_time, end_time, start_lat, start_lng, end_lat, end_lng, distance, duration, avg_speed, max_speed)
      VALUES ($1, '2026-06-12T07:14:00Z', '2026-06-12T07:56:00Z', 47.7193, -116.9454, 47.6570, -117.0900, 28.4, 2520, 40, 67)
    `, [deviceId]);

    console.log('Seed complete');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
