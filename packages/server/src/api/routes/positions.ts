import type { FastifyInstance } from 'fastify';
import { getPositions } from '../../db/repositories/position.js';

export function registerPositionRoutes(app: FastifyInstance) {
  app.get<{
    Params: { deviceId: string }
    Querystring: { from?: string; to?: string; limit?: string }
  }>('/api/devices/:deviceId/positions', async (request, reply) => {
    try {
      const { deviceId } = request.params;
      const { from, to, limit } = request.query;

      const fromDate = from ? new Date(from) : undefined;
      const toDate = to ? new Date(to) : undefined;
      const maxResults = limit ? parseInt(limit, 10) : 1000;

      if (fromDate && isNaN(fromDate.getTime())) {
        return reply.code(400).send({ error: 'Invalid from date' });
      }
      if (toDate && isNaN(toDate.getTime())) {
        return reply.code(400).send({ error: 'Invalid to date' });
      }

      const results = await getPositions(deviceId, fromDate, toDate, maxResults);
      return reply.send(results);
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch positions');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
