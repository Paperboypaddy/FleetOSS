import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { config } from './config/index.js';
import { registerIngestionRoutes, handleTraccarIngest } from './ingestion/server.js';
import { registerDeviceRoutes } from './api/routes/devices.js';
import { registerPositionRoutes } from './api/routes/positions.js';
import { registerTripRoutes } from './api/routes/trips.js';
import { registerAuthRoutes } from './auth/index.js';
import { registerUserRoutes } from './api/routes/users.js';
import { registerGeofenceRoutes } from './api/routes/geofences.js';
import { registerEventRoutes } from './api/routes/events.js';
import { registerMaintenanceRoutes } from './api/routes/maintenance.js';
import { registerFuelRoutes } from './api/routes/fuel.js';
import { registerSpeedLimitRoutes } from './api/routes/speedlimits.js';
import { registerStatsRoutes } from './api/routes/stats.js';
import { registerRealtime } from './realtime/index.js';
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
  });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  // Health check
  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Traccar root endpoint — many clients send to /
  app.get('/', handleTraccarIngest);
  app.post('/', handleTraccarIngest);

  // Routes
  registerAuthRoutes(app);
  registerIngestionRoutes(app);
  registerDeviceRoutes(app);
  registerPositionRoutes(app);
  registerTripRoutes(app);
  registerUserRoutes(app);
  registerGeofenceRoutes(app);
  registerEventRoutes(app);
  registerMaintenanceRoutes(app);
  registerFuelRoutes(app);
  registerSpeedLimitRoutes(app);
  registerStatsRoutes(app);
  registerRealtime(app);

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
