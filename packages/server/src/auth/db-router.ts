import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as client from 'openid-client';
import * as samlify from 'samlify';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { users, authProviders } from '../db/schema.js';
import { config } from '../config/index.js';
import { signToken } from './utils.js';

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

// ── OIDC config helper (manual construction to avoid HTTPS restriction) ──
async function createOidcConfig(cfg: any, redirectUri?: string) {
  const wellKnown = `${cfg.issuer}/.well-known/openid-configuration`;
  const resp = await fetch(wellKnown);
  if (!resp.ok) throw new Error(`Failed to fetch OIDC config from ${wellKnown}`);
  const metadata = await resp.json();

  const as = {
    issuer: metadata.issuer,
    authorization_endpoint: metadata.authorization_endpoint,
    token_endpoint: metadata.token_endpoint,
    userinfo_endpoint: metadata.userinfo_endpoint,
    jwks_uri: metadata.jwks_uri,
    scopes_supported: metadata.scopes_supported,
    response_types_supported: metadata.response_types_supported,
    subject_types_supported: metadata.subject_types_supported,
    id_token_signing_alg_values_supported: metadata.id_token_signing_alg_values_supported,
  };

  const oidcConfig = new client.Configuration(as, cfg.clientId, {
    client_secret: cfg.clientSecret,
    redirect_uris: redirectUri ? [redirectUri] : undefined,
  });
  client.allowInsecureRequests(oidcConfig);
  return oidcConfig;
}

export function getProviderLogoutUrl(provider: any): string | null {
  const cfg = provider.config;
  if (provider.providerType === 'oidc') {
    const endSession = `${cfg.issuer}/protocol/openid-connect/logout`;
    const redirect = encodeURIComponent(config.baseUrl.replace(/:\d+$/, ':5173'));
    return `${endSession}?redirect_uri=${redirect}`;
  }
  if (provider.providerType === 'oauth2' && cfg.endSessionUrl) {
    const redirect = encodeURIComponent(config.baseUrl.replace(/:\d+$/, ':5173'));
    return `${cfg.endSessionUrl}?redirect_uri=${redirect}`;
  }
  // SAML SLO would go here
  return null;
}

async function loadProviderConfig(pid: string) {
  const db = getDb();
  const result = await db.select().from(authProviders).where(eq(authProviders.id, pid)).limit(1);
  if (result.length === 0) return null;
  return result[0];
}

export function registerDbProviderRoutes(app: FastifyInstance, provider: any) {
  // Per-provider routes at startup (legacy — kept for backward compatibility)
  // Generic routes below handle all providers dynamically
  const _pid = provider.id;
  const _type = provider.providerType;
  switch (_type) {
    case 'ldap': registerLdapRoute(app, _pid, provider.config); break;
    case 'oidc': registerOidcRoutes(app, _pid, provider.config); break;
    case 'oauth2': registerOAuth2Routes(app, _pid, provider.config); break;
    case 'saml': registerSamlRoutes(app, _pid, provider.config); break;
  }
}

// ── Dynamic generic routes — handle any DB provider by ID ──
// These are registered once and work for any provider created at runtime
export function registerGenericDbRoutes(app: FastifyInstance) {
  // LDAP login
  app.post('/api/auth/db/:pid/login', async (request: any, reply: any) => {
    const { pid } = request.params as { pid: string };
    const prov = await loadProviderConfig(pid);
    if (!prov) return reply.code(404).send({ error: 'Provider not found' });
    const cfg = prov.config as Record<string, any>;

    if (prov.providerType !== 'ldap')
      return reply.code(400).send({ error: 'This endpoint is for LDAP providers' });

    const { email, password } = request.body as { email?: string; password?: string };
    if (!email || !password) return reply.code(400).send({ error: 'Email and password required' });
    try {
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
      return reply.send({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, authProvider: 'ldap', createdAt: user.createdAt } });
    } catch (err: any) {
      request.log.error(err, 'LDAP login failed');
      return reply.code(401).send({ error: err.message || 'LDAP authentication failed' });
    }
  });

  // Redirect-based login (OIDC, OAuth2, SAML)
  app.get('/api/auth/db/:pid/login', async (request: any, reply: any) => {
    const { pid } = request.params as { pid: string };
    const prov = await loadProviderConfig(pid);
    if (!prov) return reply.code(404).send({ error: 'Provider not found' });
    const cfg = prov.config as Record<string, any>;

    if (prov.providerType === 'oidc') {
      const redirectUri = (cfg.redirectUri as string) || `${config.baseUrl}/api/auth/db/${pid}/callback`;
      const scope = (cfg.scope as string) || 'openid profile email';
      const oaConfig = await createOidcConfig(cfg, redirectUri);
      const codeVerifier = client.randomPKCECodeVerifier();
      const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
      const state = client.randomState();
      const parameters: Record<string, string> = { redirect_uri: redirectUri, scope, code_challenge: codeChallenge, code_challenge_method: 'S256' };
      if (!oaConfig.serverMetadata().supportsPKCE()) parameters.state = state;
      const authUrl = client.buildAuthorizationUrl(oaConfig, parameters);
      stateStore.set(state, { codeVerifier, state, redirectTo: '/', expiresAt: Date.now() + 600000 });
      return reply.redirect(authUrl.href as any);
    }

    if (prov.providerType === 'oauth2') {
      const redirectUri = (cfg.redirectUri as string) || `${config.baseUrl}/api/auth/db/${pid}/callback`;
      const scope = (cfg.scope as string) || 'read';
      const state = crypto.randomBytes(32).toString('hex');
      const params = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: redirectUri, response_type: 'code', scope, state });
      stateStore.set(state, { state, redirectTo: '/', expiresAt: Date.now() + 600000 });
      return reply.redirect(`${cfg.authorizeUrl}?${params.toString()}` as any);
    }

    if (prov.providerType === 'saml') {
      const callbackUrl = (cfg.callbackUrl as string) || `${config.baseUrl}/api/auth/db/${pid}/callback`;
      const sp = samlify.ServiceProvider({
        entityID: (cfg.issuer as string) || `fleetoss-${pid}`,
        assertionConsumerService: [{ Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST', Location: callbackUrl }],
        privateKey: (cfg.privateKey as string) || undefined,
      });
      const idp = samlify.IdentityProvider({
        entityID: (cfg.issuer as string) || `fleetoss-${pid}`,
        singleSignOnService: [{ Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect', Location: cfg.entryPoint }],
        signingCert: (cfg.cert as string) || undefined,
      });
      const loginReq = sp.createLoginRequest(idp, 'redirect');
      return reply.redirect(loginReq.context as any);
    }

    return reply.code(400).send({ error: 'Provider type does not support redirect login' });
  });

  // Callback for OIDC and SAML
  app.get('/api/auth/db/:pid/callback', async (request: any, reply: any) => {
    const { pid } = request.params as { pid: string };
    const prov = await loadProviderConfig(pid);
    if (!prov) return reply.code(404).send({ error: 'Provider not found' });
    const cfg = prov.config as Record<string, any>;

    if (prov.providerType === 'oidc') {
      const nameClaim = (cfg.nameClaim as string) || 'name';
      const tokenUrl = `${cfg.issuer}/protocol/openid-connect/token`;
      const userInfoUrl = `${cfg.issuer}/protocol/openid-connect/userinfo`;
      const redirectUri = (cfg.redirectUri as string) || `${config.baseUrl}/api/auth/db/${pid}/callback`;

      const { state, code } = request.query as { state?: string; code?: string };
      if (!code || !state) return reply.code(400).send({ error: 'Missing code or state' });
      const stored = stateStore.get(state);
      if (!stored) return reply.code(400).send({ error: 'Invalid state' });
      stateStore.delete(state);

      const body = `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${encodeURIComponent(cfg.clientId)}&client_secret=${encodeURIComponent(cfg.clientSecret)}&code_verifier=${encodeURIComponent(stored.codeVerifier || '')}`;
      const tokenRes = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      if (!tokenRes.ok) return reply.code(401).send({ error: 'Failed to exchange authorization code' });
      const tokenData: any = await tokenRes.json();
      const userInfoRes = await fetch(userInfoUrl, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
      if (!userInfoRes.ok) return reply.code(401).send({ error: 'Failed to fetch user info' });
      const userInfo: any = await userInfoRes.json();
      const email = (userInfo.email || userInfo.preferred_username || '') as string;
      const name = (userInfo[nameClaim] || userInfo.name || email.split('@')[0] || 'User') as string;
      if (!email) return reply.code(400).send({ error: 'Email not provided' });
      const user = await findOrCreateUser(email, name, userInfo.sub as string, 'oidc');
      const token = signToken(user.id, user.email, user.role);
      redirectToFrontend(reply, token, { id: user.id, email: user.email, name: user.name, role: user.role, authProvider: 'oidc', createdAt: user.createdAt });
      return;
    }

    if (prov.providerType === 'oauth2') {
      const emailField = (cfg.emailField as string) || 'email';
      const nameField = (cfg.nameField as string) || 'name';
      const redirectUri = (cfg.redirectUri as string) || `${config.baseUrl}/api/auth/db/${pid}/callback`;
      const { code, state } = request.query as { code?: string; state?: string };
      if (!code || !state) return reply.code(400).send({ error: 'Missing code or state' });
      const stored = stateStore.get(state);
      if (!stored) return reply.code(400).send({ error: 'Invalid state' });
      stateStore.delete(state);

      const tokenParams = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: cfg.clientId, client_secret: cfg.clientSecret });
      const tokenRes = await fetch(cfg.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: tokenParams.toString() });
      if (!tokenRes.ok) return reply.code(401).send({ error: 'Token exchange failed' });
      const tokenData: any = await tokenRes.json();
      const userInfoRes = await fetch(cfg.userInfoUrl, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
      if (!userInfoRes.ok) return reply.code(401).send({ error: 'Failed to fetch user info' });
      const userInfo: any = await userInfoRes.json();
      let email = userInfo[emailField];
      if (!email && (cfg.userInfoUrl as string).includes('github.com')) {
        try {
          const emailsRes = await fetch('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
          if (emailsRes.ok) {
            const emails: any[] = await emailsRes.json();
            const primary = emails.find((e: any) => e.primary && e.verified);
            if (primary) email = primary.email;
          }
        } catch {}
      }
      const name = userInfo[nameField] || userInfo.login || email?.split('@')[0] || 'User';
      if (!email) return reply.code(400).send({ error: 'Email not provided' });
      const user = await findOrCreateUser(email, name, userInfo.sub || userInfo.id || email, 'oauth2');
      const token = signToken(user.id, user.email, user.role);
      redirectToFrontend(reply, token, { id: user.id, email: user.email, name: user.name, role: user.role, authProvider: 'oauth2', createdAt: user.createdAt });
      return;
    }

    return reply.code(400).send({ error: 'Provider type does not support GET callback' });
  });

  // SAML callback
  app.post('/api/auth/db/:pid/callback', async (request: any, reply: any) => {
    const { pid } = request.params as { pid: string };
    const prov = await loadProviderConfig(pid);
    if (!prov) return reply.code(404).send({ error: 'Provider not found' });
    if (prov.providerType !== 'saml') return reply.code(400).send({ error: 'Only SAML providers use POST callback' });
    const cfg = prov.config as Record<string, any>;

    const callbackUrl = (cfg.callbackUrl as string) || `${config.baseUrl}/api/auth/db/${pid}/callback`;
    const sp = samlify.ServiceProvider({
      entityID: (cfg.issuer as string) || `fleetoss-${pid}`,
      assertionConsumerService: [{ Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST', Location: callbackUrl }],
      privateKey: (cfg.privateKey as string) || undefined,
    });
    const idp = samlify.IdentityProvider({
      entityID: (cfg.issuer as string) || `fleetoss-${pid}`,
      singleSignOnService: [{ Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect', Location: cfg.entryPoint }],
      signingCert: (cfg.cert as string) || undefined,
    });

    try {
      const body = request.body as Record<string, unknown>;
      const response = await sp.parseLoginResponse(idp, 'post', { body });
      const attributes = response.extract?.attributes || {};
      const nameId = response.extract?.nameID || '';
      const emailAttr = (cfg.emailAttribute as string) || 'mail';
      const nameAttr = (cfg.nameAttribute as string) || 'cn';
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

// ── LDAP ──
function registerLdapRoute(app: FastifyInstance, pid: string, _cfg: any) {
  app.post(`/api/auth/db/${pid}/login`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const prov = await loadProviderConfig(pid);
      if (!prov) return reply.code(404).send({ error: 'Provider not found' });
      const cfg = prov.config as Record<string, any>;
      const { email, password } = request.body as { email?: string; password?: string };
      if (!email || !password) return reply.code(400).send({ error: 'Email and password required' });

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
      return reply.send({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, authProvider: 'ldap', createdAt: user.createdAt } });
    } catch (err: any) {
      request.log.error(err, 'LDAP login failed');
      return reply.code(401).send({ error: err.message || 'LDAP authentication failed' });
    }
  });
}

// ── OpenID Connect ──
function registerOidcRoutes(app: FastifyInstance, pid: string, _cfg: any) {
  app.get(`/api/auth/db/${pid}/login`, async (request: any, reply: any) => {
    try {
      const prov = await loadProviderConfig(pid);
      if (!prov) return reply.code(404).send({ error: 'Provider not found' });
      const cfg = prov.config as Record<string, any>;
      const redirectUri = cfg.redirectUri || `${config.baseUrl}/api/auth/db/${pid}/callback`;
      const scope = cfg.scope || 'openid profile email';
      const oaConfig = await createOidcConfig(cfg, redirectUri);
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
      return reply.redirect(authUrl.href as any);
    } catch (err: any) {
      request.log.error(err, 'OIDC login failed');
      return reply.code(500).send({ error: 'Failed to initiate login' });
    }
  });

  app.get(`/api/auth/db/${pid}/callback`, async (request: any, reply: any) => {
    try {
      const prov = await loadProviderConfig(pid);
      if (!prov) return reply.code(404).send({ error: 'Provider not found' });
      const cfg = prov.config as Record<string, any>;
      const nameClaim = cfg.nameClaim || 'name';
      const tokenUrl = `${cfg.issuer}/protocol/openid-connect/token`;
      const userInfoUrl = `${cfg.issuer}/protocol/openid-connect/userinfo`;
      const redirectUri = cfg.redirectUri || `${config.baseUrl}/api/auth/db/${pid}/callback`;

      const { state, code } = request.query as { state?: string; code?: string };
      if (!code || !state) return reply.code(400).send({ error: 'Missing code or state' });
      const stored = stateStore.get(state);
      if (!stored) return reply.code(400).send({ error: 'Invalid state' });
      stateStore.delete(state);

      // Manual token exchange (avoid openid-client redirect_uri matching issues)
      const body = `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${encodeURIComponent(cfg.clientId)}&client_secret=${encodeURIComponent(cfg.clientSecret)}&code_verifier=${encodeURIComponent(stored.codeVerifier || '')}`;
      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        request.log.error({ status: tokenRes.status, body: errBody }, 'Token exchange failed');
        return reply.code(401).send({ error: 'Failed to exchange authorization code' });
      }
      const tokenData: any = await tokenRes.json();

      // Fetch user info
      const userInfoRes = await fetch(userInfoUrl, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!userInfoRes.ok) return reply.code(401).send({ error: 'Failed to fetch user info' });
      const userInfo: any = await userInfoRes.json();

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
function registerOAuth2Routes(app: FastifyInstance, pid: string, _cfg: any) {
  app.get(`/api/auth/db/${pid}/login`, async (request: any, reply: any) => {
    try {
      const prov = await loadProviderConfig(pid);
      if (!prov) return reply.code(404).send({ error: 'Provider not found' });
      const cfg = prov.config as Record<string, any>;
      const scope = cfg.scope || 'openid profile email';
      const redirectUri = cfg.redirectUri || `${config.baseUrl}/api/auth/db/${pid}/callback`;
      const state = crypto.randomBytes(32).toString('hex');
      const params = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: redirectUri, response_type: 'code', scope, state });
      stateStore.set(state, { state, redirectTo: '/', expiresAt: Date.now() + 600000 });
      return reply.redirect(`${cfg.authorizeUrl}?${params.toString()}` as any);
    } catch (err: any) {
      request.log.error(err, 'OAuth2 login failed');
      return reply.code(500).send({ error: 'Failed to initiate login' });
    }
  });

  app.get(`/api/auth/db/${pid}/callback`, async (request: any, reply: any) => {
    try {
      const prov = await loadProviderConfig(pid);
      if (!prov) return reply.code(404).send({ error: 'Provider not found' });
      const cfg = prov.config as Record<string, any>;
      const emailField = cfg.emailField || 'email';
      const nameField = cfg.nameField || 'name';
      const redirectUri = cfg.redirectUri || `${config.baseUrl}/api/auth/db/${pid}/callback`;
      const { code, state } = request.query as { code?: string; state?: string };
      if (!code || !state) return reply.code(400).send({ error: 'Missing code or state' });
      const stored = stateStore.get(state);
      if (!stored) return reply.code(400).send({ error: 'Invalid state' });
      stateStore.delete(state);

      const tokenParams = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: cfg.clientId, client_secret: cfg.clientSecret });
      const tokenRes = await fetch(cfg.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: tokenParams.toString() });
      if (!tokenRes.ok) return reply.code(401).send({ error: 'Token exchange failed' });
      const tokenData: any = await tokenRes.json();
      const userInfoRes = await fetch(cfg.userInfoUrl, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
      if (!userInfoRes.ok) return reply.code(401).send({ error: 'Failed to fetch user info' });
      const userInfo: any = await userInfoRes.json();
      let email = userInfo[emailField];
      // GitHub returns email: null for private emails — try /user/emails
      if (!email && cfg.userInfoUrl.includes('github.com')) {
        try {
          const emailsRes = await fetch('https://api.github.com/user/emails', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          if (emailsRes.ok) {
            const emails: any[] = await emailsRes.json();
            const primary = emails.find((e: any) => e.primary && e.verified);
            if (primary) email = primary.email;
          }
        } catch {}
      }
      const name = userInfo[nameField] || userInfo.login || email?.split('@')[0] || 'User';
      if (!email) return reply.code(400).send({ error: 'Email not provided' });

      const user = await findOrCreateUser(email, name, userInfo.sub || userInfo.id || email, 'oauth2');
      const token = signToken(user.id, user.email, user.role);
      redirectToFrontend(reply, token, { id: user.id, email: user.email, name: user.name, role: user.role, authProvider: 'oauth2', createdAt: user.createdAt });
    } catch (err: any) {
      request.log.error(err, 'OAuth2 callback failed');
      return reply.code(401).send({ error: 'SSO authentication failed' });
    }
  });
}

// ── SAML ──
function registerSamlRoutes(app: FastifyInstance, pid: string, _cfg: any) {
  const samlCache = new Map<string, { sp: any; idp: any }>();

  async function getSamlEntities() {
    const cached = samlCache.get(pid);
    if (cached) return cached;

    const prov = await loadProviderConfig(pid);
    if (!prov) throw new Error('Provider not found');
    const cfg = prov.config as Record<string, any>;
    const callbackUrl = (cfg.callbackUrl as string) || `${config.baseUrl}/api/auth/db/${pid}/callback`;

    const sp = samlify.ServiceProvider({
      entityID: cfg.issuer || `fleetoss-${pid}`,
      assertionConsumerService: [{ Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST', Location: callbackUrl }],
      privateKey: cfg.privateKey || undefined,
    });
    const idp = samlify.IdentityProvider({
      entityID: cfg.issuer || `fleetoss-${pid}`,
      singleSignOnService: [{ Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect', Location: cfg.entryPoint }],
      signingCert: cfg.cert || undefined,
    });
    samlCache.set(pid, { sp, idp });
    return { sp, idp };
  }

  app.get(`/api/auth/db/${pid}/login`, async (request: any, reply: any) => {
    try {
      const { sp, idp } = await getSamlEntities();
      const loginReq = sp.createLoginRequest(idp, 'redirect');
      return reply.redirect(loginReq.context as any);
    } catch (err: any) {
      request.log.error(err, 'SAML login failed');
      return reply.code(500).send({ error: 'Failed to initiate SAML login' });
    }
  });

  app.post(`/api/auth/db/${pid}/callback`, async (request: any, reply: any) => {
    try {
      const prov = await loadProviderConfig(pid);
      if (!prov) return reply.code(404).send({ error: 'Provider not found' });
      const cfg = prov.config as Record<string, any>;
      const { sp, idp } = await getSamlEntities();
      const body = request.body as Record<string, unknown>;
      const response = await sp.parseLoginResponse(idp, 'post', { body });
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
