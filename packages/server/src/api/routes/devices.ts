import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { devices } from '../../db/schema.js';
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

  // Update a device (rename, set attributes)
  app.patch<{ Params: { id: string }; Body: { name?: string; attributes?: Record<string, unknown> } }>('/api/devices/:id', async (request, reply) => {
    try {
      const db = getDb();
      const existing = await getDeviceById(request.params.id);
      if (!existing) return reply.code(404).send({ error: 'Device not found' });

      const updates: Record<string, any> = { updatedAt: new Date() };
      if (request.body.name?.trim()) updates.name = request.body.name.trim();
      if (request.body.attributes) {
        updates.attributes = { ...(existing.attributes || {}), ...request.body.attributes };
      }
      const result = await db.update(devices).set(updates).where(eq(devices.id, request.params.id)).returning();
      return reply.send(result[0]);
    } catch (err: any) {
      request.log.error(err, 'Failed to update device');
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
