import Redis from 'ioredis';
import { config } from '../config/index.js';

let client: Redis | null = null;
let fallback = false;

export function getRedis(): Redis | null {
  if (fallback) return null;
  if (!client && config.redisUrl) {
    client = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 3) {
          fallback = true;
          console.warn('Redis unavailable — falling back to in-memory');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });
    client.on('error', () => {});
  }
  return client || null;
}

export async function closeRedis() {
  if (client) {
    await client.quit();
    client = null;
    fallback = false;
  }
}
