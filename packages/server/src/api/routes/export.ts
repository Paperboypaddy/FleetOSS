import type { FastifyInstance } from 'fastify';
import { getPool } from '../../db/connection.js';

export function registerExportRoutes(app: FastifyInstance) {
  app.get<{ Params: { tripId: string } }>('/api/trips/:tripId/export', async (request, reply) => {
    const { tripId } = request.params;
    const pool = getPool();
    const client = await pool.connect();
    try {
      const tripResult = await client.query(
        `SELECT device_id, start_time, end_time FROM trips WHERE id = $1`,
        [tripId],
      );
      const trip = tripResult.rows[0];
      if (!trip) return reply.code(404).send({ error: 'Trip not found' });

      const posResult = await client.query(
        `SELECT device_timestamp, latitude, longitude, altitude, speed, bearing, accuracy
         FROM positions
         WHERE device_id = $1 AND device_timestamp BETWEEN $2 AND $3
         ORDER BY device_timestamp ASC`,
        [trip.device_id, trip.start_time, trip.end_time],
      );

      const rows = posResult.rows || [];
      let csv = 'timestamp,latitude,longitude,altitude,speed_mph,bearing,accuracy\n';
      for (const r of rows) {
        csv += [
          `"${r.device_timestamp}"`,
          r.latitude,
          r.longitude,
          r.altitude ?? '',
          r.speed ?? '',
          r.bearing ?? '',
          r.accuracy ?? '',
        ].join(',') + '\n';
      }

      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="trip-${tripId.slice(0, 8)}.csv"`);
      return reply.send(csv);
    } finally {
      client.release();
    }
  });
}
