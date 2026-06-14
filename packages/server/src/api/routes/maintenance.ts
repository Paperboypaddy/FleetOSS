import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { maintenance } from '../../db/schema.js';

export function registerMaintenanceRoutes(app: FastifyInstance) {
  // List all, optionally by device
  app.get<{ Querystring: { deviceId?: string } }>('/api/maintenance', async (request, reply) => {
    try {
      const db = getDb();
      const { deviceId } = request.query;
      const result = deviceId
        ? await db.select().from(maintenance).where(eq(maintenance.deviceId, deviceId)).orderBy(desc(maintenance.createdAt))
        : await db.select().from(maintenance).orderBy(desc(maintenance.createdAt));
      return reply.send(result);
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch maintenance');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create
  app.post('/api/maintenance', async (request, reply) => {
    try {
      const db = getDb();
      const body = request.body as any;
      if (!body.deviceId || !body.name) return reply.code(400).send({ error: 'deviceId and name required' });
      const result = await db.insert(maintenance).values({
        deviceId: body.deviceId,
        name: body.name,
        type: body.type || 'other',
        intervalDays: body.intervalDays,
        intervalMeters: body.intervalMeters,
        lastOdometer: body.lastOdometer,
        lastDate: body.lastDate,
        dueOdometer: body.dueOdometer,
        dueDate: body.dueDate,
        notes: body.notes,
        attributes: body.attributes || {},
      }).returning();
      return reply.code(201).send(result[0]);
    } catch (err: any) {
      request.log.error(err, 'Failed to create maintenance item');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update
  app.patch<{ Params: { id: string } }>('/api/maintenance/:id', async (request, reply) => {
    try {
      const db = getDb();
      const body = request.body as any;
      const result = await db.update(maintenance)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(maintenance.id, request.params.id))
        .returning();
      if (!result.length) return reply.code(404).send({ error: 'Not found' });
      return reply.send(result[0]);
    } catch (err: any) {
      request.log.error(err, 'Failed to update maintenance');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete
  app.delete<{ Params: { id: string } }>('/api/maintenance/:id', async (request, reply) => {
    try {
      const db = getDb();
      await db.delete(maintenance).where(eq(maintenance.id, request.params.id));
      return reply.code(204).send();
    } catch (err: any) {
      request.log.error(err, 'Failed to delete maintenance');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
