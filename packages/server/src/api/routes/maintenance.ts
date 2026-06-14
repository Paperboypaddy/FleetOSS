import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { maintenance } from '../../db/schema.js';
import { AppError } from '../errors.js';

export function registerMaintenanceRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { deviceId?: string } }>('/api/maintenance', async (request, reply) => {
    const db = getDb();
    const { deviceId } = request.query;
    const result = deviceId
      ? await db.select().from(maintenance).where(eq(maintenance.deviceId, deviceId)).orderBy(desc(maintenance.createdAt))
      : await db.select().from(maintenance).orderBy(desc(maintenance.createdAt));
    return reply.send(result);
  });

  app.post('/api/maintenance', async (request, reply) => {
    const db = getDb();
    const body = request.body as Record<string, unknown>;
    if (!body.deviceId || !body.name) return reply.code(400).send({ error: 'deviceId and name required' });
    const result = await db.insert(maintenance).values({
      deviceId: body.deviceId as string,
      name: body.name as string,
      type: (body.type as string) || 'other',
      intervalDays: body.intervalDays as number | undefined,
      intervalMeters: body.intervalMeters as number | undefined,
      lastOdometer: body.lastOdometer as number | undefined,
      lastDate: body.lastDate as string | undefined,
      dueOdometer: body.dueOdometer as number | undefined,
      dueDate: body.dueDate as string | undefined,
      notes: body.notes as string | undefined,
      attributes: (body.attributes as Record<string, unknown>) || {},
    } as any).returning();
    return reply.code(201).send(result[0]);
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/maintenance/:id', async (request, reply) => {
    const db = getDb();
    const body = request.body;
    const result = await db.update(maintenance)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(maintenance.id, request.params.id))
      .returning();
    if (!result.length) throw AppError.notFound('Maintenance item not found');
    return reply.send(result[0]);
  });

  app.delete<{ Params: { id: string } }>('/api/maintenance/:id', async (request, reply) => {
    const db = getDb();
    await db.delete(maintenance).where(eq(maintenance.id, request.params.id));
    return reply.code(204).send();
  });
}
