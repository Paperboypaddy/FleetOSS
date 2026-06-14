import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: { sub: string; email: string; role: string; authProvider: string };
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
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  const payload = verifyToken(auth.slice(7));
  if (!payload) {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
  request.user = { ...payload, authProvider: 'local' };
}
