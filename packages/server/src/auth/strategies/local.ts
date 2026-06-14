import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { getDb } from '../../db/connection.js';
import { users } from '../../db/schema.js';
import type { AuthStrategy } from './strategy.js';
import { signToken, authMiddleware } from '../utils.js';

const SALT_ROUNDS = 10;

export async function registerUser(email: string, name: string, password: string) {
  const db = getDb();
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const result = await db.insert(users).values({ email, name, passwordHash: hash, authProvider: 'local' }).returning();
  return result[0];
}

export async function authenticateLocalUser(email: string, password: string) {
  const db = getDb();
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (result.length === 0) return null;
  const user = result[0];
  if (!user.passwordHash) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;
  return user;
}

export const localStrategy: AuthStrategy = {
  id: 'local',
  name: 'Email & Password',
  type: 'form',
  enabled: true,

  registerRoutes(app: FastifyInstance) {
    // Register first admin user (only works if no users exist yet)
    app.post('/api/auth/register', async (request: any, reply: any) => {
      try {
        const db = getDb();
        const existing = await db.select().from(users).limit(1);
        if (existing.length > 0) {
          return reply.code(403).send({ error: 'Setup already completed' });
        }

        const { email, name, password } = request.body || {};
        if (!email || !name || !password || password.length < 6) {
          return reply.code(400).send({ error: 'Email, name, and password (6+ chars) required' });
        }

        const user = await registerUser(email, name, password);
        const token = signToken(user.id, email, 'admin');
        return reply.send({ token, user: { id: user.id, email, name, role: 'admin', authProvider: 'local' } });
      } catch (err: any) {
        if (err?.code === '23505') return reply.code(409).send({ error: 'Email already exists' });
        request.log.error(err, 'Registration failed');
        return reply.code(500).send({ error: 'Internal server error' });
      }
    });

    // Local login
    app.post('/api/auth/login', async (request: any, reply: any) => {
      try {
        const { email, password } = request.body || {};
        if (!email || !password) {
          return reply.code(400).send({ error: 'Email and password required' });
        }

        const user = await authenticateLocalUser(email, password);
        if (!user) {
          return reply.code(401).send({ error: 'Invalid email or password' });
        }

        const token = signToken(user.id, user.email, user.role);
        return reply.send({
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            authProvider: user.authProvider,
            createdAt: user.createdAt,
          },
        });
      } catch (err: any) {
        request.log.error(err, 'Login failed');
        return reply.code(500).send({ error: 'Internal server error' });
      }
    });

    // Verify token / get current user
    app.get('/api/auth/me', { preHandler: authMiddleware }, async (request: any, reply: any) => {
      return reply.send({ user: request.user });
    });
  },
};
