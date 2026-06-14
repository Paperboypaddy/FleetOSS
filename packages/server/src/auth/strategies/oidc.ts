import type { FastifyInstance } from 'fastify';
import { Issuer, generators } from 'openid-client';
import { getDb } from '../../db/connection.js';
import { users } from '../../db/schema.js';
import type { AuthStrategy } from './strategy.js';
import { config } from '../../config/index.js';
import { signToken } from '../utils.js';
import { eq } from 'drizzle-orm';

// In-memory state store for OIDC nonce/state
const stateStore = new Map<string, { nonce: string; state: string; redirectTo: string; expiresAt: number }>();

// Cleanup expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of stateStore) {
    if (val.expiresAt < now) stateStore.delete(key);
  }
}, 300_000);

let cachedClient: any = null;
let cachedIssuer: any = null;

async function getOidcClient() {
  if (cachedClient) return cachedClient;
  const oidcConfig = config.auth.oidc;
  const issuer = await Issuer.discover(oidcConfig.issuer);
  cachedIssuer = issuer;
  cachedClient = new issuer.Client({
    client_id: oidcConfig.clientId,
    client_secret: oidcConfig.clientSecret,
    redirect_uris: [oidcConfig.redirectUri],
    response_types: ['code'],
  });
  return cachedClient;
}

async function findOrCreateOidcUser(email: string, name: string, sub: string) {
  const db = getDb();
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    const u = existing[0];
    if (u.authProvider !== 'oidc') {
      await db.update(users)
        .set({ authProvider: 'oidc', authProviderId: sub })
        .where(eq(users.id, u.id));
    }
    return u;
  }
  const result = await db.insert(users).values({
    email,
    name,
    passwordHash: null,
    role: config.auth.oidc.defaultRole || 'viewer',
    authProvider: 'oidc',
    authProviderId: sub,
  }).returning();
  return result[0];
}

export const oidcStrategy: AuthStrategy = {
  id: 'oidc',
  name: 'Single Sign-On (OpenID Connect)',
  type: 'redirect',
  enabled: config.auth.oidc.enabled,
  loginUrl: '/api/auth/oidc/login',

  registerRoutes(app: FastifyInstance) {
    if (!config.auth.oidc.enabled) return;

    // Initiate OIDC login
    app.get('/api/auth/oidc/login', async (request: any, reply: any) => {
      try {
        const client = await getOidcClient();
        const nonce = generators.nonce();
        const state = generators.state();
        const redirectTo = (request.query?.redirect || '/') as string;

        const url = client.authorizationUrl({
          scope: config.auth.oidc.scope,
          state,
          nonce,
        });

        stateStore.set(state, {
          nonce,
          state,
          redirectTo,
          expiresAt: Date.now() + 600_000, // 10 minutes
        });

        return reply.redirect(302, url);
      } catch (err: any) {
        request.log.error(err, 'OIDC login initiation failed');
        return reply.code(500).send({ error: 'Failed to initiate SSO login' });
      }
    });

    // OIDC callback
    app.get('/api/auth/oidc/callback', async (request: any, reply: any) => {
      try {
        const client = await getOidcClient();
        const params = client.callbackParams(request.url);
        const stored = stateStore.get(params.state as string);

        if (!stored) {
          return reply.code(400).send({ error: 'Invalid state parameter' });
        }
        stateStore.delete(params.state as string);

        const tokenSet = await client.callback(config.auth.oidc.redirectUri, params, {
          nonce: stored.nonce,
          state: stored.state,
        });

        const userinfo = await client.userinfo(tokenSet.access_token!);
        const email = userinfo.email || userinfo.preferred_username || '';
        const name = userinfo[config.auth.oidc.nameClaim] || userinfo.name || email.split('@')[0] || 'User';

        if (!email) {
          return reply.code(400).send({ error: 'Email not provided by identity provider' });
        }

        const user = await findOrCreateOidcUser(email, name, userinfo.sub);
        const token = signToken(user.id, user.email, user.role);

        // Redirect back to the frontend with the token as a hash fragment
        const frontendUrl = config.baseUrl.replace(/:\d+$/, ':5173');
        return reply.redirect(302, `${frontendUrl}/#/sso?token=${token}&user=${encodeURIComponent(JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          authProvider: 'oidc',
          createdAt: user.createdAt,
        }))}`);
      } catch (err: any) {
        request.log.error(err, 'OIDC callback failed');
        return reply.code(401).send({ error: 'SSO authentication failed' });
      }
    });
  },
};
