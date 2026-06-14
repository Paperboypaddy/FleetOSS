import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { groups, groupDevices, userGroups, devices, users } from '../../db/schema.js';
import { authMiddleware } from '../../auth/index.js';
import { AppError } from '../errors.js';
import { parsePagination, paginatedResponse } from '../pagination.js';

const PERMISSION_LEVELS = ['view', 'manage', 'admin'] as const;

function requireAdmin(request: any, reply: any): boolean {
  if (request.user?.role !== 'admin') {
    reply.code(403).send({ error: 'Admin access required' });
    return false;
  }
  return true;
}

export function registerGroupRoutes(app: FastifyInstance) {
  app.addHook('preHandler', (request, reply, done) => {
    if (request.url.startsWith('/api/groups')) {
      return authMiddleware(request, reply);
    }
    done();
  });

  // ── Groups ──

  app.get('/api/groups', async (request: any, reply: FastifyReply) => {
    if (!requireAdmin(request, reply)) return;
    const { page, limit, offset } = parsePagination(request.query as Record<string, string>);
    const db = getDb();
    const [data, countResult] = await Promise.all([
      db.select().from(groups).orderBy(groups.name).offset(offset).limit(limit),
      db.select({ count: sql`count(*)` }).from(groups),
    ]);
    return reply.send(paginatedResponse(data, Number(countResult[0].count), page, limit));
  });

  app.post('/api/groups', async (request: any, reply) => {
    if (!requireAdmin(request, reply)) return;
    const body = request.body as { name?: string; description?: string };
    if (!body.name || typeof body.name !== 'string') {
      return reply.code(400).send({ error: 'Name is required' });
    }
    const db = getDb();
    const result = await db.insert(groups).values({ name: body.name, description: body.description || null }).returning();
    return reply.code(201).send(result[0]);
  });

  app.patch('/api/groups/:id', async (request: any, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; description?: string };
    const db = getDb();
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    const result = await db.update(groups).set(updates).where(eq(groups.id, id)).returning();
    if (!result.length) throw AppError.notFound('Group not found');
    return reply.send(result[0]);
  });

  app.delete('/api/groups/:id', async (request: any, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const db = getDb();
    const result = await db.delete(groups).where(eq(groups.id, id)).returning();
    if (!result.length) throw AppError.notFound('Group not found');
    return reply.code(204).send();
  });

  // ── Group Device Assignments ──

  app.get('/api/groups/:id/devices', async (request: any, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const db = getDb();
    const assignments = await db.select({
      deviceId: groupDevices.deviceId,
      permission: groupDevices.permission,
      deviceName: devices.name,
      deviceUniqueId: devices.uniqueId,
    }).from(groupDevices)
      .leftJoin(devices, eq(groupDevices.deviceId, devices.id))
      .where(eq(groupDevices.groupId, id));
    return reply.send(assignments);
  });

  app.post('/api/groups/:id/devices', async (request: any, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = request.body as { deviceId?: string; permission?: string };
    if (!body.deviceId) return reply.code(400).send({ error: 'deviceId required' });
    const perm = body.permission && PERMISSION_LEVELS.includes(body.permission as any) ? body.permission : 'view';
    const db = getDb();
    const result = await db.insert(groupDevices).values({
      groupId: id, deviceId: body.deviceId, permission: perm as string,
    } as any).returning();
    return reply.code(201).send(result[0]);
  });

  app.patch('/api/groups/:groupId/devices/:deviceId', async (request: any, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { groupId, deviceId } = request.params as { groupId: string; deviceId: string };
    const body = request.body as { permission?: string };
    if (!body.permission || !PERMISSION_LEVELS.includes(body.permission as any)) {
      return reply.code(400).send({ error: 'Valid permission required (view/manage/admin)' });
    }
    const db = getDb();
    const result = await db.update(groupDevices)
      .set({ permission: body.permission } as any)
      .where(and(eq(groupDevices.groupId, groupId), eq(groupDevices.deviceId, deviceId)))
      .returning();
    if (!result.length) throw AppError.notFound('Assignment not found');
    return reply.send(result[0]);
  });

  app.delete('/api/groups/:groupId/devices/:deviceId', async (request: any, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { groupId, deviceId } = request.params as { groupId: string; deviceId: string };
    const db = getDb();
    await db.delete(groupDevices)
      .where(and(eq(groupDevices.groupId, groupId), eq(groupDevices.deviceId, deviceId)));
    return reply.code(204).send();
  });

  // ── User Group Assignments ──

  app.get('/api/groups/:id/users', async (request: any, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const db = getDb();
    const members = await db.select({
      userId: userGroups.userId,
      userEmail: users.email,
      userName: users.name,
      userRole: users.role,
    }).from(userGroups)
      .leftJoin(users, eq(userGroups.userId, users.id))
      .where(eq(userGroups.groupId, id));
    return reply.send(members);
  });

  app.post('/api/groups/:id/users', async (request: any, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = request.body as { userId?: string };
    if (!body.userId) return reply.code(400).send({ error: 'userId required' });
    const db = getDb();
    const result = await db.insert(userGroups).values({ groupId: id, userId: body.userId }).returning();
    return reply.code(201).send(result[0]);
  });

  app.delete('/api/groups/:groupId/users/:userId', async (request: any, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { groupId, userId } = request.params as { groupId: string; userId: string };
    const db = getDb();
    await db.delete(userGroups).where(and(eq(userGroups.groupId, groupId), eq(userGroups.userId, userId)));
    return reply.code(204).send();
  });

  // ── User's groups summary (for current user or admin lookup) ──

  app.get('/api/users/:id/groups', async (request: any, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const db = getDb();
    const result = await db.select({
      groupId: userGroups.groupId,
      groupName: groups.name,
    }).from(userGroups)
      .leftJoin(groups, eq(userGroups.groupId, groups.id))
      .where(eq(userGroups.userId, id));
    return reply.send(result);
  });
}
