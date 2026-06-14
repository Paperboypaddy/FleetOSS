import { getRedis } from '../db/redis.js';

const WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute
const PREFIX = 'ratelimit:';

export async function checkRateLimit(key: string, maxRequests = MAX_REQUESTS): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true; // Allow if Redis is down

  const now = Date.now();
  const windowKey = `${PREFIX}${key}`;

  // Remove entries outside the window
  await redis.zremrangebyscore(windowKey, 0, now - WINDOW_MS);

  // Count entries in current window
  const count = await redis.zcard(windowKey);

  if (count >= maxRequests) {
    return false; // Rate limited
  }

  // Add current request
  await redis.zadd(windowKey, now, `${now}:${Math.random()}`);
  await redis.pexpire(windowKey, WINDOW_MS);

  return true;
}
