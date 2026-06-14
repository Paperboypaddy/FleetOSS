import { z } from 'zod';
const httpJsonPositionSchema = z.object({
    deviceId: z.string().min(1),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    altitude: z.number().optional(),
    speed: z.number().min(0).optional(),
    bearing: z.number().min(0).max(360).optional(),
    accuracy: z.number().min(0).optional(),
    ignition: z.boolean().optional(),
    engineHours: z.number().min(0).optional(),
    odometer: z.number().min(0).optional(),
    fuelLevel: z.number().min(0).max(100).optional(),
    batteryLevel: z.number().min(0).max(100).optional(),
    rpm: z.number().min(0).optional(),
    timestamp: z.string().datetime().optional(),
    attributes: z.record(z.unknown()).optional(),
});
export function parseHttpJson(body) {
    const parsed = httpJsonPositionSchema.parse(body);
    return {
        ...parsed,
        timestamp: parsed.timestamp || new Date().toISOString(),
    };
}
//# sourceMappingURL=http-json.js.map