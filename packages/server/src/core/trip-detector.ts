import type { Position } from '@fleetoss/core';
import { getLatestPosition } from '../db/repositories/position.js';
import { getDb } from '../db/connection.js';
import { trips } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const MOVING_SPEED_THRESHOLD = 2; // mph (phone m/s ≈ 2.2 mph)
const STOP_DURATION_THRESHOLD = 300; // 5 minutes

const deviceState = new Map<string, {
  tripStarted: boolean;
  startPosition: Position | null;
  startTime: Date;
  stopStartTime: number | null; // timestamp (ms) when device first stopped
  positions: Position[];
  maxSpeed: number;
  totalDistance: number;
}>();

export async function detectTrip(deviceId: string, position: Position) {
  const prev = await getLatestPosition(deviceId);
  const state = deviceState.get(deviceId) || {
    tripStarted: false,
    startPosition: null,
    startTime: new Date(),
    stopStartTime: null,
    positions: [],
    maxSpeed: 0,
    totalDistance: 0,
  };

  const speed = position.speed || 0;
  const isMoving = speed > MOVING_SPEED_THRESHOLD;
  const wasMoving = prev && (prev.speed || 0) > MOVING_SPEED_THRESHOLD;

  if (isMoving && !state.tripStarted) {
    // Trip started — device began moving
    deviceState.set(deviceId, {
      tripStarted: true,
      startPosition: position,
      startTime: new Date(position.deviceTimestamp),
      stopStartTime: null,
      positions: [position],
      maxSpeed: speed,
      totalDistance: 0,
    });
  } else if (state.tripStarted) {
    if (isMoving) {
      // Still moving — update trip state, reset stop timer
      state.positions.push(position);
      if (speed > state.maxSpeed) state.maxSpeed = speed;
      if (prev) {
        const dlat = (position.latitude - prev.latitude) * 69;
        const dlng = (position.longitude - prev.longitude) * 69 * Math.cos(position.latitude * Math.PI / 180);
        state.totalDistance += Math.sqrt(dlat * dlat + dlng * dlng);
      }
      state.stopStartTime = null;
      deviceState.set(deviceId, state);
    } else if (!isMoving && wasMoving) {
      // Just stopped — record when stop started
      state.stopStartTime = Date.now();
      state.positions.push(position);
      deviceState.set(deviceId, state);
    } else if (!isMoving && !wasMoving && state.stopStartTime) {
      // Still stopped — check if stop duration threshold exceeded
      const stopDuration = (Date.now() - state.stopStartTime) / 1000;
      state.positions.push(position);

      if (stopDuration >= STOP_DURATION_THRESHOLD) {
        // Trip ended — device has been stopped long enough
        const endTime = new Date(position.deviceTimestamp);
        const duration = (endTime.getTime() - state.startTime.getTime()) / 1000;
        const distance = state.totalDistance;

        if (duration >= 30 && distance > 0.1) {
          const db = getDb();
          await db.insert(trips).values({
            deviceId,
            startPositionId: state.startPosition!.id,
            endPositionId: position.id,
            startTime: state.startTime,
            endTime: endTime,
            startLat: state.startPosition!.latitude,
            startLng: state.startPosition!.longitude,
            endLat: position.latitude,
            endLng: position.longitude,
            distance,
            duration: Math.round(duration),
            avgSpeed: distance / (duration / 3600),
            maxSpeed: state.maxSpeed,
          });
        }

        deviceState.delete(deviceId);
      } else {
        deviceState.set(deviceId, state);
      }
    }
  }
}
