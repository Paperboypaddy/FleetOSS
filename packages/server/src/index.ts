import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { config } from './config/index.js';
import { registerIngestionRoutes, handleTraccarIngest } from './ingestion/server.js';
import { registerDeviceRoutes } from './api/routes/devices.js';
import { registerPositionRoutes } from './api/routes/positions.js';
import { registerTripRoutes } from './api/routes/trips.js';
import { registerStatsRoutes } from './api/routes/stats.js';
import { registerRealtime } from './realtime/index.js';
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
  registerIngestionRoutes(app);
  registerDeviceRoutes(app);
  registerPositionRoutes(app);
  registerTripRoutes(app);
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
}

main();
