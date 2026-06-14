import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { geofences } from '../../db/schema.js';
import { AppError } from '../errors.js';

export function registerGeofenceRoutes(app: FastifyInstance) {
  app.get('/api/geofences', async (_request, reply) => {
    const db = getDb();
    const result = await db.select().from(geofences).orderBy(geofences.name);
    return reply.send(result);
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
      name: body.name,
      type: body.type as 'circle' | 'polygon' | 'polyline',
      latitude: body.latitude,
      longitude: body.longitude,
      radius: body.radius,
      polygon: body.polygon,
      polyline: body.polyline,
      attributes: body.attributes || {},
    }).returning();
    return reply.code(201).send(result[0]);
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/geofences/:id', async (request, reply) => {
    const db = getDb();
    const body = request.body;
    const existing = await db.select().from(geofences).where(eq(geofences.id, request.params.id)).limit(1);
    if (!existing.length) throw AppError.notFound('Geofence not found');
    const result = await db.update(geofences).set(body).where(eq(geofences.id, request.params.id)).returning();
    return reply.send(result[0]);
  });

  app.delete<{ Params: { id: string } }>('/api/geofences/:id', async (request, reply) => {
    const db = getDb();
    await db.delete(geofences).where(eq(geofences.id, request.params.id));
    return reply.code(204).send();
  });
}
