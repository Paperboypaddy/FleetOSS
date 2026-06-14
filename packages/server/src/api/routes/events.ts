import type { FastifyInstance } from 'fastify';
import { eq, desc, and, sql } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { events } from '../../db/schema.js';
import { parsePagination, paginatedResponse } from '../pagination.js';

export function registerEventRoutes(app: FastifyInstance) {
  app.get('/api/events', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { page, limit, offset } = parsePagination(query);
    const deviceId = query.deviceId;
    const conditions = deviceId ? [eq(events.deviceId, deviceId)] : [];

    const db = getDb();
    const [data, countResult] = await Promise.all([
      db.select().from(events)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(events.time)).offset(offset).limit(limit),
      db.select({ count: sql<number>`count(*)` }).from(events)
        .where(conditions.length ? and(...conditions) : undefined),
    ]);
    return reply.send(paginatedResponse(data, Number(countResult[0].count), page, limit));
  });
}
