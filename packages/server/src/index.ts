import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import crypto from 'node:crypto';
import { config } from './config/index.js';
import { registerIngestionRoutes, handleTraccarIngest } from './ingestion/server.js';
import { registerDeviceRoutes } from './api/routes/devices.js';
import { registerPositionRoutes } from './api/routes/positions.js';
import { registerTripRoutes } from './api/routes/trips.js';
import { registerAuthRoutes, registerDbAuthRoutes, authMiddleware } from './auth/index.js';
import { registerUserRoutes } from './api/routes/users.js';
import { registerGeofenceRoutes } from './api/routes/geofences.js';
import { registerEventRoutes } from './api/routes/events.js';
import { registerMaintenanceRoutes } from './api/routes/maintenance.js';
import { registerFuelRoutes } from './api/routes/fuel.js';
import { registerAuthProviderRoutes } from './api/routes/auth-providers.js';
import { registerApiKeyRoutes } from './api/routes/api-keys.js';
import { registerGroupRoutes } from './api/routes/groups.js';
import { registerAdminRoutes } from './api/routes/admin.js';
import { registerExportRoutes } from './api/routes/export.js';
import { registerSpeedLimitRoutes } from './api/routes/speedlimits.js';
import { registerStatsRoutes } from './api/routes/stats.js';
import { registerErrorHandler } from './api/errors.js';
import { registerRealtime } from './realtime/index.js';
import { startGeocoderWorker, stopGeocoderWorker } from './core/geocoder-worker.js';
import { closeRedis } from './db/redis.js';
import { startTcpServer } from './ingestion/tcp-server.js';
import { nmeaHandler } from './ingestion/handlers/nmea-handler.js';
import { gt06Handler } from './ingestion/handlers/gt06-handler.js';
import { tk103Handler } from './ingestion/handlers/tk103-handler.js';
import { teltonikaHandler } from './ingestion/handlers/teltonika-handler.js';
import { queclinkHandler } from './ingestion/handlers/queclink-handler.js';
import { getPool } from './db/connection.js';

async function main() {
  const app = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    },
    genReqId: () => crypto.randomUUID().slice(0, 8),
  });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  // Health check
  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Traccar root endpoint — many clients send to /
  app.get('/', handleTraccarIngest);
  app.post('/', handleTraccarIngest);

  // Request logging — adds request ID to every response header
  app.addHook('preHandler', (request, reply, done) => {
    reply.header('X-Request-Id', request.id as string);
    done();
  });

  // Routes
  await registerAuthRoutes(app);
  await registerDbAuthRoutes(app);
  registerIngestionRoutes(app);

  // Global auth middleware for all API routes (except public ones registered above)
  app.addHook('preHandler', (request, reply, done) => {
    const url = request.url;
    if (url.startsWith('/api/') && !url.startsWith('/api/health') && !url.startsWith('/api/auth/') && !url.startsWith('/api/ingest')) {
      return authMiddleware(request, reply);
    }
    done();
  });

  registerDeviceRoutes(app);
  registerPositionRoutes(app);
  registerTripRoutes(app);
  registerUserRoutes(app);
  registerGeofenceRoutes(app);
  registerEventRoutes(app);
  registerMaintenanceRoutes(app);
  registerFuelRoutes(app);
  registerAuthProviderRoutes(app);
  registerApiKeyRoutes(app);
  registerGroupRoutes(app);
  registerAdminRoutes(app);
  registerExportRoutes(app);
  registerSpeedLimitRoutes(app);
  registerStatsRoutes(app);
  registerRealtime(app);

  // Error handling (must be registered after routes)
  registerErrorHandler(app);

  // Start background geocode worker
  startGeocoderWorker();

  // Shutdown handlers
  const cleanup = async () => {
    stopGeocoderWorker();
    await closeRedis();
  };
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);

  // Start on configured port (default 4000)
  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`FleetOSS server running on http://${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Also listen on Traccar default port 5055 for compatibility
  try {
    const traccarApp = Fastify({ logger: { level: 'warn' } });
    traccarApp.get('/', handleTraccarIngest);
    traccarApp.post('/', handleTraccarIngest);
    traccarApp.post('/api/ingest/traccar', handleTraccarIngest);
    traccarApp.get('/api/ingest/traccar', handleTraccarIngest);
    await traccarApp.listen({ port: 5055, host: config.host });
    console.log(`Traccar-compatible endpoint on http://${config.host}:5055`);
  } catch (err) {
    app.log.warn(`Could not bind port 5055 (${(err as Error).message}) — skipping`);
  }

  // Start TCP servers for various GPS device protocols
  const protocolPorts: [number, string, any][] = [
    [5100, 'NMEA', nmeaHandler],
    [5001, 'GT06/Concox', gt06Handler],
    [5002, 'TK103', tk103Handler],
    [5004, 'Queclink', queclinkHandler],
    [5056, 'Teltonika', teltonikaHandler],
  ];
  for (const [port, label, handler] of protocolPorts) {
    try {
      startTcpServer(port, label, handler);
    } catch (err) {
      app.log.warn(`Could not bind ${label} port ${port} (${(err as Error).message}) — skipping`);
    }
  }
}

main();
