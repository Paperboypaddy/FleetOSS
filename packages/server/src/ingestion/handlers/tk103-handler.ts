import net from 'net';
import type { IngestedPosition } from '@fleetoss/core';
import { parseTk103 } from '../protocols/tk103.js';

export function tk103Handler(socket: net.Socket, ingest: (data: IngestedPosition, protocol: string) => Promise<void>) {
  let buffer = '';

  socket.on('data', async (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('##,')) continue;

      const msg = parseTk103(trimmed);
      if (!msg) continue;

      if (msg.type === 'login' || msg.type === 'heartbeat') {
        socket.write('ON\n');
      } else if (msg.type === 'position' && msg.data) {
        const position: IngestedPosition = {
          deviceId: msg.deviceId,
          latitude: msg.data.latitude!,
          longitude: msg.data.longitude!,
          speed: msg.data.speed,
          bearing: msg.data.bearing,
          timestamp: msg.data.timestamp || new Date().toISOString(),
        };
        try {
          await ingest(position, 'tk103');
        } catch {}
        socket.write('LOAD\n');
      }
    }
  });

  socket.on('error', () => {});
}
