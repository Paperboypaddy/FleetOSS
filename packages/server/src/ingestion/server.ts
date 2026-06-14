import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { parseHttpJson } from './protocols/http-json.js';
import { parseTraccarParams } from './protocols/traccar.js';
import type { TraccarParams } from './protocols/traccar.js';
import { insertPosition } from '../db/repositories/position.js';
import { findOrCreateDevice, updateDeviceStatus } from '../db/repositories/device.js';
import { broadcastPosition } from '../realtime/index.js';
import { detectTrip } from '../core/trip-detector.js';

async function ingestPosition(data: import('@fleetoss/core').IngestedPosition, protocol: string) {
  const device = await findOrCreateDevice(data.deviceId);
  const position = await insertPosition({ ...data, deviceId: device.id }, protocol);
  await updateDeviceStatus(device.id, 'online');
  broadcastPosition(position);
  detectTrip(device.id, position);
  return { id: position.id };
}

export async function handleTraccarIngest(request: FastifyRequest, reply: FastifyReply) {
  try {
    let params: TraccarParams;

    if (request.method === 'GET') {
      params = request.query as TraccarParams;
    } else {
      const contentType = request.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        const body = request.body as Record<string, string>;
        params = body as unknown as TraccarParams;
      } else {
        params = request.body as TraccarParams;
      }
    }

    // Try Traccar/OsmAnd format (flat query params or JSON)
    if (params.id && params.lat && params.lon) {
      const data = parseTraccarParams(params);
      const result = await ingestPosition(data, 'traccar');
      return reply.code(201).send(result);
    }

    // Try Background Geolocation format (nested location.coords)
    // Used by transistorsoft/cordova-background-geolocation plugin
    const body = request.body as Record<string, any> | null;
    const deviceId = params.id || body?.device_id || body?.deviceId;
    const location = body?.location;
    const coords = location?.coords;

    if (deviceId && coords?.latitude != null && coords?.longitude != null) {
      const bgData: import('@fleetoss/core').IngestedPosition = {
        deviceId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        altitude: coords.altitude,
        speed: coords.speed,
        bearing: coords.heading || coords.bearing,
        accuracy: coords.accuracy,
        odometer: location.odometer,
        batteryLevel: location.battery?.level != null ? location.battery.level * 100 : undefined,
        timestamp: location.timestamp || new Date().toISOString(),
      };
      const result = await ingestPosition(bgData, 'background-geolocation');
      return reply.code(201).send(result);
    }

    return reply.code(400).send({
      error: 'Missing required fields',
      details: 'id, lat, and lon are required',
      received: Object.keys(params),
    });
  } catch (err: any) {
    if (err.message?.startsWith('Invalid coordinates')) {
      return reply.code(400).send({ error: err.message });
    }
    request.log.error(err, 'Traccar ingestion failed');
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export function registerIngestionRoutes(app: FastifyInstance) {
  // HTTP/JSON protocol — most Android GPS apps use this
  app.post('/api/ingest', async (request, reply) => {
    try {
      const data = parseHttpJson(request.body);
      const result = await ingestPosition(data, 'http-json');
      return reply.code(201).send(result);
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
        const result = await ingestPosition(data, 'http-json');
        results.push(result);
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

  // Traccar protocol endpoints
  app.get('/api/ingest/traccar', handleTraccarIngest);
  app.post('/api/ingest/traccar', handleTraccarIngest);
}
