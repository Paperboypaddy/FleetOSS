import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from '../config/index.js';
import { getDb } from '../db/connection.js';
import { apiKeys } from '../db/schema.js';
import { eq } from 'drizzle-orm';

declare module 'fastify' {
  interface FastifyRequest {
    user?: { sub: string; email: string; role: string; authProvider: string };
    apiKey?: { id: string; name: string; permissions: string[] };
  }
}

export function signToken(userId: string, email: string, role: string): string {
  return jwt.sign({ sub: userId, email, role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): { sub: string; email: string; role: string } | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as Record<string, unknown>;
    if (typeof payload.sub === 'string' && typeof payload.email === 'string' && typeof payload.role === 'string') {
      return { sub: payload.sub, email: payload.email, role: payload.role };
    }
    return null;
  } catch {
    return null;
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Unauthorized', requestId: request.id });
  }

  const token = auth.slice(7);

  // Try JWT first
  const jwtPayload = verifyToken(token);
  if (jwtPayload) {
    request.user = { ...jwtPayload, authProvider: 'local' };
    return;
  }

  // Try API key
  try {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const db = getDb();
    const result = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash)).limit(1);
    if (result.length > 0 && result[0].enabled) {
      request.apiKey = { id: result[0].id, name: result[0].name, permissions: result[0].permissions as string[] };
      request.user = { sub: `apikey:${result[0].id}`, email: `apikey-${result[0].name}`, role: 'admin', authProvider: 'local' };

      // Update last used timestamp (non-blocking)
      db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, result[0].id)).catch(() => {});
      return;
    }
  } catch {
    // DB error — fall through to unauthorized
  }

  return reply.code(401).send({ error: 'Invalid or expired token', requestId: request.id });
}
