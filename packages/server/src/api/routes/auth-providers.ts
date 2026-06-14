import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { authProviders } from '../../db/schema.js';
import { authMiddleware } from '../../auth/index.js';

const PROVIDER_TYPES = ['ldap', 'oidc', 'oauth2', 'saml'] as const;

export function registerAuthProviderRoutes(app: FastifyInstance) {
  // All routes require admin auth
  app.addHook('preHandler', (request, reply, done) => {
    if (request.url.startsWith('/api/settings/auth-providers')) {
      return authMiddleware(request, reply);
    }
    done();
  });

  // List all configured auth providers
  app.get('/api/settings/auth-providers', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const db = getDb();
      const result = await db.select().from(authProviders).orderBy(authProviders.createdAt);
      return reply.send(result);
    } catch (err: any) {
      _request.log.error(err, 'Failed to list auth providers');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create a new auth provider
  app.post('/api/settings/auth-providers', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { providerType, name, enabled, config } = body;

      if (!providerType || !PROVIDER_TYPES.includes(providerType as any)) {
        return reply.code(400).send({ error: 'Invalid provider type. Must be ldap, oidc, oauth2, or saml' });
      }
      if (!name || typeof name !== 'string') {
        return reply.code(400).send({ error: 'Name is required' });
      }

      const db = getDb();
      const result = await db.insert(authProviders).values({
        providerType: providerType as string,
        name: name as string,
        enabled: enabled === true,
        config: (config as Record<string, unknown>) || {},
      } as any).returning();

      return reply.code(201).send(result[0]);
    } catch (err: any) {
      request.log.error(err, 'Failed to create auth provider');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update an auth provider
  app.patch('/api/settings/auth-providers/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const db = getDb();

      const existing = await db.select().from(authProviders).where(eq(authProviders.id, id)).limit(1);
      if (existing.length === 0) {
        return reply.code(404).send({ error: 'Auth provider not found' });
      }

      const updates: any = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.enabled !== undefined) updates.enabled = body.enabled === true;
      if (body.providerType !== undefined) {
        if (!PROVIDER_TYPES.includes(body.providerType as any)) {
          return reply.code(400).send({ error: 'Invalid provider type' });
        }
        updates.providerType = body.providerType;
      }
      if (body.config !== undefined) updates.config = body.config;
      updates.updatedAt = new Date();

      const result = await db.update(authProviders)
        .set(updates)
        .where(eq(authProviders.id, id))
        .returning();

      return reply.send(result[0]);
    } catch (err: any) {
      request.log.error(err, 'Failed to update auth provider');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Toggle provider enabled/disabled
  app.patch('/api/settings/auth-providers/:id/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const db = getDb();

      const existing = await db.select().from(authProviders).where(eq(authProviders.id, id)).limit(1);
      if (existing.length === 0) {
        return reply.code(404).send({ error: 'Auth provider not found' });
      }

      const result = await db.update(authProviders)
        .set({ enabled: !existing[0].enabled, updatedAt: new Date() } as any)
        .where(eq(authProviders.id, id))
        .returning();

      return reply.send(result[0]);
    } catch (err: any) {
      request.log.error(err, 'Failed to toggle auth provider');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete an auth provider
  app.delete('/api/settings/auth-providers/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const db = getDb();
      const result = await db.delete(authProviders).where(eq(authProviders.id, id)).returning();
      if (result.length === 0) {
        return reply.code(404).send({ error: 'Auth provider not found' });
      }
      return reply.code(204).send();
    } catch (err: any) {
      request.log.error(err, 'Failed to delete auth provider');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
