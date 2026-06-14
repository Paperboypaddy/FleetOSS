import { getRedis } from '../db/redis.js';

const QUEUE_KEY = 'geocode:queue';

interface GeocodeJob {
  tripId: string;
  field: 'startAddress' | 'endAddress';
  lat: number;
  lng: number;
  retries: number;
}

export async function enqueueGeocode(tripId: string, field: 'startAddress' | 'endAddress', lat: number, lng: number) {
  const redis = getRedis();
  if (!redis) {
    return;
  }
  const job: GeocodeJob = { tripId, field, lat, lng, retries: 0 };
  await redis.rpush(QUEUE_KEY, JSON.stringify(job));
}
