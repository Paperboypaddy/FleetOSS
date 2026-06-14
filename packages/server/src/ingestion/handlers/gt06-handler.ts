import net from 'net';
import type { IngestedPosition } from '@fleetoss/core';
import { parseGt06, buildGt06Response, parseGt06GpsData, parseGt06Imei } from '../protocols/gt06.js';

export function gt06Handler(socket: net.Socket, ingest: (data: IngestedPosition, protocol: string) => Promise<void>) {
  let buffer = Buffer.alloc(0);
  let deviceId = '';

  socket.on('data', async (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (true) {
      const result = parseGt06(buffer);
      if (!result) break;

      const { message, consumed } = result;
      buffer = buffer.slice(consumed);

      if (message.type === 0x01) {
        // Login — IMEI
        deviceId = parseGt06Imei(message.data);
        socket.write(buildGt06Response(0x01));
      } else if ((message.type === 0x12 || message.type === 0x22) && deviceId) {
        const parsed = parseGt06GpsData(message.data);
        if (parsed && parsed.latitude !== undefined && parsed.longitude !== undefined) {
          const position: IngestedPosition = {
            deviceId,
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            speed: parsed.speed,
            bearing: parsed.bearing,
            timestamp: parsed.timestamp || new Date().toISOString(),
          };
          try {
            await ingest(position, 'gt06');
          } catch {}
          socket.write(buildGt06Response(0x12));
        }
      } else if (message.type === 0x13) {
        socket.write(buildGt06Response(0x13));
      }
    }
  });

  socket.on('error', () => {});
}
