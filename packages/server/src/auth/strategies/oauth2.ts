import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { getDb } from '../../db/connection.js';
import { users } from '../../db/schema.js';
import type { AuthStrategy } from './strategy.js';
import { config } from '../../config/index.js';
import { signToken } from '../utils.js';
import { eq } from 'drizzle-orm';

interface OAuth2State {
  state: string;
  redirectTo: string;
  expiresAt: number;
}

const stateStore = new Map<string, OAuth2State>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of stateStore) {
    if (val.expiresAt < now) stateStore.delete(key);
  }
}, 300_000);

async function findOrCreateOAuth2User(email: string, name: string, providerId: string) {
  const db = getDb();
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    const u = existing[0];
    if (u.authProvider !== 'oauth2') {
      await db.update(users)
        .set({ authProvider: 'oauth2', authProviderId: providerId })
        .where(eq(users.id, u.id));
    }
    return u;
  }
  const result = await db.insert(users).values({
    email,
    name,
    passwordHash: null,
    role: config.auth.oauth2.defaultRole || 'viewer',
    authProvider: 'oauth2',
    authProviderId: providerId,
  }).returning();
  return result[0];
}

export const oauth2Strategy: AuthStrategy = {
  id: 'oauth2',
  name: 'Single Sign-On (OAuth2)',
  type: 'redirect',
  enabled: config.auth.oauth2.enabled,
  loginUrl: '/api/auth/oauth2/login',

  registerRoutes(app: FastifyInstance) {
    if (!config.auth.oauth2.enabled) return;

    // Initiate OAuth2 login
    app.get('/api/auth/oauth2/login', async (request: any, reply: any) => {
      try {
        const oa2Config = config.auth.oauth2;
        const state = crypto.randomBytes(32).toString('hex');
        const redirectTo = (request.query?.redirect || '/') as string;

        stateStore.set(state, {
          state,
          redirectTo,
          expiresAt: Date.now() + 600_000,
        });

        const params = new URLSearchParams({
          client_id: oa2Config.clientId,
          redirect_uri: oa2Config.redirectUri,
          response_type: 'code',
          scope: oa2Config.scope,
          state,
        });

        return reply.redirect(302, `${oa2Config.authorizeUrl}?${params.toString()}`);
      } catch (err: any) {
        request.log.error(err, 'OAuth2 login initiation failed');
        return reply.code(500).send({ error: 'Failed to initiate SSO login' });
      }
    });

    // OAuth2 callback
    app.get('/api/auth/oauth2/callback', async (request: any, reply: any) => {
      try {
        const oa2Config = config.auth.oauth2;
        const { code, state } = request.query as { code?: string; state?: string };

        if (!code || !state) {
          return reply.code(400).send({ error: 'Missing authorization code or state' });
        }

        const stored = stateStore.get(state);
        if (!stored) {
          return reply.code(400).send({ error: 'Invalid state parameter' });
        }
        stateStore.delete(state);

        // Exchange authorization code for access token
        const tokenParams = new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: oa2Config.redirectUri,
          client_id: oa2Config.clientId,
          client_secret: oa2Config.clientSecret,
        });

        const tokenRes = await fetch(oa2Config.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: tokenParams.toString(),
        });

        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          request.log.error({ status: tokenRes.status, body: errText }, 'Token exchange failed');
          return reply.code(401).send({ error: 'Failed to exchange authorization code' });
        }

        const tokenData: any = await tokenRes.json();
        const accessToken = tokenData.access_token;

        // Fetch user info
        const userInfoRes = await fetch(oa2Config.userInfoUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!userInfoRes.ok) {
          return reply.code(401).send({ error: 'Failed to fetch user info' });
        }

        const userInfo: any = await userInfoRes.json();
        const email = userInfo[oa2Config.emailField];
        const name = userInfo[oa2Config.nameField] || email?.split('@')[0] || 'User';
        const providerId = userInfo.sub || userInfo.id || userInfo.email;

        if (!email) {
          return reply.code(400).send({ error: 'Email not provided by identity provider' });
        }

        const user = await findOrCreateOAuth2User(email, name, providerId);
        const token = signToken(user.id, user.email, user.role);

        const frontendUrl = config.baseUrl.replace(/:\d+$/, ':5173');
        return reply.redirect(302, `${frontendUrl}/#/sso?token=${token}&user=${encodeURIComponent(JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          authProvider: 'oauth2',
          createdAt: user.createdAt,
        }))}`);
      } catch (err: any) {
        request.log.error(err, 'OAuth2 callback failed');
        return reply.code(401).send({ error: 'SSO authentication failed' });
      }
    });
  },
};
