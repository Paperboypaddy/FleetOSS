import type { FastifyInstance } from 'fastify';
import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { events } from '../../db/schema.js';

export function registerEventRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { deviceId?: string; limit?: string } }>('/api/events', async (request, reply) => {
    try {
      const db = getDb();
      const { deviceId, limit } = request.query;
      const max = limit ? parseInt(limit, 10) : 100;
      const conditions = [];
      if (deviceId) conditions.push(eq(events.deviceId, deviceId));
      const result = await db.select().from(events)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(events.time)).limit(max);
      return reply.send(result);
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch events');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
