import type { Device } from '@fleetoss/core';
export declare function findOrCreateDevice(uniqueId: string, name?: string): Promise<Device>;
export declare function updateDeviceStatus(deviceId: string, status: 'online' | 'offline'): Promise<void>;
export declare function listDevices(): Promise<Device[]>;
export declare function getDeviceById(id: string): Promise<Device | null>;
//# sourceMappingURL=device.d.ts.map