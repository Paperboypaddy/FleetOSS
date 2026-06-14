import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { getDb } from '../../db/connection.js';
import { users } from '../../db/schema.js';
import { authMiddleware } from '../../auth/index.js';

export function registerUserRoutes(app: FastifyInstance) {
  // All user management routes require admin auth
  app.addHook('preHandler', (request, reply, done) => {
    if (request.url.startsWith('/api/users')) {
      return authMiddleware(request, reply);
    }
    done();
  });

  // List all users
  app.get('/api/users', async (request, reply) => {
    try {
      const db = getDb();
      const result = await db.select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      }).from(users).orderBy(users.createdAt);
      return reply.send(result);
    } catch (err: any) {
      request.log.error(err, 'Failed to list users');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create a new user
  app.post('/api/users', async (request, reply) => {
    try {
      const { email, name, password, role } = request.body as any;
      if (!email || !name || !password || password.length < 6) {
        return reply.code(400).send({ error: 'Email, name, and password (6+ chars) required' });
      }
      const validRole = role === 'admin' || role === 'manager' || role === 'viewer' ? role : 'viewer';

      const hash = await bcrypt.hash(password, 10);
      const db = getDb();
      const result = await db.insert(users).values({ email, name, passwordHash: hash, role: validRole }).returning({
        id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt,
      });
      return reply.code(201).send(result[0]);
    } catch (err: any) {
      if (err.code === '23505') return reply.code(409).send({ error: 'Email already exists' });
      request.log.error(err, 'Failed to create user');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete a user
  app.delete<{ Params: { id: string } }>('/api/users/:id', async (request, reply) => {
    try {
      const db = getDb();
      const result = await db.delete(users).where(eq(users.id, request.params.id)).returning();
      if (result.length === 0) return reply.code(404).send({ error: 'User not found' });
      return reply.code(204).send();
    } catch (err: any) {
      request.log.error(err, 'Failed to delete user');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
