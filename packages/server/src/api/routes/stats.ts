import type { FastifyInstance } from 'fastify';
import { getPool } from '../../db/connection.js';

export function registerStatsRoutes(app: FastifyInstance) {
  app.get('/api/stats', async (_request, reply) => {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const devices = await client.query('SELECT COUNT(*)::int FROM devices');
      const positions = await client.query('SELECT COUNT(*)::int FROM positions');
      const trips = await client.query('SELECT COUNT(*)::int FROM trips');
      const onlineDevices = await client.query("SELECT COUNT(*)::int FROM devices WHERE status = 'online'");
      const latestPosition = await client.query('SELECT MAX(device_timestamp)::text FROM positions');
      const byProtocol = await client.query(
        'SELECT protocol, COUNT(*)::int FROM positions GROUP BY protocol ORDER BY COUNT(*) DESC'
      );

      return reply.send({
        devices: devices.rows[0].count,
        positions: positions.rows[0].count,
        trips: trips.rows[0].count,
        onlineDevices: onlineDevices.rows[0].count,
        lastPosition: latestPosition.rows[0].max,
        byProtocol: byProtocol.rows,
        server: {
          port: 4000,
          traccarPort: 5055,
          uptime: process.uptime(),
        },
      });
    } finally {
      client.release();
    }
  });
}
