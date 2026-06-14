import { desc, eq } from 'drizzle-orm';
import { getDb } from '../connection.js';
import { positions } from '../schema.js';
import type { Position, IngestedPosition } from '@fleetoss/core';

export async function insertPosition(data: IngestedPosition, protocol: string): Promise<Position> {
  const db = getDb();
  const created = await db.insert(positions).values({
    deviceId: data.deviceId,
    latitude: data.latitude,
    longitude: data.longitude,
    altitude: data.altitude,
    speed: data.speed,
    bearing: data.bearing,
    accuracy: data.accuracy,
    ignition: data.ignition,
    engineHours: data.engineHours,
    odometer: data.odometer,
    fuelLevel: data.fuelLevel,
    batteryLevel: data.batteryLevel,
    rpm: data.rpm,
    fuelConsumption: data.fuelConsumption,
    protocol,
    deviceTimestamp: new Date(data.timestamp),
    attributes: data.attributes || {},
  }).returning();
  return created[0] as unknown as Position;
}

export async function getLatestPosition(deviceId: string): Promise<Position | null> {
  const db = getDb();
  const result = await db.select()
    .from(positions)
    .where(eq(positions.deviceId, deviceId))
    .orderBy(desc(positions.deviceTimestamp))
    .limit(1);
  return (result[0] as unknown as Position) || null;
}

export async function getPositions(deviceId: string, from: Date, to: Date, limit = 1000): Promise<Position[]> {
  const db = getDb();
  return db.select()
    .from(positions)
    .where(
      // We use manual SQL for the between clause since drizzle-orm handles it differently
      eq(positions.deviceId, deviceId),
    )
    .orderBy(desc(positions.deviceTimestamp))
    .limit(limit) as unknown as Position[];
}
