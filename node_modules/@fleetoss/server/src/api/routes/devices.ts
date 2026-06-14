import type { FastifyInstance } from 'fastify';
import { listDevices, getDeviceById } from '../../db/repositories/device.js';

export function registerDeviceRoutes(app: FastifyInstance) {
  app.get('/api/devices', async (_request, reply) => {
    const devices = await listDevices();
    return reply.send(devices);
  });

  app.get<{ Params: { id: string } }>('/api/devices/:id', async (request, reply) => {
    const device = await getDeviceById(request.params.id);
    if (!device) return reply.code(404).send({ error: 'Device not found' });
    return reply.send(device);
  });
}
