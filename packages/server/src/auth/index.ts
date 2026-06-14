import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/connection.js';
import { users } from '../db/schema.js';
import { config } from '../config/index.js';

const SALT_ROUNDS = 10;

export function signToken(userId: string, email: string, role: string): string {
  return jwt.sign({ sub: userId, email, role }, config.jwtSecret, { expiresIn: '7d' });
}

export function verifyToken(token: string): { sub: string; email: string; role: string } | null {
  try {
    return jwt.verify(token, config.jwtSecret) as any;
  } catch {
    return null;
  }
}

export async function registerUser(email: string, name: string, password: string) {
  const db = getDb();
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const result = await db.insert(users).values({ email, name, passwordHash: hash }).returning();
  return result[0];
}

export async function authenticateUser(email: string, password: string) {
  const db = getDb();
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (result.length === 0) return null;
  const user = result[0] as any;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;
  return user;
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  const payload = verifyToken(auth.slice(7));
  if (!payload) {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
  (request as any).user = payload;
}

export function registerAuthRoutes(app: FastifyInstance) {
  // Register first admin user (only works if no users exist yet)
  app.post('/api/auth/register', async (request, reply) => {
    try {
      const db = getDb();
      const existing = await db.select().from(users).limit(1);
      if (existing.length > 0) {
        return reply.code(403).send({ error: 'Setup already completed' });
      }

      const { email, name, password } = request.body as any;
      if (!email || !name || !password || password.length < 6) {
        return reply.code(400).send({ error: 'Email, name, and password (6+ chars) required' });
      }

      const user = await registerUser(email, name, password);
      const token = signToken(user.id as string, email, 'admin');
      return reply.send({ token, user: { id: user.id, email, name, role: 'admin' } });
    } catch (err: any) {
      if (err.code === '23505') return reply.code(409).send({ error: 'Email already exists' });
      request.log.error(err, 'Registration failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Login
  app.post('/api/auth/login', async (request, reply) => {
    try {
      const { email, password } = request.body as any;
      if (!email || !password) {
        return reply.code(400).send({ error: 'Email and password required' });
      }

      const user = await authenticateUser(email, password);
      if (!user) {
        return reply.code(401).send({ error: 'Invalid email or password' });
      }

      const token = signToken(user.id, user.email, user.role);
      return reply.send({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (err: any) {
      request.log.error(err, 'Login failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Verify token / get current user
  app.get('/api/auth/me', { preHandler: authMiddleware }, async (request, reply) => {
    const user = (request as any).user;
    return reply.send({ user });
  });
}
