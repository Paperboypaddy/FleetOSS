import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { parseHttpJson } from './protocols/http-json.js';
import { parseTraccarParams } from './protocols/traccar.js';
import type { TraccarParams } from './protocols/traccar.js';
import { insertPosition } from '../db/repositories/position.js';
import { findOrCreateDevice, updateDeviceStatus } from '../db/repositories/device.js';
import { broadcastPosition } from '../realtime/index.js';
import { detectTrip } from '../core/trip-detector.js';
import { resolveSpeedLimitForPosition } from '../core/speed-limits.js';
import { checkRateLimit } from '../core/rate-limiter.js';

async function ingestPosition(data: import('@fleetoss/core').IngestedPosition, protocol: string) {
  const device = await findOrCreateDevice(data.deviceId);
  const position = await insertPosition({ ...data, deviceId: device.id }, protocol);
  await updateDeviceStatus(device.id, 'online');
  broadcastPosition(position);
  detectTrip(device.id, position);
  // Resolve speed limit in background (non-blocking, cached server-side)
  resolveSpeedLimitForPosition(position.id, position.latitude, position.longitude);
  return { id: position.id };
}

export async function handleTraccarIngest(request: FastifyRequest, reply: FastifyReply) {
  const ip = request.ip;
  if (!(await checkRateLimit(`ingest:${ip}`))) {
    return reply.code(429).send({ error: 'Too many requests' });
  }
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
    const body = request.body as Record<string, unknown> | null;
    const deviceId = (params.id || (body?.['device_id'] as string) || (body?.['deviceId'] as string)) as string;
    const location = body?.['location'] as Record<string, unknown> | undefined;
    const coords = location?.['coords'] as Record<string, unknown> | undefined;

    const bLat = coords?.['latitude'] as number | undefined;
    const bLng = coords?.['longitude'] as number | undefined;
    if (deviceId && bLat != null && bLng != null) {
      // Background Geolocation sends speed in m/s — convert to mph
      const speedMs = coords?.['speed'] as number | undefined;
      const speedMph = speedMs != null && speedMs >= 0 ? speedMs * 2.237 : undefined;
      const heading = (coords?.['heading'] || coords?.['bearing']) as number | undefined;
      const accuracy = coords?.['accuracy'] as number | undefined;
      const battery = location?.['battery'] as Record<string, unknown> | undefined;
      const batteryLevel = battery?.['level'] != null ? (battery['level'] as number) * 100 : undefined;
      const odometer = location?.['odometer'] as number | undefined;
      const timestamp = (location?.['timestamp'] as string) || new Date().toISOString();

      const bgData: import('@fleetoss/core').IngestedPosition = {
        deviceId: deviceId as string,
        latitude: bLat,
        longitude: bLng,
        altitude: coords?.['altitude'] as number | undefined,
        speed: speedMph,
        bearing: heading,
        accuracy,
        odometer,
        batteryLevel,
        timestamp,
      };
      const result = await ingestPosition(bgData, 'background-geolocation');
      return reply.code(201).send(result);
    }

    return reply.code(400).send({
      error: 'Missing required fields',
      details: 'id, lat, and lon are required',
      received: Object.keys(params),
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message?.startsWith('Invalid coordinates')) {
      return reply.code(400).send({ error: err.message });
    }
    request.log.error(err, 'Traccar ingestion failed');
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export function registerIngestionRoutes(app: FastifyInstance) {
  // HTTP/JSON protocol — most Android GPS apps use this
  app.post('/api/ingest', async (request, reply) => {
    if (!(await checkRateLimit(`ingest:${request.ip}`))) {
      return reply.code(429).send({ error: 'Too many requests' });
    }
    const data = parseHttpJson(request.body);
    const result = await ingestPosition(data, 'http-json');
    return reply.code(201).send(result);
  });

  // Batch ingestion — for devices that buffer positions
  app.post('/api/ingest/batch', async (request, reply) => {
    if (!(await checkRateLimit(`ingest:${request.ip}`))) {
      return reply.code(429).send({ error: 'Too many requests' });
    }
    const items = Array.isArray(request.body) ? request.body : [request.body];
    const results = [];
    for (const item of items) {
      const data = parseHttpJson(item);
      const result = await ingestPosition(data, 'http-json');
      results.push(result);
    }
    return reply.code(201).send(results);
  });

  // Traccar protocol endpoints
  app.get('/api/ingest/traccar', handleTraccarIngest);
  app.post('/api/ingest/traccar', handleTraccarIngest);
}
