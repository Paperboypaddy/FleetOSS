import type { FastifyInstance } from 'fastify';
import { parseHttpJson } from './protocols/http-json.js';
import { insertPosition } from '../db/repositories/position.js';
import { findOrCreateDevice, updateDeviceStatus } from '../db/repositories/device.js';
import { broadcastPosition } from '../realtime/index.js';
import { detectTrip } from '../core/trip-detector.js';

export function registerIngestionRoutes(app: FastifyInstance) {
  // HTTP/JSON protocol — most Android GPS apps use this
  app.post('/api/ingest', async (request, reply) => {
    try {
      const data = parseHttpJson(request.body);

      const device = await findOrCreateDevice(data.deviceId);
      const position = await insertPosition(data, 'http-json');
      await updateDeviceStatus(device.id, 'online');

      broadcastPosition(position);

      detectTrip(device.id, position);

      return reply.code(201).send({ id: position.id });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors });
      }
      request.log.error(err, 'Ingestion failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Batch ingestion — for devices that buffer positions
  app.post('/api/ingest/batch', async (request, reply) => {
    try {
      const items = Array.isArray(request.body) ? request.body : [request.body];
      const results = [];

      for (const item of items) {
        const data = parseHttpJson(item);
        const device = await findOrCreateDevice(data.deviceId);
        const position = await insertPosition(data, 'http-json');
        await updateDeviceStatus(device.id, 'online');
        broadcastPosition(position);
        detectTrip(device.id, position);
        results.push({ id: position.id });
      }

      return reply.code(201).send(results);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors });
      }
      request.log.error(err, 'Batch ingestion failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
