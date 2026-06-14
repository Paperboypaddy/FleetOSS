import { getRedis } from '../db/redis.js';
import { getDb } from '../db/connection.js';
import { trips } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { reverseGeocode } from './geocode.js';

const QUEUE_KEY = 'geocode:queue';
const MAX_RETRIES = 3;
const RATE_LIMIT_MS = 1100; // Nominatim: max 1 req/sec

interface GeocodeJob {
  tripId: string;
  field: 'startAddress' | 'endAddress';
  lat: number;
  lng: number;
  retries: number;
}

let running = false;

export function startGeocoderWorker() {
  if (running) return;
  running = true;
  poll();
}

export function stopGeocoderWorker() {
  running = false;
}

async function poll() {
  while (running) {
    const redis = getRedis();
    if (!redis) {
      await sleep(2000);
      continue;
    }

    try {
      const result = await redis.blpop(QUEUE_KEY, 5);
      if (!result) continue;

      const raw = result[1];
      const job: GeocodeJob = JSON.parse(raw);

      const address = await reverseGeocode(job.lat, job.lng);
      if (address) {
        const db = getDb();
        await db.update(trips).set({ [job.field]: address }).where(eq(trips.id, job.tripId)).execute();
      } else if (job.retries < MAX_RETRIES) {
        const retry: GeocodeJob = { ...job, retries: job.retries + 1 };
        await redis.rpush(QUEUE_KEY, JSON.stringify(retry));
      }

      await sleep(RATE_LIMIT_MS);
    } catch {
      await sleep(1000);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
