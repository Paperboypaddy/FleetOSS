import type { FastifyInstance } from 'fastify';
import { getSpeedLimits, getSpeedLimit } from '../../core/speed-limits.js';

export function registerSpeedLimitRoutes(app: FastifyInstance) {
  // Get speed limits for a set of coordinates
  // POST /api/speedlimits with body: { coords: [[lat,lng], ...] }
  app.post('/api/speedlimits', async (request, reply) => {
    try {
      const body = request.body as any
      if (!body?.coords || !Array.isArray(body.coords)) {
        return reply.code(400).send({ error: 'coords array required' })
      }
      const coords: Array<[number, number]> = body.coords
      const limits = await getSpeedLimits(coords)
      return reply.send({ limits })
    } catch (err: any) {
      request.log.error(err, 'Speed limit lookup failed')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  });

  // Single coordinate lookup
  app.get('/api/speedlimit', async (request, reply) => {
    try {
      const { lat, lng } = request.query as any
      if (lat === undefined || lng === undefined) {
        return reply.code(400).send({ error: 'lat and lng query params required' })
      }
      const result = await getSpeedLimit(parseFloat(lat), parseFloat(lng))
      return reply.send(result)
    } catch (err: any) {
      request.log.error(err, 'Speed limit lookup failed')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  });
}
