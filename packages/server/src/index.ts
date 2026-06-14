import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { config } from './config/index.js';
import { registerIngestionRoutes } from './ingestion/server.js';
import { registerDeviceRoutes } from './api/routes/devices.js';
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

  // Routes
  registerIngestionRoutes(app);
  registerDeviceRoutes(app);
  registerRealtime(app);

  // Start
  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`FleetOSS server running on http://${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
