import { eq } from 'drizzle-orm';
import { getDb } from '../connection.js';
import { devices } from '../schema.js';
import type { Device } from '@fleetoss/core';

export async function findOrCreateDevice(uniqueId: string, name?: string): Promise<Device> {
  const db = getDb();
  const existing = await db.select().from(devices).where(eq(devices.uniqueId, uniqueId)).limit(1);
  if (existing.length > 0) return existing[0] as unknown as Device;

  const created = await db.insert(devices).values({
    uniqueId,
    name: name || uniqueId,
    status: 'online',
  }).returning();
  return created[0] as unknown as Device;
}

export async function updateDeviceStatus(deviceId: string, status: 'online' | 'offline') {
  const db = getDb();
  await db.update(devices).set({ status, updatedAt: new Date() }).where(eq(devices.id, deviceId));
}

export async function listDevices(): Promise<Device[]> {
  const db = getDb();
  return db.select().from(devices) as unknown as Device[];
}

export async function getDeviceById(id: string): Promise<Device | null> {
  const db = getDb();
  const result = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
  return (result[0] as unknown as Device) || null;
}

export async function updateDeviceName(deviceId: string, name: string): Promise<Device> {
  const db = getDb();
  const result = await db.update(devices)
    .set({ name, updatedAt: new Date() })
    .where(eq(devices.id, deviceId))
    .returning();
  return result[0] as unknown as Device;
}

export async function deleteDeviceById(deviceId: string): Promise<void> {
  const db = getDb();
  await db.delete(devices).where(eq(devices.id, deviceId));
}
