import type { FastifyInstance } from 'fastify';
import { getSpeedLimits, getSpeedLimit } from '../../core/speed-limits.js';

export function registerSpeedLimitRoutes(app: FastifyInstance) {
  // Get speed limits for a set of coordinates
  app.post<{ Body: { coords?: Array<[number, number]> } }>('/api/speedlimits', async (request, reply) => {
    const body = request.body
    if (!body?.coords || !Array.isArray(body.coords)) {
      return reply.code(400).send({ error: 'coords array required' })
    }
    const coords: Array<[number, number]> = body.coords
    const limits = await getSpeedLimits(coords)
    return reply.send({ limits })
  });

  // Single coordinate lookup
  app.get<{ Querystring: { lat?: string; lng?: string } }>('/api/speedlimit', async (request, reply) => {
    const { lat, lng } = request.query
    if (lat === undefined || lng === undefined) {
      return reply.code(400).send({ error: 'lat and lng query params required' })
    }
    const result = await getSpeedLimit(parseFloat(lat), parseFloat(lng))
    return reply.send(result)
  });
}
