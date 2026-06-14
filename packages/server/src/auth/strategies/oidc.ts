import type { FastifyInstance } from 'fastify';
import * as client from 'openid-client';
import { getDb } from '../../db/connection.js';
import { users } from '../../db/schema.js';
import type { AuthStrategy } from './strategy.js';
import { config } from '../../config/index.js';
import { signToken } from '../utils.js';
import { eq } from 'drizzle-orm';

interface OidcSession {
  codeVerifier: string;
  state: string;
  redirectTo: string;
  expiresAt: number;
}

const sessionStore = new Map<string, OidcSession>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of sessionStore) {
    if (val.expiresAt < now) sessionStore.delete(key);
  }
}, 300_000);

let oidcConfig: client.Configuration | null = null;

async function getOidcConfig() {
  if (oidcConfig) return oidcConfig;
  const { allowInsecureRequests } = await import('openid-client');
  allowInsecureRequests = true;
  const oa = config.auth.oidc;
  oidcConfig = await client.discovery(
    new URL(oa.issuer),
    oa.clientId,
    oa.clientSecret,
  );
  return oidcConfig;
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
        const oaConfig = await getOidcConfig();
        const codeVerifier = client.randomPKCECodeVerifier();
        const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
        const state = client.randomState();
        const redirectTo = (request.query?.redirect || '/') as string;

        const parameters: Record<string, string> = {
          redirect_uri: config.auth.oidc.redirectUri,
          scope: config.auth.oidc.scope,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
        };

        if (!oaConfig.serverMetadata().supportsPKCE()) {
          parameters.state = state;
        }

        const authUrl = client.buildAuthorizationUrl(oaConfig, parameters);

        sessionStore.set(state, {
          codeVerifier,
          state,
          redirectTo,
          expiresAt: Date.now() + 600_000,
        });

        return reply.redirect(302, authUrl.href);
      } catch (err: any) {
        request.log.error(err, 'OIDC login initiation failed');
        return reply.code(500).send({ error: 'Failed to initiate SSO login' });
      }
    });

    // OIDC callback
    app.get('/api/auth/oidc/callback', async (request: any, reply: any) => {
      try {
        const oaConfig = await getOidcConfig();
        const currentUrl = new URL(request.url, config.baseUrl);
        const params = Object.fromEntries(currentUrl.searchParams.entries());
        const stateParam = params.state || '';

        const stored = sessionStore.get(stateParam);
        if (!stored) {
          return reply.code(400).send({ error: 'Invalid state parameter' });
        }
        sessionStore.delete(stateParam);

        const tokens = await client.authorizationCodeGrant(
          oaConfig,
          currentUrl,
          {
            pkceCodeVerifier: stored.codeVerifier,
            expectedState: stored.state,
          },
        );

        // Fetch user info
        const userInfo = await client.fetchUserInfo(
          oaConfig,
          tokens.access_token,
          '' as any,
          undefined,
        );

        const email = (userInfo.email || userInfo.preferred_username || '') as string;
        const name = (userInfo[config.auth.oidc.nameClaim] || userInfo.name || email.split('@')[0] || 'User') as string;

        if (!email) {
          return reply.code(400).send({ error: 'Email not provided by identity provider' });
        }

        const user = await findOrCreateOidcUser(email, name, userInfo.sub as string);
        const token = signToken(user.id, user.email, user.role);

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
