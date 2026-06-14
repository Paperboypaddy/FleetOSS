import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { fuelEntries } from '../../db/schema.js';

export function registerFuelRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { deviceId?: string; limit?: string } }>('/api/fuel', async (request, reply) => {
    try {
      const db = getDb();
      const { deviceId, limit } = request.query;
      const max = limit ? parseInt(limit, 10) : 50;
      const result = deviceId
        ? await db.select().from(fuelEntries).where(eq(fuelEntries.deviceId, deviceId)).orderBy(desc(fuelEntries.date)).limit(max)
        : await db.select().from(fuelEntries).orderBy(desc(fuelEntries.date)).limit(max);
      return reply.send(result);
    } catch (err: unknown) {
      request.log.error(err, 'Failed to fetch fuel entries');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  app.post<{ Body: { deviceId?: string; gallons?: number; date?: string; odometer?: number; pricePerGallon?: number; mpg?: number; station?: string; notes?: string; attributes?: Record<string, unknown> } }>('/api/fuel', async (request, reply) => {
    try {
      const db = getDb();
      const body = request.body;
      if (!body.deviceId || !body.gallons) return reply.code(400).send({ error: 'deviceId and gallons required' });
      const result = await db.insert(fuelEntries).values({
        deviceId: body.deviceId,
        date: new Date(body.date || Date.now()),
        odometer: body.odometer,
        gallons: body.gallons,
        pricePerGallon: body.pricePerGallon,
        mpg: body.mpg,
        station: body.station,
        notes: body.notes,
        attributes: body.attributes || {},
      } as any).returning();
      return reply.code(201).send(result[0]);
    } catch (err: unknown) {
      request.log.error(err, 'Failed to create fuel entry');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  app.delete<{ Params: { id: string } }>('/api/fuel/:id', async (request, reply) => {
    try {
      const db = getDb();
      await db.delete(fuelEntries).where(eq(fuelEntries.id, request.params.id));
      return reply.code(204).send();
    } catch (err: unknown) {
      request.log.error(err, 'Failed to delete fuel entry');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
