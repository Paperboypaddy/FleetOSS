import type { FastifyInstance } from 'fastify';
import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { trips } from '../../db/schema.js';
import type { Trip } from '@fleetoss/core';

export function registerTripRoutes(app: FastifyInstance) {
  // List all trips, optionally filtered by device
  app.get<{
    Querystring: { deviceId?: string; limit?: string }
  }>('/api/trips', async (request, reply) => {
    try {
      const db = getDb();
      const { deviceId, limit } = request.query;
      const maxResults = limit ? parseInt(limit, 10) : 100;

      const conditions = [];
      if (deviceId) conditions.push(eq(trips.deviceId, deviceId));

      const results = conditions.length > 0
        ? await db.select().from(trips).where(and(...conditions)).orderBy(desc(trips.startTime)).limit(maxResults)
        : await db.select().from(trips).orderBy(desc(trips.startTime)).limit(maxResults);

      return reply.send(results);
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch trips');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get a single trip by ID
  app.get<{
    Params: { id: string }
  }>('/api/trips/:id', async (request, reply) => {
    try {
      const db = getDb();
      const result = await db.select().from(trips).where(eq(trips.id, request.params.id)).limit(1);
      if (result.length === 0) {
        return reply.code(404).send({ error: 'Trip not found' });
      }
      return reply.send(result[0]);
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch trip');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get trips for a specific device
  app.get<{
    Params: { deviceId: string }
    Querystring: { limit?: string }
  }>('/api/devices/:deviceId/trips', async (request, reply) => {
    try {
      const db = getDb();
      const { deviceId } = request.params;
      const { limit } = request.query;
      const maxResults = limit ? parseInt(limit, 10) : 100;

      const results = await db.select()
        .from(trips)
        .where(eq(trips.deviceId, deviceId))
        .orderBy(desc(trips.startTime))
        .limit(maxResults);

      return reply.send(results);
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch device trips');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
