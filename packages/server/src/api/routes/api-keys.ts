import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { eq, or, and } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { apiKeys } from '../../db/schema.js';
import { authMiddleware } from '../../auth/index.js';
import { AppError } from '../errors.js';

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = `foss_${crypto.randomBytes(24).toString('base64url')}`;
  const hash = hashKey(raw);
  const prefix = raw.slice(0, 12) + '...';
  return { raw, hash, prefix };
}

/** Returns a WHERE filter: user sees own keys, admin sees all */
function keyAccessFilter(userId: string, userRole: string) {
  if (userRole === 'admin') return undefined;
  return eq(apiKeys.userId, userId);
}

export function registerApiKeyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', (request, reply, done) => {
    if (request.url.startsWith('/api/settings/api-keys')) {
      return authMiddleware(request, reply);
    }
    done();
  });

  // List API keys (scoped to current user, admin sees all)
  app.get('/api/settings/api-keys', async (request: any, reply: FastifyReply) => {
    try {
      const db = getDb();
      const filter = keyAccessFilter(request.user?.sub || '', request.user?.role || '');
      const keys = await db.select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        userId: apiKeys.userId,
        permissions: apiKeys.permissions,
        enabled: apiKeys.enabled,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      }).from(apiKeys).where(filter || undefined).orderBy(apiKeys.createdAt);
      return reply.send(keys);
    } catch (err: any) {
      request.log.error(err, 'Failed to list API keys');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create a new API key (owned by current user)
  app.post('/api/settings/api-keys', async (request: any, reply: FastifyReply) => {
    try {
      const body = request.body as { name?: string; permissions?: string[] };
      if (!body.name || typeof body.name !== 'string') {
        return reply.code(400).send({ error: 'Name is required' });
      }

      const { raw, hash, prefix } = generateApiKey();
      const db = getDb();
      const result = await db.insert(apiKeys).values({
        name: body.name,
        keyHash: hash,
        keyPrefix: prefix,
        userId: request.user?.sub || null,
        permissions: body.permissions || ['read'],
      }).returning();

      return reply.code(201).send({
        id: result[0].id,
        name: result[0].name,
        keyPrefix: result[0].keyPrefix,
        userId: result[0].userId,
        permissions: result[0].permissions,
        enabled: result[0].enabled,
        createdAt: result[0].createdAt,
        key: raw,
      });
    } catch (err: any) {
      request.log.error(err, 'Failed to create API key');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete an API key (own keys only, admin can delete any)
  app.delete('/api/settings/api-keys/:id', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const db = getDb();
      const userId = request.user?.sub || '';
      const userRole = request.user?.role || '';

      const existing = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
      if (existing.length === 0) return reply.code(404).send({ error: 'API key not found' });

      // Check ownership or admin
      if (existing[0].userId !== userId && userRole !== 'admin') {
        return reply.code(403).send({ error: 'Access denied' });
      }

      await db.delete(apiKeys).where(eq(apiKeys.id, id));
      return reply.code(204).send();
    } catch (err: any) {
      request.log.error(err, 'Failed to delete API key');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Toggle API key enabled/disabled (own keys only, admin can toggle any)
  app.patch('/api/settings/api-keys/:id/toggle', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const db = getDb();
      const userId = request.user?.sub || '';
      const userRole = request.user?.role || '';

      const existing = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
      if (existing.length === 0) return reply.code(404).send({ error: 'API key not found' });

      if (existing[0].userId !== userId && userRole !== 'admin') {
        return reply.code(403).send({ error: 'Access denied' });
      }

      const result = await db.update(apiKeys)
        .set({ enabled: !existing[0].enabled })
        .where(eq(apiKeys.id, id))
        .returning();
      return reply.send(result[0]);
    } catch (err: any) {
      request.log.error(err, 'Failed to toggle API key');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
