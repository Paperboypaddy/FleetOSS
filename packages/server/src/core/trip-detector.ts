import type { Position } from '@fleetoss/core';
import { getDb } from '../db/connection.js';
import { trips, devices } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { getRedis } from '../db/redis.js';
import { enqueueGeocode } from './geocoder.js';

const MOVING_SPEED_THRESHOLD = 2; // mph
const STOP_DURATION_THRESHOLD = 300; // 5 minutes
const STATE_TTL = 86400; // 24 hours — clean up stale entries

interface DeviceTripState {
  tripStarted: boolean;
  startPosition: Position;
  startTime: Date;
  lastPosition: Position;
  stopStartTime: number | null;
  maxSpeed: number;
  totalDistance: number;
}

const inMemoryState = new Map<string, DeviceTripState>();

function redisKey(deviceId: string): string {
  return `trip:state:${deviceId}`;
}

async function getState(deviceId: string): Promise<DeviceTripState | undefined> {
  const redis = getRedis();
  if (redis) {
    const raw = await redis.get(redisKey(deviceId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as DeviceTripState;
    parsed.startTime = new Date(parsed.startTime);
    return parsed;
  }
  return inMemoryState.get(deviceId);
}

async function setState(deviceId: string, state: DeviceTripState) {
  const redis = getRedis();
  if (redis) {
    await redis.setex(redisKey(deviceId), STATE_TTL, JSON.stringify(state));
    return;
  }
  inMemoryState.set(deviceId, state);
}

async function deleteState(deviceId: string) {
  const redis = getRedis();
  if (redis) {
    await redis.del(redisKey(deviceId));
    return;
  }
  inMemoryState.delete(deviceId);
}

export async function detectTrip(deviceId: string, position: Position) {
  const db = getDb();
  const devResult = await db.select({ attributes: devices.attributes }).from(devices).where(eq(devices.id, deviceId)).limit(1);
  const devAttrs = (devResult[0]?.attributes || {}) as Record<string, unknown>;
  if (devAttrs['skipTripDetection'] === true) return;

  const state = await getState(deviceId);
  const speed = position.speed || 0;
  const isMoving = speed > MOVING_SPEED_THRESHOLD;
  const wasMoving = state ? (state.lastPosition.speed || 0) > MOVING_SPEED_THRESHOLD : false;

  if (!state) {
    if (isMoving) {
      await setState(deviceId, {
        tripStarted: true,
        startPosition: position,
        startTime: new Date(position.deviceTimestamp),
        lastPosition: position,
        stopStartTime: null,
        maxSpeed: speed,
        totalDistance: 0,
      });
    }
    return;
  }

  if (isMoving && !state.tripStarted) {
    await setState(deviceId, {
      tripStarted: true,
      startPosition: position,
      startTime: new Date(position.deviceTimestamp),
      lastPosition: position,
      stopStartTime: null,
      maxSpeed: speed,
      totalDistance: 0,
    });
  } else if (state.tripStarted) {
    if (isMoving) {
      const dlat = (position.latitude - state.lastPosition.latitude) * 69;
      const dlng = (position.longitude - state.lastPosition.longitude) * 69 * Math.cos(position.latitude * Math.PI / 180);
      state.totalDistance += Math.sqrt(dlat * dlat + dlng * dlng);
      state.lastPosition = position;
      if (speed > state.maxSpeed) state.maxSpeed = speed;
      state.stopStartTime = null;
      await setState(deviceId, state);
    } else if (!isMoving && wasMoving) {
      state.lastPosition = position;
      state.stopStartTime = Date.now();
      await setState(deviceId, state);
    } else if (!isMoving && !wasMoving && state.stopStartTime) {
      const stopDuration = (Date.now() - state.stopStartTime) / 1000;
      state.lastPosition = position;

      if (stopDuration >= STOP_DURATION_THRESHOLD) {
        const endTime = new Date(position.deviceTimestamp);
        const duration = (endTime.getTime() - state.startTime.getTime()) / 1000;

        if (duration >= 30 && state.totalDistance > 0.1) {
          const db = getDb();
          const inserted = await db.insert(trips).values({
            deviceId,
            startPositionId: state.startPosition.id,
            endPositionId: position.id,
            startTime: state.startTime,
            endTime: endTime,
            startLat: state.startPosition.latitude,
            startLng: state.startPosition.longitude,
            endLat: position.latitude,
            endLng: position.longitude,
            distance: state.totalDistance,
            duration: Math.round(duration),
            avgSpeed: state.totalDistance / (duration / 3600),
            maxSpeed: state.maxSpeed,
          }).returning();

          if (inserted.length) {
            const tripId = inserted[0].id;
            enqueueGeocode(tripId, 'startAddress', state.startPosition.latitude, state.startPosition.longitude);
            enqueueGeocode(tripId, 'endAddress', position.latitude, position.longitude);
          }
        }

        await deleteState(deviceId);
      } else {
        await setState(deviceId, state);
      }
    } else {
      state.lastPosition = position;
      await setState(deviceId, state);
    }
  } else {
    state.lastPosition = position;
    await setState(deviceId, state);
  }
}
