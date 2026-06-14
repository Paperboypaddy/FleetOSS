import type { FastifyInstance } from 'fastify';
import { eq, desc, and, sql } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { maintenance } from '../../db/schema.js';
import { AppError } from '../errors.js';
import { parsePagination, paginatedResponse } from '../pagination.js';

export function registerMaintenanceRoutes(app: FastifyInstance) {
  app.get('/api/maintenance', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { page, limit, offset } = parsePagination(query);
    const deviceId = query.deviceId;
    const conditions = deviceId ? [eq(maintenance.deviceId, deviceId)] : [];

    const db = getDb();
    const [data, countResult] = await Promise.all([
      conditions.length > 0
        ? db.select().from(maintenance).where(and(...conditions)).orderBy(desc(maintenance.createdAt)).offset(offset).limit(limit)
        : db.select().from(maintenance).orderBy(desc(maintenance.createdAt)).offset(offset).limit(limit),
      db.select({ count: sql<number>`count(*)` }).from(maintenance).where(conditions.length ? and(...conditions) : undefined),
    ]);
    return reply.send(paginatedResponse(data, Number(countResult[0].count), page, limit));
  });

  app.post('/api/maintenance', async (request, reply) => {
    const db = getDb();
    const body = request.body as Record<string, unknown>;
    if (!body.deviceId || !body.name) return reply.code(400).send({ error: 'deviceId and name required' });
    const result = await db.insert(maintenance).values({
      deviceId: body.deviceId as string, name: body.name as string, type: (body.type as string) || 'other',
      intervalDays: body.intervalDays as number | undefined, intervalMeters: body.intervalMeters as number | undefined,
      lastOdometer: body.lastOdometer as number | undefined, lastDate: body.lastDate as string | undefined,
      dueOdometer: body.dueOdometer as number | undefined, dueDate: body.dueDate as string | undefined,
      notes: body.notes as string | undefined, attributes: (body.attributes as Record<string, unknown>) || {},
    } as any).returning();
    return reply.code(201).send(result[0]);
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/maintenance/:id', async (request, reply) => {
    const db = getDb();
    const result = await db.update(maintenance).set({ ...request.body, updatedAt: new Date() })
      .where(eq(maintenance.id, request.params.id)).returning();
    if (!result.length) throw AppError.notFound('Maintenance item not found');
    return reply.send(result[0]);
  });

  app.delete<{ Params: { id: string } }>('/api/maintenance/:id', async (request, reply) => {
    const db = getDb();
    await db.delete(maintenance).where(eq(maintenance.id, request.params.id));
    return reply.code(204).send();
  });
}
