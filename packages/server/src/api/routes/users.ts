import type { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { getDb } from '../../db/connection.js';
import { users } from '../../db/schema.js';
import { authMiddleware } from '../../auth/index.js';
import { AppError } from '../errors.js';
import { parsePagination, paginatedResponse } from '../pagination.js';

function requireAdmin(request: any, reply: any): boolean {
  if (request.user?.role !== 'admin') {
    reply.code(403).send({ error: 'Admin access required' });
    return false;
  }
  return true;
}

export function registerUserRoutes(app: FastifyInstance) {
  app.addHook('preHandler', (request, reply, done) => {
    if (request.url.startsWith('/api/users')) {
      return authMiddleware(request, reply);
    }
    done();
  });

  app.get('/api/users', async (request: any, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { page, limit, offset } = parsePagination(request.query as Record<string, string>);
    const db = getDb();
    const [data, countResult] = await Promise.all([
      db.select({
        id: users.id, email: users.email, name: users.name, role: users.role,
        authProvider: users.authProvider, authProviderId: users.authProviderId, createdAt: users.createdAt,
      }).from(users).orderBy(users.createdAt).offset(offset).limit(limit),
      db.select({ count: sql<number>`count(*)` }).from(users),
    ]);
    return reply.send(paginatedResponse(data, Number(countResult[0].count), page, limit));
  });

  app.post<{ Body: { email?: string; name?: string; password?: string; role?: string } }>('/api/users', async (request: any, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { email, name, password, role } = request.body;
    if (!email || !name || !password || password.length < 6) {
      return reply.code(400).send({ error: 'Email, name, and password (6+ chars) required' });
    }
    const validRole = role === 'admin' || role === 'manager' || role === 'viewer' ? role : 'viewer';
    const hash = await bcrypt.hash(password, 10);
    const db = getDb();
    const result = await db.insert(users).values({ email, name, passwordHash: hash, role: validRole, authProvider: 'local' }).returning({
      id: users.id, email: users.email, name: users.name, role: users.role,
      authProvider: users.authProvider, authProviderId: users.authProviderId, createdAt: users.createdAt,
    });
    return reply.code(201).send(result[0]);
  });

  app.delete<{ Params: { id: string } }>('/api/users/:id', async (request: any, reply) => {
    if (!requireAdmin(request, reply)) return;
    const db = getDb();
    const result = await db.delete(users).where(eq(users.id, request.params.id)).returning();
    if (result.length === 0) throw AppError.notFound('User not found');
    return reply.code(204).send();
  });
}
