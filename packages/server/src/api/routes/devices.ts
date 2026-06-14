import type { FastifyInstance } from 'fastify';
import { eq, sql, inArray } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { devices } from '../../db/schema.js';
import { listUnapprovedDevices, approveDevice, getDeviceById, deleteDeviceById, createDevice } from '../../db/repositories/device.js';
import { AppError } from '../errors.js';
import { parsePagination, paginatedResponse } from '../pagination.js';
import { getAccessibleDeviceIds, checkDevicePermission } from '../permissions.js';

export function registerDeviceRoutes(app: FastifyInstance) {
  app.get('/api/devices', async (request: any, reply) => {
    const { page, limit, offset } = parsePagination(request.query as Record<string, string>);
    const db = getDb();
    const userId = request.user?.sub || '';
    const userRole = request.user?.role || 'viewer';
    const accessibleIds = await getAccessibleDeviceIds(userId, userRole);

    let query = db.select().from(devices);
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(devices);

    if (accessibleIds !== null) {
      if (accessibleIds.length === 0) {
        return reply.send(paginatedResponse([], 0, page, limit));
      }
      query = query.where(inArray(devices.id, accessibleIds)) as any;
      countQuery = countQuery.where(inArray(devices.id, accessibleIds)) as any;
    }

    const [data, countResult] = await Promise.all([
      (query as any).offset(offset).limit(limit).orderBy(devices.createdAt),
      countQuery,
    ]);
    return reply.send(paginatedResponse(data, Number(countResult[0].count), page, limit));
  });

  app.post<{ Body: { uniqueId: string; name?: string } }>('/api/devices', async (request: any, reply) => {
    if (request.user?.role !== 'admin') {
      return reply.code(403).send({ error: 'Only admins can register devices' });
    }
    const { uniqueId, name } = request.body;
    if (!uniqueId?.trim()) return reply.code(400).send({ error: 'uniqueId is required' });
    const device = await createDevice(uniqueId.trim(), name?.trim() || uniqueId.trim());
    return reply.code(201).send(device);
  });

  app.get<{ Params: { id: string } }>('/api/devices/:id', async (request: any, reply) => {
    const device = await getDeviceById(request.params.id);
    if (!device) return reply.code(404).send({ error: 'Device not found' });
    const permitted = await checkDevicePermission(request.user?.sub || '', request.user?.role || '', request.params.id, 'view');
    if (!permitted) return reply.code(403).send({ error: 'Access denied' });
    return reply.send(device);
  });

  app.get('/api/devices/unregistered', async (request: any, reply) => {
    if (request.user?.role !== 'admin') return reply.code(403).send({ error: 'Admin only' });
    const devices = await listUnapprovedDevices();
    return reply.send(devices);
  });

  app.patch<{ Params: { id: string } }>('/api/devices/:id/approve', async (request: any, reply) => {
    if (request.user?.role !== 'admin') return reply.code(403).send({ error: 'Admin only' });
    const existing = await getDeviceById(request.params.id);
    if (!existing) throw AppError.notFound('Device not found');
    const device = await approveDevice(request.params.id);
    return reply.send(device);
  });

  app.patch<{ Params: { id: string }; Body: { name?: string; attributes?: Record<string, unknown> } }>('/api/devices/:id', async (request: any, reply) => {
    const db = getDb();
    const permitted = await checkDevicePermission(request.user?.sub || '', request.user?.role || '', request.params.id, 'manage');
    if (!permitted) return reply.code(403).send({ error: 'Access denied' });
    const existing = await getDeviceById(request.params.id);
    if (!existing) throw AppError.notFound('Device not found');

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (request.body.name?.trim()) updates.name = request.body.name.trim();
    if (request.body.attributes) {
      updates.attributes = { ...(existing.attributes || {}), ...request.body.attributes };
    }
    const result = await db.update(devices).set(updates).where(eq(devices.id, request.params.id)).returning();
    return reply.send(result[0]);
  });

  app.delete<{ Params: { id: string } }>('/api/devices/:id', async (request: any, reply) => {
    const permitted = await checkDevicePermission(request.user?.sub || '', request.user?.role || '', request.params.id, 'admin');
    if (!permitted) return reply.code(403).send({ error: 'Access denied' });
    const device = await getDeviceById(request.params.id);
    if (!device) throw AppError.notFound('Device not found');
    await deleteDeviceById(request.params.id);
    return reply.code(204).send();
  });
}
