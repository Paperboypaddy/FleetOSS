import type { Position } from '@fleetoss/core';
import { getLatestPosition } from '../db/repositories/position.js';
import { getDb } from '../db/connection.js';
import { trips } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Simple trip detection: when a device starts moving after being stopped,
// and stops moving after being started.
// More sophisticated detection (geofence-based, ignition-based) will be added later.

const MOVING_SPEED_THRESHOLD = 2; // mph
const STOP_DURATION_THRESHOLD = 300; // 5 minutes

const deviceState = new Map<string, {
  tripStarted: boolean;
  startPosition: Position | null;
  startTime: Date;
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
    positions: [],
    maxSpeed: 0,
    totalDistance: 0,
  };

  const speed = position.speed || 0;
  const isMoving = speed > MOVING_SPEED_THRESHOLD;
  const wasMoving = prev && (prev.speed || 0) > MOVING_SPEED_THRESHOLD;

  if (isMoving && !state.tripStarted) {
    // Trip started
    deviceState.set(deviceId, {
      tripStarted: true,
      startPosition: position,
      startTime: new Date(position.deviceTimestamp),
      positions: [position],
      maxSpeed: speed,
      totalDistance: 0,
    });
  } else if (!isMoving && state.tripStarted && wasMoving === false) {
    // Trip ended (stopped for a while)
    const endTime = new Date(position.deviceTimestamp);
    const duration = (endTime.getTime() - state.startTime.getTime()) / 1000;
    const distance = state.totalDistance;

    if (duration >= 30 && distance > 0.1) {
      // Save trip
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
  } else if (state.tripStarted) {
    // Update trip state
    state.positions.push(position);
    if (speed > state.maxSpeed) state.maxSpeed = speed;
    if (prev) {
      const dlat = (position.latitude - prev.latitude) * 69;
      const dlng = (position.longitude - prev.longitude) * 69 * Math.cos(position.latitude * Math.PI / 180);
      state.totalDistance += Math.sqrt(dlat * dlat + dlng * dlng);
    }
    deviceState.set(deviceId, state);
  }
}
