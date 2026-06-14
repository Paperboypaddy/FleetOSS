import type { FastifyInstance } from 'fastify';
import { eq, desc, and, sql } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { fuelEntries } from '../../db/schema.js';
import { parsePagination, paginatedResponse } from '../pagination.js';

export function registerFuelRoutes(app: FastifyInstance) {
  app.get('/api/fuel', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { page, limit, offset } = parsePagination(query);
    const deviceId = query.deviceId;
    const conditions = deviceId ? [eq(fuelEntries.deviceId, deviceId)] : [];

    const db = getDb();
    const [data, countResult] = await Promise.all([
      conditions.length > 0
        ? db.select().from(fuelEntries).where(and(...conditions)).orderBy(desc(fuelEntries.date)).offset(offset).limit(limit)
        : db.select().from(fuelEntries).orderBy(desc(fuelEntries.date)).offset(offset).limit(limit),
      db.select({ count: sql<number>`count(*)` }).from(fuelEntries).where(conditions.length ? and(...conditions) : undefined),
    ]);
    return reply.send(paginatedResponse(data, Number(countResult[0].count), page, limit));
  });

  app.post<{ Body: Record<string, unknown> }>('/api/fuel', async (request, reply) => {
    const db = getDb();
    const body = request.body;
    if (!body.deviceId || !body.gallons) return reply.code(400).send({ error: 'deviceId and gallons required' });
    const result = await db.insert(fuelEntries).values({
      deviceId: body.deviceId as string, date: new Date((body.date as string) || Date.now()),
      odometer: body.odometer as number | undefined, gallons: body.gallons as number,
      pricePerGallon: body.pricePerGallon as number | undefined, mpg: body.mpg as number | undefined,
      station: body.station as string | undefined, notes: body.notes as string | undefined,
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
