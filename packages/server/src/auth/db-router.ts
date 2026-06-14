import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as client from 'openid-client';
import * as samlify from 'samlify';
import crypto from 'node:crypto';
import { getDb } from '../db/connection.js';
import { users } from '../db/schema.js';
import { config } from '../config/index.js';
import { signToken } from './utils.js';
import { eq } from 'drizzle-orm';

// In-memory state store for OIDC/OAuth2 flows
const stateStore = new Map<string, { codeVerifier?: string; state: string; redirectTo: string; expiresAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of stateStore) {
    if (val.expiresAt < now) stateStore.delete(key);
  }
}, 300_000);

async function findOrCreateUser(email: string, name: string, providerId: string, providerType: string) {
  const db = getDb();
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    const u = existing[0];
    if (u.authProvider !== providerType) {
      await db.update(users)
        .set({ authProvider: providerType as any, authProviderId: providerId })
        .where(eq(users.id, u.id));
    }
    return u;
  }
  const result = await db.insert(users).values({
    email,
    name,
    passwordHash: null,
    role: 'viewer',
    authProvider: providerType as any,
    authProviderId: providerId,
  }).returning();
  return result[0];
}

function redirectToFrontend(reply: any, token: string, user: any) {
  const frontendUrl = config.baseUrl.replace(/:\d+$/, ':5173');
  return reply.redirect(
    `${frontendUrl}/#/sso?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}` as any,
  );
}

// ── Register dynamic routes for a DB-backed provider ──
export function registerDbProviderRoutes(app: FastifyInstance, provider: any) {
  const pid = provider.id;

  switch (provider.providerType) {
    case 'ldap':
      registerLdapRoute(app, pid, provider.config);
      break;
    case 'oidc':
      registerOidcRoutes(app, pid, provider.config);
      break;
    case 'oauth2':
      registerOAuth2Routes(app, pid, provider.config);
      break;
    case 'saml':
      registerSamlRoutes(app, pid, provider.config);
      break;
  }
}

// ── LDAP ──
function registerLdapRoute(app: FastifyInstance, pid: string, cfg: any) {
  app.post(`/api/auth/db/${pid}/login`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { email, password } = request.body as { email?: string; password?: string };
      if (!email || !password) {
        return reply.code(400).send({ error: 'Email and password required' });
      }

      // Simple LDAP bind
      const ldap = await import('ldapjs');
      const ldapClient = ldap.default.createClient({ url: cfg.url });
      const userDn = (cfg.userDnTemplate || '').replace('{{email}}', email);

      await new Promise<void>((resolve, reject) => {
        ldapClient.bind(userDn, password, (err: Error | null) => {
          if (err) reject(new Error('LDAP authentication failed'));
          else resolve();
        });
      });

      const displayName = email.split('@')[0];
      const user = await findOrCreateUser(email, displayName, userDn, 'ldap');
      const token = signToken(user.id, user.email, user.role);
      return reply.send({
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, authProvider: 'ldap', createdAt: user.createdAt },
      });
    } catch (err: any) {
      request.log.error(err, 'LDAP login failed');
      return reply.code(401).send({ error: err.message || 'LDAP authentication failed' });
    }
  });
}

// ── OpenID Connect ──
function registerOidcRoutes(app: FastifyInstance, pid: string, cfg: any) {
  let oidcConfig: client.Configuration | null = null;

  async function getConfig() {
    if (oidcConfig) return oidcConfig;
    const { allowInsecureRequests } = await import('openid-client');
    allowInsecureRequests = true;
    oidcConfig = await client.discovery(new URL(cfg.issuer), cfg.clientId, cfg.clientSecret);
    return oidcConfig;
  }

  const nameClaim = cfg.nameClaim || 'name';
  const scope = cfg.scope || 'openid profile email';
  const redirectUri = cfg.redirectUri || `${config.baseUrl}/api/auth/db/${pid}/callback`;

  app.get(`/api/auth/db/${pid}/login`, async (request: any, reply: any) => {
    try {
      const oaConfig = await getConfig();
      const codeVerifier = client.randomPKCECodeVerifier();
      const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
      const state = client.randomState();

      const parameters: Record<string, string> = {
        redirect_uri: redirectUri,
        scope,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      };
      if (!oaConfig.serverMetadata().supportsPKCE()) {
        parameters.state = state;
      }

      const authUrl = client.buildAuthorizationUrl(oaConfig, parameters);
      stateStore.set(state, { codeVerifier, state, redirectTo: '/', expiresAt: Date.now() + 600000 });
      return reply.redirect(302, authUrl.href);
    } catch (err: any) {
      request.log.error(err, 'OIDC login failed');
      return reply.code(500).send({ error: 'Failed to initiate login' });
    }
  });

  app.get(`/api/auth/db/${pid}/callback`, async (request: any, reply: any) => {
    try {
      const oaConfig = await getConfig();
      const currentUrl = new URL(request.url, config.baseUrl);
      const params = Object.fromEntries(currentUrl.searchParams.entries());
      const stateParam = params.state || '';
      const stored = stateStore.get(stateParam);
      if (!stored) return reply.code(400).send({ error: 'Invalid state' });
      stateStore.delete(stateParam);

      const tokens = await client.authorizationCodeGrant(oaConfig, currentUrl, {
        pkceCodeVerifier: stored.codeVerifier,
        expectedState: stored.state,
      });
      const userInfo = await client.fetchUserInfo(oaConfig, tokens.access_token, '' as any, undefined);
      const email = (userInfo.email || userInfo.preferred_username || '') as string;
      const name = (userInfo[nameClaim] || userInfo.name || email.split('@')[0] || 'User') as string;
      if (!email) return reply.code(400).send({ error: 'Email not provided' });

      const user = await findOrCreateUser(email, name, userInfo.sub as string, 'oidc');
      const token = signToken(user.id, user.email, user.role);
      redirectToFrontend(reply, token, { id: user.id, email: user.email, name: user.name, role: user.role, authProvider: 'oidc', createdAt: user.createdAt });
    } catch (err: any) {
      request.log.error(err, 'OIDC callback failed');
      return reply.code(401).send({ error: 'SSO authentication failed' });
    }
  });
}

// ── OAuth2 ──
function registerOAuth2Routes(app: FastifyInstance, pid: string, cfg: any) {
  const nameField = cfg.nameField || 'name';
  const emailField = cfg.emailField || 'email';
  const scope = cfg.scope || 'openid profile email';
  const redirectUri = cfg.redirectUri || `${config.baseUrl}/api/auth/db/${pid}/callback`;

  app.get(`/api/auth/db/${pid}/login`, async (request: any, reply: any) => {
    try {
      const state = crypto.randomBytes(32).toString('hex');
      const params = new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope,
        state,
      });
      stateStore.set(state, { state, redirectTo: '/', expiresAt: Date.now() + 600000 });
      return reply.redirect(302, `${cfg.authorizeUrl}?${params.toString()}`);
    } catch (err: any) {
      request.log.error(err, 'OAuth2 login failed');
      return reply.code(500).send({ error: 'Failed to initiate login' });
    }
  });

  app.get(`/api/auth/db/${pid}/callback`, async (request: any, reply: any) => {
    try {
      const { code, state } = request.query as { code?: string; state?: string };
      if (!code || !state) return reply.code(400).send({ error: 'Missing code or state' });
      const stored = stateStore.get(state);
      if (!stored) return reply.code(400).send({ error: 'Invalid state' });
      stateStore.delete(state);

      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code', code,
        redirect_uri: redirectUri,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
      });
      const tokenRes = await fetch(cfg.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
      });
      if (!tokenRes.ok) return reply.code(401).send({ error: 'Token exchange failed' });
      const tokenData: any = await tokenRes.json();
      const accessToken = tokenData.access_token;

      const userInfoRes = await fetch(cfg.userInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userInfoRes.ok) return reply.code(401).send({ error: 'Failed to fetch user info' });
      const userInfo: any = await userInfoRes.json();
      const email = userInfo[emailField];
      const name = userInfo[nameField] || email?.split('@')[0] || 'User';
      const providerId = userInfo.sub || userInfo.id || email;
      if (!email) return reply.code(400).send({ error: 'Email not provided' });

      const user = await findOrCreateUser(email, name, providerId, 'oauth2');
      const token = signToken(user.id, user.email, user.role);
      redirectToFrontend(reply, token, { id: user.id, email: user.email, name: user.name, role: user.role, authProvider: 'oauth2', createdAt: user.createdAt });
    } catch (err: any) {
      request.log.error(err, 'OAuth2 callback failed');
      return reply.code(401).send({ error: 'SSO authentication failed' });
    }
  });
}

// ── SAML ──
function registerSamlRoutes(app: FastifyInstance, pid: string, cfg: any) {
  const callbackUrl = cfg.callbackUrl || `${config.baseUrl}/api/auth/db/${pid}/callback`;

  let spInstance: any = null;
  function getSp() {
    if (spInstance) return spInstance;
    spInstance = samlify.ServiceProvider({
      entityID: cfg.issuer || `fleetoss-${pid}`,
      authnRequestsSigned: false,
      wantAssertionsSigned: false,
      assertionConsumerService: [{
        Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
        Location: callbackUrl,
      }],
      privateKey: cfg.privateKey || undefined,
    });
    return spInstance;
  }

  let idpInstance: any = null;
  function getIdp() {
    if (idpInstance) return idpInstance;
    idpInstance = samlify.IdentityProvider({
      entityID: cfg.issuer || `fleetoss-${pid}`,
      singleSignOnService: [{
        Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
        Location: cfg.entryPoint,
      }],
      signingCert: cfg.cert || undefined,
    });
    return idpInstance;
  }

  app.get(`/api/auth/db/${pid}/login`, async (request: any, reply: any) => {
    try {
      const loginReq = getSp().createLoginRequest(getIdp(), 'redirect');
      return reply.redirect(loginReq.context as any);
    } catch (err: any) {
      request.log.error(err, 'SAML login failed');
      return reply.code(500).send({ error: 'Failed to initiate SAML login' });
    }
  });

  app.post(`/api/auth/db/${pid}/callback`, async (request: any, reply: any) => {
    try {
      const body = request.body as Record<string, unknown>;
      const response = await getSp().parseLoginResponse(getIdp(), 'post', { body });
      const attributes = response.extract?.attributes || {};
      const nameId = response.extract?.nameID || '';
      const emailAttr = cfg.emailAttribute || 'mail';
      const nameAttr = cfg.nameAttribute || 'cn';
      const email = (attributes[emailAttr]?.toString() || nameId || '') as string;
      const name = (attributes[nameAttr]?.toString() || email?.split('@')[0] || 'User') as string;
      if (!email) return reply.code(400).send({ error: 'Email not provided' });

      const user = await findOrCreateUser(email, name, nameId, 'saml');
      const token = signToken(user.id, user.email, user.role);
      redirectToFrontend(reply, token, { id: user.id, email: user.email, name: user.name, role: user.role, authProvider: 'saml', createdAt: user.createdAt });
    } catch (err: any) {
      request.log.error(err, 'SAML callback failed');
      return reply.code(401).send({ error: 'SAML authentication failed' });
    }
  });
}
