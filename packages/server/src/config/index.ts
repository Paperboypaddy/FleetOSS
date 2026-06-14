import 'dotenv/config';
import crypto from 'node:crypto';

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || '4000'}`,
  databaseUrl: process.env.DATABASE_URL || 'postgres://fleetoss:fleetoss_dev@localhost:5432/fleetoss',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    bucket: process.env.S3_BUCKET || 'fleetoss',
  },
  redisUrl: process.env.REDIS_URL,
  auth: {
    // ── LDAP ──
    ldap: {
      enabled: process.env.AUTH_LDAP_ENABLED === 'true',
      url: process.env.AUTH_LDAP_URL || '',
      bindDN: process.env.AUTH_LDAP_BIND_DN || '',
      bindPassword: process.env.AUTH_LDAP_BIND_PASSWORD || '',
      searchBase: process.env.AUTH_LDAP_SEARCH_BASE || '',
      searchFilter: process.env.AUTH_LDAP_SEARCH_FILTER || '(mail={{email}})',
      userDnTemplate: process.env.AUTH_LDAP_USER_DN_TEMPLATE || '',
      nameAttribute: process.env.AUTH_LDAP_NAME_ATTRIBUTE || 'cn',
      defaultRole: (process.env.AUTH_LDAP_DEFAULT_ROLE || 'viewer') as 'admin' | 'manager' | 'viewer',
    },
    // ── OpenID Connect ──
    oidc: {
      enabled: process.env.AUTH_OIDC_ENABLED === 'true',
      issuer: process.env.AUTH_OIDC_ISSUER || '',
      clientId: process.env.AUTH_OIDC_CLIENT_ID || '',
      clientSecret: process.env.AUTH_OIDC_CLIENT_SECRET || '',
      redirectUri: process.env.AUTH_OIDC_REDIRECT_URI || '',
      scope: process.env.AUTH_OIDC_SCOPE || 'openid profile email',
      nameClaim: process.env.AUTH_OIDC_NAME_CLAIM || 'name',
      defaultRole: (process.env.AUTH_OIDC_DEFAULT_ROLE || 'viewer') as 'admin' | 'manager' | 'viewer',
    },
    // ── OAuth2 ──
    oauth2: {
      enabled: process.env.AUTH_OAUTH2_ENABLED === 'true',
      authorizeUrl: process.env.AUTH_OAUTH2_AUTHORIZE_URL || '',
      tokenUrl: process.env.AUTH_OAUTH2_TOKEN_URL || '',
      userInfoUrl: process.env.AUTH_OAUTH2_USERINFO_URL || '',
      clientId: process.env.AUTH_OAUTH2_CLIENT_ID || '',
      clientSecret: process.env.AUTH_OAUTH2_CLIENT_SECRET || '',
      redirectUri: process.env.AUTH_OAUTH2_REDIRECT_URI || '',
      scope: process.env.AUTH_OAUTH2_SCOPE || 'openid profile email',
      emailField: process.env.AUTH_OAUTH2_EMAIL_FIELD || 'email',
      nameField: process.env.AUTH_OAUTH2_NAME_FIELD || 'name',
      defaultRole: (process.env.AUTH_OAUTH2_DEFAULT_ROLE || 'viewer') as 'admin' | 'manager' | 'viewer',
    },
    // ── SAML ──
    saml: {
      enabled: process.env.AUTH_SAML_ENABLED === 'true',
      entryPoint: process.env.AUTH_SAML_ENTRY_POINT || '',
      issuer: process.env.AUTH_SAML_ISSUER || 'fleetoss-saml',
      cert: process.env.AUTH_SAML_CERT || '',
      privateKey: process.env.AUTH_SAML_PRIVATE_KEY || '',
      callbackUrl: process.env.AUTH_SAML_CALLBACK_URL || '',
      nameAttribute: process.env.AUTH_SAML_NAME_ATTRIBUTE || 'cn',
      emailAttribute: process.env.AUTH_SAML_EMAIL_ATTRIBUTE || 'mail',
      defaultRole: (process.env.AUTH_SAML_DEFAULT_ROLE || 'viewer') as 'admin' | 'manager' | 'viewer',
    },
  },
};
