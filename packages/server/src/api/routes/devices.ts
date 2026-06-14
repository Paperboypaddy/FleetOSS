import type { FastifyInstance } from 'fastify';
import { listDevices, getDeviceById, updateDeviceName, deleteDeviceById } from '../../db/repositories/device.js';

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

  // Rename a device
  app.patch<{ Params: { id: string }; Body: { name: string } }>('/api/devices/:id', async (request, reply) => {
    try {
      const { name } = request.body;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return reply.code(400).send({ error: 'Name is required' });
      }
      const device = await updateDeviceName(request.params.id, name.trim());
      return reply.send(device);
    } catch (err: any) {
      request.log.error(err, 'Failed to rename device');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete a device
  app.delete<{ Params: { id: string } }>('/api/devices/:id', async (request, reply) => {
    try {
      const device = await getDeviceById(request.params.id);
      if (!device) return reply.code(404).send({ error: 'Device not found' });
      await deleteDeviceById(request.params.id);
      return reply.code(204).send();
    } catch (err: any) {
      request.log.error(err, 'Failed to delete device');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
