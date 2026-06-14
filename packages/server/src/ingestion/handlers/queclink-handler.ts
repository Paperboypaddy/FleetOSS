import net from 'net';
import type { IngestedPosition } from '@fleetoss/core';
import { parseQueclink, buildQueclinkAck } from '../protocols/queclink.js';

export function queclinkHandler(socket: net.Socket, ingest: (data: IngestedPosition, protocol: string) => Promise<void>) {
  let buffer = '';

  socket.on('data', async (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim().replace(/\r$/, '');
      if (!trimmed || !trimmed.startsWith('+RESP:')) continue;

      const msg = parseQueclink(trimmed);
      if (!msg) continue;

      if (msg.type === 'position' && msg.data) {
        const position: IngestedPosition = {
          deviceId: msg.deviceId,
          latitude: msg.data.latitude!,
          longitude: msg.data.longitude!,
          speed: msg.data.speed,
          bearing: msg.data.bearing,
          altitude: msg.data.altitude,
          timestamp: msg.data.timestamp || new Date().toISOString(),
        };
        try {
          await ingest(position, 'queclink');
        } catch {}
        socket.write(buildQueclinkAck(msg.ackId));
      } else {
        // Acknowledge login/heartbeat
        socket.write(buildQueclinkAck(msg.ackId));
      }
    }
  });

  socket.on('error', () => {});
}
