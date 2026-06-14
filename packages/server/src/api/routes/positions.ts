import type { FastifyInstance } from 'fastify';
import { eq, desc, and, sql, between } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { positions } from '../../db/schema.js';
import { parsePagination, paginatedResponse } from '../pagination.js';
import { checkDevicePermission } from '../permissions.js';

export function registerPositionRoutes(app: FastifyInstance) {
  app.get<{ Params: { deviceId: string } }>('/api/devices/:deviceId/positions', async (request: any, reply) => {
    const { deviceId } = request.params;
    const permitted = await checkDevicePermission(
      request.user?.sub || '', request.user?.role || '', deviceId, 'view'
    );
    if (!permitted) return reply.code(403).send({ error: 'Access denied' });

    const query = request.query as Record<string, string>;
    const { page, limit, offset } = parsePagination(query);
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    if (from && isNaN(from.getTime())) return reply.code(400).send({ error: 'Invalid from date' });
    if (to && isNaN(to.getTime())) return reply.code(400).send({ error: 'Invalid to date' });

    const db = getDb();
    const conditions = [eq(positions.deviceId, deviceId)];
    if (from && to) conditions.push(between(positions.deviceTimestamp, from, to));
    else if (from) conditions.push(sql`device_timestamp >= ${from.toISOString()}`);
    else if (to) conditions.push(sql`device_timestamp <= ${to.toISOString()}`);

    const [data, countResult] = await Promise.all([
      db.select().from(positions).where(and(...conditions)).orderBy(desc(positions.deviceTimestamp)).offset(offset).limit(limit),
      db.select({ count: sql<number>`count(*)` }).from(positions).where(and(...conditions)),
    ]);
    return reply.send(paginatedResponse(data, Number(countResult[0].count), page, limit));
  });
}
