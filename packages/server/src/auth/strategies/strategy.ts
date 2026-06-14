import type { FastifyInstance } from 'fastify';

export interface AuthStrategy {
  id: 'local' | 'ldap' | 'oidc' | 'oauth2' | 'saml';
  name: string;
  type: 'form' | 'redirect';
  enabled: boolean;
  loginUrl?: string;
  registerRoutes?(app: FastifyInstance): void;
}
