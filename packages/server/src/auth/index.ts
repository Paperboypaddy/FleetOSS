import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import type { AuthStrategy } from './strategies/strategy.js';
import { localStrategy } from './strategies/local.js';
import { ldapStrategy } from './strategies/ldap.js';
import { oidcStrategy } from './strategies/oidc.js';
import { oauth2Strategy } from './strategies/oauth2.js';
import { samlStrategy } from './strategies/saml.js';
import { getDb } from '../db/connection.js';
import { users, authProviders } from '../db/schema.js';
import { signToken, verifyToken, authMiddleware } from './utils.js';
import { registerDbProviderRoutes, registerGenericDbRoutes, getProviderLogoutUrl } from './db-router.js';

const envStrategies: AuthStrategy[] = [
  localStrategy,
  ldapStrategy,
  oidcStrategy,
  oauth2Strategy,
  samlStrategy,
];

async function getDbProviders() {
  try {
    const db = getDb();
    return await db.select().from(authProviders).orderBy(authProviders.createdAt);
  } catch {
    return [];
  }
}

export async function getEnabledProviders() {
  const envProviders = envStrategies
    .filter(s => s.enabled)
    .map(s => ({
      id: s.id,
      name: s.name,
      type: s.type,
      loginUrl: s.loginUrl,
    }));

  const dbProviders = await getDbProviders();
  const dbActive = dbProviders
    .filter(p => p.enabled)
    .map(p => ({
      id: p.id,
      name: p.name,
      type: p.providerType === 'ldap' ? 'form' as const : 'redirect' as const,
      loginUrl: p.providerType !== 'ldap' ? `/api/auth/db/${p.id}/login` : undefined,
    }));

  return [...envProviders, ...dbActive];
}

export function getStrategy(id: string): AuthStrategy | undefined {
  return envStrategies.find(s => s.id === id);
}

export function registerAuthRoutes(app: FastifyInstance) {
  app.get('/api/auth/providers', async () => getEnabledProviders());

  for (const strategy of envStrategies) {
    if (strategy.enabled && strategy.registerRoutes) {
      strategy.registerRoutes(app);
    }
  }

  // SSO-aware logout
  app.get('/api/auth/logout', { preHandler: authMiddleware }, async (request: any, reply: any) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
    const db = getDb();
    const result = await db.select().from(users).where(eq(users.email, request.user.email)).limit(1);
    if (result.length === 0) return reply.send({ logoutUrl: null });
    const user = result[0];

    if (user.authProvider !== 'local' && user.authProvider !== 'ldap') {
      const dbProviders = await getDbProviders();
      const provider = dbProviders.find(p => p.enabled && p.providerType === user.authProvider);
      if (provider) {
        const logoutUrl = getProviderLogoutUrl(provider);
        return reply.send({ logoutUrl });
      }
    }
    return reply.send({ logoutUrl: null });
  });
}

export async function registerDbAuthRoutes(app: FastifyInstance) {
  const providers = await getDbProviders();
  for (const p of providers) {
    if (p.enabled) {
      registerDbProviderRoutes(app, p);
    }
  }
  // Generic routes handle any provider by ID (works for runtime-created providers)
  registerGenericDbRoutes(app);
}

export { signToken, verifyToken, authMiddleware } from './utils.js';
