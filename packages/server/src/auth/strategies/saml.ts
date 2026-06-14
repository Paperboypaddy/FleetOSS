import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as samlify from 'samlify';
import { getDb } from '../../db/connection.js';
import { users } from '../../db/schema.js';
import type { AuthStrategy } from './strategy.js';
import { config } from '../../config/index.js';
import { signToken } from '../utils.js';
import { eq } from 'drizzle-orm';

let spInstance: any = null;
let idpInstance: any = null;

function getSamlEntities() {
  if (spInstance && idpInstance) return { sp: spInstance, idp: idpInstance };

  const samlConfig = config.auth.saml;
  const callbackUrl = samlConfig.callbackUrl || `${config.baseUrl}/api/auth/saml/callback`;

  idpInstance = samlify.IdentityProvider({
    entityID: samlConfig.issuer,
    singleSignOnService: [{
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
      Location: samlConfig.entryPoint,
    }],
    signingCert: samlConfig.cert || undefined,
  });

  spInstance = samlify.ServiceProvider({
    entityID: samlConfig.issuer,
    authnRequestsSigned: false,
    wantAssertionsSigned: false,
    assertionConsumerService: [{
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
      Location: callbackUrl,
    }],
    privateKey: samlConfig.privateKey || undefined,
  });

  return { sp: spInstance, idp: idpInstance };
}

async function findOrCreateSamlUser(email: string, name: string, nameId: string) {
  const db = getDb();
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    const u = existing[0];
    if (u.authProvider !== 'saml') {
      await db.update(users)
        .set({ authProvider: 'saml', authProviderId: nameId })
        .where(eq(users.id, u.id));
    }
    return u;
  }
  const result = await db.insert(users).values({
    email,
    name,
    passwordHash: null,
    role: config.auth.saml.defaultRole || 'viewer',
    authProvider: 'saml',
    authProviderId: nameId,
  }).returning();
  return result[0];
}

export const samlStrategy: AuthStrategy = {
  id: 'saml',
  name: 'Single Sign-On (SAML)',
  type: 'redirect',
  enabled: config.auth.saml.enabled,
  loginUrl: '/api/auth/saml/login',

  registerRoutes(app: FastifyInstance) {
    if (!config.auth.saml.enabled) return;

    // SAML metadata endpoint
    app.get('/api/auth/saml/metadata', async (_request: FastifyRequest, reply: FastifyReply) => {
      const { sp } = getSamlEntities();
      const metadata = sp.getMetadata();
      reply.header('Content-Type', 'application/xml');
      return reply.send(metadata);
    });

    // Initiate SAML login
    app.get('/api/auth/saml/login', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { sp, idp } = getSamlEntities();
        const loginReq = sp.createLoginRequest(idp, 'redirect');
        return reply.redirect(loginReq.context as any);
      } catch (err: any) {
        request.log.error(err, 'SAML login initiation failed');
        return reply.code(500).send({ error: 'Failed to initiate SAML login' });
      }
    });

    // SAML ACS (Assertion Consumer Service)
    app.post('/api/auth/saml/callback', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { sp, idp } = getSamlEntities();
        const body = request.body as Record<string, unknown>;

        const response = await sp.parseLoginResponse(idp, 'post', {
          body,
        });

        const attributes = response.extract?.attributes || {};
        const nameId = response.extract?.nameID || '';

        const emailAttr = config.auth.saml.emailAttribute || 'mail';
        const nameAttr = config.auth.saml.nameAttribute || 'cn';

        const email = (attributes[emailAttr]?.toString() || nameId || '') as string;
        const name = (attributes[nameAttr]?.toString() || email?.split('@')[0] || 'User') as string;

        if (!email) {
          return reply.code(400).send({ error: 'Email not provided by identity provider' });
        }

        const user = await findOrCreateSamlUser(email, name, nameId);
        const token = signToken(user.id, user.email, user.role);

        const frontendUrl = config.baseUrl.replace(/:\d+$/, ':5173');
        return reply.redirect(
          `${frontendUrl}/#/sso?token=${token}&user=${encodeURIComponent(JSON.stringify({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            authProvider: 'saml',
            createdAt: user.createdAt,
          }))}` as any,
        );
      } catch (err: any) {
        request.log.error(err, 'SAML callback failed');
        return reply.code(401).send({ error: 'SAML authentication failed' });
      }
    });
  },
};
