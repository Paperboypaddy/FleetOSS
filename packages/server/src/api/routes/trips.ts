import type { FastifyInstance } from 'fastify';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { trips } from '../../db/schema.js';
import { AppError } from '../errors.js';
import { parsePagination, paginatedResponse } from '../pagination.js';
import { getAccessibleDeviceIds, checkDevicePermission } from '../permissions.js';

export function registerTripRoutes(app: FastifyInstance) {
  // List all trips, optionally filtered by device
  app.get('/api/trips', async (request: any, reply) => {
    const db = getDb();
    const query = request.query as Record<string, string>;
    const { page, limit, offset } = parsePagination(query);
    const deviceIdFilter = query.deviceId;
    const userId = request.user?.sub || '';
    const userRole = request.user?.role || 'viewer';
    const accessibleIds = await getAccessibleDeviceIds(userId, userRole);

    const conditions = [];
    if (deviceIdFilter) {
      conditions.push(eq(trips.deviceId, deviceIdFilter));
    }
    if (accessibleIds !== null) {
      if (accessibleIds.length === 0) {
        return reply.send(paginatedResponse([], 0, page, limit));
      }
      conditions.push(inArray(trips.deviceId, accessibleIds));
    }

    const [data, countResult] = await Promise.all([
      conditions.length > 0
        ? db.select().from(trips).where(and(...conditions)).orderBy(desc(trips.startTime)).offset(offset).limit(limit)
        : db.select().from(trips).orderBy(desc(trips.startTime)).offset(offset).limit(limit),
      conditions.length > 0
        ? db.select({ count: sql<number>`count(*)` }).from(trips).where(and(...conditions))
        : db.select({ count: sql<number>`count(*)` }).from(trips),
    ]);
    return reply.send(paginatedResponse(data, Number(countResult[0].count), page, limit));
  });

  app.get<{ Params: { id: string } }>('/api/trips/:id', async (request: any, reply) => {
    const db = getDb();
    const result = await db.select().from(trips).where(eq(trips.id, request.params.id)).limit(1);
    if (result.length === 0) throw AppError.notFound('Trip not found');
    const permitted = await checkDevicePermission(
      request.user?.sub || '', request.user?.role || '', result[0].deviceId, 'view'
    );
    if (!permitted) return reply.code(403).send({ error: 'Access denied' });
    return reply.send(result[0]);
  });

  app.patch<{ Params: { id: string }; Body: { type?: string; purpose?: string } }>('/api/trips/:id', async (request: any, reply) => {
    const db = getDb();
    const existing = await db.select().from(trips).where(eq(trips.id, request.params.id)).limit(1);
    if (existing.length === 0) throw AppError.notFound('Trip not found');
    const permitted = await checkDevicePermission(
      request.user?.sub || '', request.user?.role || '', existing[0].deviceId, 'manage'
    );
    if (!permitted) return reply.code(403).send({ error: 'Access denied' });
    const attrs = { ...(existing[0].attributes as Record<string, unknown> || {}) };
    if (request.body.type) attrs.type = request.body.type;
    if (request.body.purpose !== undefined) attrs.purpose = request.body.purpose;
    const result = await db.update(trips).set({ attributes: attrs }).where(eq(trips.id, request.params.id)).returning();
    return reply.send(result[0]);
  });

  app.get<{ Params: { deviceId: string } }>('/api/devices/:deviceId/trips', async (request: any, reply) => {
    const db = getDb();
    const { page, limit, offset } = parsePagination(request.query as Record<string, string>);
    const { deviceId } = request.params;
    const permitted = await checkDevicePermission(
      request.user?.sub || '', request.user?.role || '', deviceId, 'view'
    );
    if (!permitted) return reply.code(403).send({ error: 'Access denied' });

    const [data, countResult] = await Promise.all([
      db.select().from(trips).where(eq(trips.deviceId, deviceId)).orderBy(desc(trips.startTime)).offset(offset).limit(limit),
      db.select({ count: sql<number>`count(*)` }).from(trips).where(eq(trips.deviceId, deviceId)),
    ]);
    return reply.send(paginatedResponse(data, Number(countResult[0].count), page, limit));
  });
}
