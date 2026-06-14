import type { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { geofences } from '../../db/schema.js';
import { AppError } from '../errors.js';
import { parsePagination, paginatedResponse } from '../pagination.js';

export function registerGeofenceRoutes(app: FastifyInstance) {
  app.get('/api/geofences', async (request, reply) => {
    const { page, limit, offset } = parsePagination(request.query as Record<string, string>);
    const db = getDb();
    const [data, countResult] = await Promise.all([
      db.select().from(geofences).orderBy(geofences.name).offset(offset).limit(limit),
      db.select({ count: sql<number>`count(*)` }).from(geofences),
    ]);
    return reply.send(paginatedResponse(data, Number(countResult[0].count), page, limit));
  });

  app.get<{ Params: { id: string } }>('/api/geofences/:id', async (request, reply) => {
    const db = getDb();
    const result = await db.select().from(geofences).where(eq(geofences.id, request.params.id)).limit(1);
    if (!result.length) throw AppError.notFound('Geofence not found');
    return reply.send(result[0]);
  });

  app.post<{ Body: { name?: string; type?: string; latitude?: number; longitude?: number; radius?: number; polygon?: unknown; polyline?: unknown; attributes?: Record<string, unknown> } }>('/api/geofences', async (request, reply) => {
    const db = getDb();
    const body = request.body;
    if (!body.name || !body.type) return reply.code(400).send({ error: 'Name and type required' });
    const result = await db.insert(geofences).values({
      name: body.name, type: body.type as 'circle' | 'polygon' | 'polyline',
      latitude: body.latitude, longitude: body.longitude, radius: body.radius,
      polygon: body.polygon, polyline: body.polyline, attributes: body.attributes || {},
    }).returning();
    return reply.code(201).send(result[0]);
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/geofences/:id', async (request, reply) => {
    const db = getDb();
    const existing = await db.select().from(geofences).where(eq(geofences.id, request.params.id)).limit(1);
    if (!existing.length) throw AppError.notFound('Geofence not found');
    const result = await db.update(geofences).set(request.body).where(eq(geofences.id, request.params.id)).returning();
    return reply.send(result[0]);
  });

  app.delete<{ Params: { id: string } }>('/api/geofences/:id', async (request, reply) => {
    const db = getDb();
    await db.delete(geofences).where(eq(geofences.id, request.params.id));
    return reply.code(204).send();
  });
}
