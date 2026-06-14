import { eq } from 'drizzle-orm';
import { getDb } from '../connection.js';
import { devices } from '../schema.js';
export async function findOrCreateDevice(uniqueId, name) {
    const db = getDb();
    const existing = await db.select().from(devices).where(eq(devices.uniqueId, uniqueId)).limit(1);
    if (existing.length > 0)
        return existing[0];
    const created = await db.insert(devices).values({
        uniqueId,
        name: name || uniqueId,
        status: 'online',
    }).returning();
    return created[0];
}
export async function updateDeviceStatus(deviceId, status) {
    const db = getDb();
    await db.update(devices).set({ status, updatedAt: new Date() }).where(eq(devices.id, deviceId));
}
export async function listDevices() {
    const db = getDb();
    return db.select().from(devices);
}
export async function getDeviceById(id) {
    const db = getDb();
    const result = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
    return result[0] || null;
}
//# sourceMappingURL=device.js.map