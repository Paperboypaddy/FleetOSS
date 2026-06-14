import type { FastifyInstance } from 'fastify';
import type { AuthStrategy } from './strategies/strategy.js';
import { localStrategy } from './strategies/local.js';
import { ldapStrategy } from './strategies/ldap.js';
import { oidcStrategy } from './strategies/oidc.js';
import { oauth2Strategy } from './strategies/oauth2.js';
import { samlStrategy } from './strategies/saml.js';
import { getDb } from '../db/connection.js';
import { authProviders } from '../db/schema.js';
import { signToken } from './utils.js';
import { registerDbProviderRoutes } from './db-router.js';

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
  // Provider list endpoint (public)
  app.get('/api/auth/providers', async () => {
    return getEnabledProviders();
  });

  // Register env-strategy routes
  for (const strategy of envStrategies) {
    if (strategy.enabled && strategy.registerRoutes) {
      strategy.registerRoutes(app);
    }
  }
}

// Called after DB providers are loaded at startup
export async function registerDbAuthRoutes(app: FastifyInstance) {
  const providers = await getDbProviders();
  for (const p of providers) {
    if (p.enabled) {
      registerDbProviderRoutes(app, p);
    }
  }
}

// Re-export utilities for use by other modules
export { signToken, verifyToken, authMiddleware } from './utils.js';
