import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { devices } from '../../db/schema.js';
import { listDevices, listUnapprovedDevices, approveDevice, getDeviceById, updateDeviceName, deleteDeviceById, createDevice } from '../../db/repositories/device.js';

export function registerDeviceRoutes(app: FastifyInstance) {
  app.get('/api/devices', async (_request, reply) => {
    const devices = await listDevices();
    return reply.send(devices);
  });

  // Register a new device manually (admin)
  app.post<{ Body: { uniqueId: string; name?: string } }>('/api/devices', async (request, reply) => {
    try {
      const { uniqueId, name } = request.body;
      if (!uniqueId?.trim()) return reply.code(400).send({ error: 'uniqueId is required' });
      const device = await createDevice(uniqueId.trim(), name?.trim() || uniqueId.trim());
      return reply.code(201).send(device);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'Device with this ID already exists') {
        return reply.code(409).send({ error: err.message });
      }
      request.log.error(err, 'Failed to create device');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  app.get<{ Params: { id: string } }>('/api/devices/:id', async (request, reply) => {
    const device = await getDeviceById(request.params.id);
    if (!device) return reply.code(404).send({ error: 'Device not found' });
    return reply.send(device);
  });

  // List unapproved devices (admin)
  app.get('/api/devices/unregistered', async (request, reply) => {
    const devices = await listUnapprovedDevices();
    return reply.send(devices);
  });

  // Approve a device (admin)
  app.patch<{ Params: { id: string } }>('/api/devices/:id/approve', async (request, reply) => {
    try {
      const existing = await getDeviceById(request.params.id);
      if (!existing) return reply.code(404).send({ error: 'Device not found' });
      const device = await approveDevice(request.params.id);
      return reply.send(device);
    } catch (err: unknown) {
      request.log.error(err, 'Failed to approve device');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update a device (rename, set attributes)
  app.patch<{ Params: { id: string }; Body: { name?: string; attributes?: Record<string, unknown> } }>('/api/devices/:id', async (request, reply) => {
    try {
      const db = getDb();
      const existing = await getDeviceById(request.params.id);
      if (!existing) return reply.code(404).send({ error: 'Device not found' });

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (request.body.name?.trim()) updates.name = request.body.name.trim();
      if (request.body.attributes) {
        updates.attributes = { ...(existing.attributes || {}), ...request.body.attributes };
      }
      const result = await db.update(devices).set(updates).where(eq(devices.id, request.params.id)).returning();
      return reply.send(result[0]);
    } catch (err: unknown) {
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
    } catch (err: unknown) {
      request.log.error(err, 'Failed to delete device');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
