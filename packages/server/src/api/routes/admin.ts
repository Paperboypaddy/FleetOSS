import type { FastifyInstance } from 'fastify';
import { getPool } from '../../db/connection.js';
import { reverseGeocode } from '../../core/geocode.js';
import { authMiddleware } from '../../auth/index.js';

const MOVING_THRESHOLD = 2;
const STOP_GAP_SECONDS = 300;

export function registerAdminRoutes(app: FastifyInstance) {
  app.post('/api/admin/backfill-trips', { preHandler: authMiddleware }, async (request, reply) => {
    const user = request.user;
    if (user?.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin access required' });
    }

    const pool = getPool();
    const client = await pool.connect();
    let tripsCreated = 0;

    try {
      const devices = await client.query(`
        SELECT DISTINCT p.device_id, d.name, d.unique_id
        FROM positions p
        JOIN devices d ON d.id = p.device_id
        WHERE p.speed > $1
        AND p.device_id NOT IN (SELECT device_id FROM trips)
      `, [MOVING_THRESHOLD]);

      for (const dev of devices.rows) {
        const positions = await client.query(`
          SELECT id, latitude, longitude, speed, device_timestamp
          FROM positions
          WHERE device_id = $1 AND speed > $2
          ORDER BY device_timestamp ASC
        `, [dev.device_id, MOVING_THRESHOLD]);

        if (positions.rows.length < 2) continue;

        let tripStart: any = null;
        let tripPositions: any[] = [];

        for (const pos of positions.rows) {
          if (!tripStart) {
            tripStart = pos;
            tripPositions = [pos];
            continue;
          }

          const prevTs = new Date(tripPositions[tripPositions.length - 1].device_timestamp).getTime();
          const gap = (new Date(pos.device_timestamp).getTime() - prevTs) / 1000;

          if (gap > STOP_GAP_SECONDS) {
            if (tripPositions.length >= 2) {
              await saveTrip(client, dev.device_id, tripPositions);
              tripsCreated++;
            }
            tripStart = pos;
            tripPositions = [pos];
          } else {
            tripPositions.push(pos);
          }
        }

        if (tripStart && tripPositions.length >= 2) {
          await saveTrip(client, dev.device_id, tripPositions);
          tripsCreated++;
        }
      }

      return reply.send({ tripsCreated, status: 'ok' });
    } finally {
      client.release();
    }
  });
}

async function saveTrip(client: any, deviceId: string, tripPositions: any[]) {
  const first = tripPositions[0];
  const last = tripPositions[tripPositions.length - 1];
  let distance = 0;
  let maxSpeed = 0;

  for (let i = 1; i < tripPositions.length; i++) {
    const dlat = (tripPositions[i].latitude - tripPositions[i - 1].latitude) * 69;
    const dlng = (tripPositions[i].longitude - tripPositions[i - 1].longitude) * 69 * Math.cos(tripPositions[i].latitude * Math.PI / 180);
    distance += Math.sqrt(dlat * dlat + dlng * dlng);
    maxSpeed = Math.max(maxSpeed, tripPositions[i].speed || 0);
  }

  const duration = (new Date(last.device_timestamp).getTime() - new Date(first.device_timestamp).getTime()) / 1000;

  if (duration >= 30 && distance > 0.1) {
    const result = await client.query(`
      INSERT INTO trips (device_id, start_position_id, end_position_id, start_time, end_time,
        start_lat, start_lng, end_lat, end_lng, distance, duration, avg_speed, max_speed)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `, [
      deviceId, first.id, last.id,
      first.device_timestamp, last.device_timestamp,
      first.latitude, first.longitude, last.latitude, last.longitude,
      distance, Math.round(duration), distance / (duration / 3600), maxSpeed,
    ]);

    const tripId = result.rows[0]?.id;
    if (tripId) {
      reverseGeocode(first.latitude, first.longitude).then(addr => {
        if (addr) client.query('UPDATE trips SET start_address = $1 WHERE id = $2', [addr, tripId]).catch(() => {});
      }).catch(() => {});
      reverseGeocode(last.latitude, last.longitude).then(addr => {
        if (addr) client.query('UPDATE trips SET end_address = $1 WHERE id = $2', [addr, tripId]).catch(() => {});
      }).catch(() => {});
    }
  }
}
