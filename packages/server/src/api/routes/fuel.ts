import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { fuelEntries } from '../../db/schema.js';

export function registerFuelRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { deviceId?: string; limit?: string } }>('/api/fuel', async (request, reply) => {
    const db = getDb();
    const { deviceId, limit } = request.query;
    const max = limit ? parseInt(limit, 10) : 50;
    const result = deviceId
      ? await db.select().from(fuelEntries).where(eq(fuelEntries.deviceId, deviceId)).orderBy(desc(fuelEntries.date)).limit(max)
      : await db.select().from(fuelEntries).orderBy(desc(fuelEntries.date)).limit(max);
    return reply.send(result);
  });

  app.post<{ Body: Record<string, unknown> }>('/api/fuel', async (request, reply) => {
    const db = getDb();
    const body = request.body;
    if (!body.deviceId || !body.gallons) return reply.code(400).send({ error: 'deviceId and gallons required' });
    const result = await db.insert(fuelEntries).values({
      deviceId: body.deviceId as string,
      date: new Date((body.date as string) || Date.now()),
      odometer: body.odometer as number | undefined,
      gallons: body.gallons as number,
      pricePerGallon: body.pricePerGallon as number | undefined,
      mpg: body.mpg as number | undefined,
      station: body.station as string | undefined,
      notes: body.notes as string | undefined,
      attributes: (body.attributes as Record<string, unknown>) || {},
    }).returning();
    return reply.code(201).send(result[0]);
  });

  app.delete<{ Params: { id: string } }>('/api/fuel/:id', async (request, reply) => {
    const db = getDb();
    await db.delete(fuelEntries).where(eq(fuelEntries.id, request.params.id));
    return reply.code(204).send();
  });
}
