import type { FastifyInstance } from 'fastify';
import ldap from 'ldapjs';
import { getDb } from '../../db/connection.js';
import { users } from '../../db/schema.js';
import type { AuthStrategy } from './strategy.js';
import { config } from '../../config/index.js';
import { signToken } from '../utils.js';
import { eq } from 'drizzle-orm';

async function findOrCreateLdapUser(email: string, displayName: string, ldapId: string) {
  const db = getDb();
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    const u = existing[0];
    // Update provider info if user was local before
    if (u.authProvider === 'local') {
      await db.update(users)
        .set({ authProvider: 'ldap', authProviderId: ldapId })
        .where(eq(users.id, u.id));
    }
    return { ...u, authProvider: 'ldap' as const, authProviderId: ldapId };
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

export const ldapStrategy: AuthStrategy = {
  id: 'ldap',
  name: 'LDAP / Active Directory',
  type: 'form',
  enabled: config.auth.ldap.enabled,

  registerRoutes(app: FastifyInstance) {
    if (!config.auth.ldap.enabled) return;

    app.post('/api/auth/login/ldap', async (request: any, reply: any) => {
      try {
        const { email, password } = request.body || {};
        if (!email || !password) {
          return reply.code(400).send({ error: 'Email and password required' });
        }

        const ldapConfig = config.auth.ldap;
        const client = ldap.createClient({ url: ldapConfig.url });

        await new Promise<void>((resolve, reject) => {
          client.on('connectError', (err: Error) => reject(err));

          // If we have a bind DN + password, bind as service account first to search
          const doBind = ldapConfig.bindDN && ldapConfig.bindPassword
            ? new Promise<void>((res, rej) => {
                client.bind(ldapConfig.bindDN!, ldapConfig.bindPassword!, (err: Error | null) => {
                  if (err) rej(new Error(`LDAP bind failed: ${err.message}`));
                  else res();
                });
              })
            : Promise.resolve();

          doBind.then(() => {
            // Use user DN template if available, otherwise search
            if (ldapConfig.userDnTemplate) {
              const userDn = ldapConfig.userDnTemplate.replace('{{email}}', email);
              client.bind(userDn, password, (err: Error | null) => {
                if (err) {
                  reject(new Error('LDAP authentication failed: ' + err.message));
                  return;
                }
                // Extract name from DN or use email
                const nameMatch = userDn.match(/^CN=([^,]+)/i);
                const displayName = nameMatch ? nameMatch[1] : email.split('@')[0];
                resolve();
                findOrCreateLdapUser(email, displayName, userDn).then((user) => {
                  const token = signToken(user.id, user.email, user.role);
                  reply.send({
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
                }).catch((err: Error) => {
                  request.log.error(err, 'Failed to create LDAP user');
                });
              });
            } else {
              // Search for user
              const searchFilter = ldapConfig.searchFilter.replace('{{email}}', email);
              const opts = {
                filter: searchFilter,
                scope: 'sub' as const,
                attributes: [ldapConfig.nameAttribute || 'cn', 'dn'],
              };

              client.search(ldapConfig.searchBase, opts, (err: Error | null, searchRes: any) => {
                if (err) {
                  reject(new Error(`LDAP search failed: ${err.message}`));
                  return;
                }

                let userEntry: any = null;
                searchRes.on('searchEntry', (entry: any) => {
                  userEntry = entry;
                });

                searchRes.on('end', () => {
                  if (!userEntry) {
                    reject(new Error('User not found in LDAP'));
                    return;
                  }

                  const userDn = userEntry.dn.toString();
                  // Now bind as the user to verify password
                  client.bind(userDn, password, (bindErr: Error | null) => {
                    if (bindErr) {
                      reject(new Error('LDAP authentication failed'));
                      return;
                    }

                    const nameAttr = ldapConfig.nameAttribute || 'cn';
                    const displayName = userEntry.attributes?.find(
                      (a: any) => a.type === nameAttr
                    )?.values?.[0] || email.split('@')[0];

                    findOrCreateLdapUser(email, displayName, userDn).then((user) => {
                      const token = signToken(user.id, user.email, user.role);
                      reply.send({
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
                    }).catch((err: Error) => {
                      request.log.error(err, 'Failed to create LDAP user');
                    });
                  });
                });

                searchRes.on('error', (searchErr: Error) => {
                  reject(new Error(`LDAP search error: ${searchErr.message}`));
                });
              });
            }
          }).catch(reject);
        });
      } catch (err: any) {
        request.log.error(err, 'LDAP login failed');
        return reply.code(401).send({ error: err.message || 'LDAP authentication failed' });
      }
    });
  },
};
