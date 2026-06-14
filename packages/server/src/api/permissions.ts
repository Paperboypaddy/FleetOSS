import { getDb } from '../db/connection.js';
import { users, groupDevices, userGroups } from '../db/schema.js';
import { eq, inArray, or, sql } from 'drizzle-orm';

export type DevicePermission = 'view' | 'manage' | 'admin';

/**
 * Get all device IDs a user has access to, mapped to their max permission level.
 * Admin users get access to ALL devices.
 */
export async function getUserDevicePermissions(userId: string, userRole: string): Promise<Map<string, DevicePermission>> {
  const perms = new Map<string, DevicePermission>();

  // Admins get full access to everything — return empty map to signal "all"
  if (userRole === 'admin') return perms;

  const db = getDb();

  // Find all groups this user belongs to
  const memberships = await db.select({ groupId: userGroups.groupId })
    .from(userGroups)
    .where(eq(userGroups.userId, userId));

  if (memberships.length === 0) return perms;

  const groupIds = memberships.map(m => m.groupId);

  // Get all device assignments for those groups with max permission per device
  const assignments = await db.select({
    deviceId: groupDevices.deviceId,
    permission: groupDevices.permission,
  }).from(groupDevices).where(inArray(groupDevices.groupId, groupIds));

  for (const a of assignments) {
    const existing = perms.get(a.deviceId);
    const rank = (p: string) => p === 'admin' ? 3 : p === 'manage' ? 2 : 1;
    if (!existing || rank(a.permission) > rank(existing)) {
      perms.set(a.deviceId, a.permission as DevicePermission);
    }
  }

  return perms;
}

/**
 * Check if a user has at least the required permission level for a device.
 * Returns true if user is admin, has direct permission, or inherits via groups.
 */
export async function checkDevicePermission(
  userId: string, userRole: string, deviceId: string, required: DevicePermission
): Promise<boolean> {
  if (userRole === 'admin') return true;
  const perms = await getUserDevicePermissions(userId, userRole);
  const level = perms.get(deviceId);
  if (!level) return false;
  const rank = (p: string) => p === 'admin' ? 3 : p === 'manage' ? 2 : 1;
  return rank(level) >= rank(required);
}

/**
 * Apply device permission filtering to a query: adds WHERE clause to filter
 * results to devices the user can access. For admins, returns null (no filter needed).
 */
export async function getAccessibleDeviceIds(userId: string, userRole: string): Promise<string[] | null> {
  if (userRole === 'admin') return null; // null = all devices
  const perms = await getUserDevicePermissions(userId, userRole);
  return Array.from(perms.keys());
}
