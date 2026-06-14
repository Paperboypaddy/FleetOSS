import type { Position } from '@fleetoss/core';
import { getDb } from '../db/connection.js';
import { trips } from '../db/schema.js';

const MOVING_SPEED_THRESHOLD = 2; // mph
const STOP_DURATION_THRESHOLD = 300; // 5 minutes

interface DeviceTripState {
  tripStarted: boolean;
  startPosition: Position;
  startTime: Date;
  lastPosition: Position; // last processed position (for wasMoving check)
  stopStartTime: number | null;
  maxSpeed: number;
  totalDistance: number;
}

const deviceState = new Map<string, DeviceTripState>();

export async function detectTrip(deviceId: string, position: Position) {
  let state = deviceState.get(deviceId);
  const speed = position.speed || 0;
  const isMoving = speed > MOVING_SPEED_THRESHOLD;
  const wasMoving = state ? (state.lastPosition.speed || 0) > MOVING_SPEED_THRESHOLD : false;

  if (!state) {
    // First position for this device since restart
    if (isMoving) {
      // Moving from unknown state — start a trip
      deviceState.set(deviceId, {
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
    // Trip started — device began moving after being stopped
    deviceState.set(deviceId, {
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
      // Still moving — update trip state, reset stop timer
      const dlat = (position.latitude - state.lastPosition.latitude) * 69;
      const dlng = (position.longitude - state.lastPosition.longitude) * 69 * Math.cos(position.latitude * Math.PI / 180);
      state.totalDistance += Math.sqrt(dlat * dlat + dlng * dlng);
      state.lastPosition = position;
      if (speed > state.maxSpeed) state.maxSpeed = speed;
      state.stopStartTime = null;
      deviceState.set(deviceId, state);
    } else if (!isMoving && wasMoving) {
      // Just stopped — record when stop started
      state.lastPosition = position;
      state.stopStartTime = Date.now();
      deviceState.set(deviceId, state);
    } else if (!isMoving && !wasMoving && state.stopStartTime) {
      // Still stopped — check if stop duration threshold exceeded
      const stopDuration = (Date.now() - state.stopStartTime) / 1000;
      state.lastPosition = position;

      if (stopDuration >= STOP_DURATION_THRESHOLD) {
        // Trip ended — device has been stopped long enough
        const endTime = new Date(position.deviceTimestamp);
        const duration = (endTime.getTime() - state.startTime.getTime()) / 1000;

        if (duration >= 30 && state.totalDistance > 0.1) {
          const db = getDb();
          await db.insert(trips).values({
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
          });
        }

        deviceState.delete(deviceId);
      } else {
        deviceState.set(deviceId, state);
      }
    } else {
      // Position received while trip is active but no state change
      state.lastPosition = position;
      deviceState.set(deviceId, state);
    }
  } else {
    // Not in a trip — just track last position
    state.lastPosition = position;
    deviceState.set(deviceId, state);
  }
}
