import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import ldap from 'ldapjs';
import { getDb } from '../../db/connection.js';
import { users } from '../../db/schema.js';
import type { AuthStrategy } from './strategy.js';
import { config } from '../../config/index.js';
import { signToken } from '../utils.js';
import { eq } from 'drizzle-orm';

function ldapBindAsync(client: any, dn: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.bind(dn, password, (err: Error | null) => {
      if (err) reject(new Error(`LDAP bind failed: ${err.message}`));
      else resolve();
    });
  });
}

function ldapSearchAsync(client: any, base: string, opts: any): Promise<any[]> {
  return new Promise((resolve, reject) => {
    client.search(base, opts, (err: Error | null, searchRes: any) => {
      if (err) { reject(new Error(`LDAP search failed: ${err.message}`)); return; }
      const entries: any[] = [];
      searchRes.on('searchEntry', (entry: any) => entries.push(entry));
      searchRes.on('error', (searchErr: Error) => reject(new Error(`LDAP search error: ${searchErr.message}`)));
      searchRes.on('end', () => resolve(entries));
    });
  });
}

async function findOrCreateLdapUser(email: string, displayName: string, ldapId: string) {
  const db = getDb();
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    const u = existing[0];
    if (u.authProvider !== 'ldap') {
      await db.update(users)
        .set({ authProvider: 'ldap', authProviderId: ldapId })
        .where(eq(users.id, u.id));
    }
    return u;
  }
  const result = await db.insert(users).values({
    email,
    name: displayName,
    passwordHash: null,
    role: config.auth.ldap.defaultRole || 'viewer',
    authProvider: 'ldap',
    authProviderId: ldapId,
  }).returning();
  return result[0];
}

async function authenticateLdap(email: string, password: string): Promise<any> {
  const ldapConfig = config.auth.ldap;
  const client = ldap.createClient({ url: ldapConfig.url });

  try {
    // Bind as service account first if configured
    if (ldapConfig.bindDN && ldapConfig.bindPassword) {
      await ldapBindAsync(client, ldapConfig.bindDN, ldapConfig.bindPassword);
    }

    let userDn: string;
    let displayName: string;

    if (ldapConfig.userDnTemplate) {
      userDn = ldapConfig.userDnTemplate.replace('{{email}}', email);
      await ldapBindAsync(client, userDn, password);
      const nameMatch = userDn.match(/^CN=([^,]+)/i);
      displayName = nameMatch ? nameMatch[1] : email.split('@')[0];
    } else {
      const searchFilter = ldapConfig.searchFilter.replace('{{email}}', email);
      const entries = await ldapSearchAsync(client, ldapConfig.searchBase, {
        filter: searchFilter,
        scope: 'sub',
        attributes: [ldapConfig.nameAttribute || 'cn', 'dn'],
      });

      if (entries.length === 0) {
        throw new Error('User not found in LDAP');
      }

      userDn = entries[0].dn.toString();
      displayName = entries[0].attributes?.find(
        (a: any) => a.type === (ldapConfig.nameAttribute || 'cn')
      )?.values?.[0] || email.split('@')[0];

      // Bind as the user to verify password
      await ldapBindAsync(client, userDn, password);
    }

    return await findOrCreateLdapUser(email, displayName, userDn);
  } finally {
    client.unbind();
  }
}

export const ldapStrategy: AuthStrategy = {
  id: 'ldap',
  name: 'LDAP / Active Directory',
  type: 'form',
  enabled: config.auth.ldap.enabled,

  registerRoutes(app: FastifyInstance) {
    if (!config.auth.ldap.enabled) return;

    app.post('/api/auth/login/ldap', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { email, password } = request.body as { email?: string; password?: string };
        if (!email || !password) {
          return reply.code(400).send({ error: 'Email and password required' });
        }

        const user = await authenticateLdap(email, password);
        const token = signToken(user.id, user.email, user.role);
        return reply.send({
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            authProvider: 'ldap',
            createdAt: user.createdAt,
          },
        });
      } catch (err: any) {
        request.log.error(err, 'LDAP login failed');
        return reply.code(401).send({ error: err.message || 'LDAP authentication failed' });
      }
    });
  },
};
