import type { Position, IngestedPosition } from '@fleetoss/core';
export declare function insertPosition(data: IngestedPosition, protocol: string): Promise<Position>;
export declare function getLatestPosition(deviceId: string): Promise<Position | null>;
export declare function getPositions(deviceId: string, from: Date, to: Date, limit?: number): Promise<Position[]>;
//# sourceMappingURL=position.d.ts.map