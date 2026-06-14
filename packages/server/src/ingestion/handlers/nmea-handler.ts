import net from 'net';
import type { IngestedPosition } from '@fleetoss/core';
import { parseNmeaSentence } from '../protocols/nmea.js';

export function nmeaHandler(socket: net.Socket, ingest: (data: IngestedPosition, protocol: string) => Promise<void>) {
  const remote = `${socket.remoteAddress}:${socket.remotePort}`;
  let buffer = '';

  socket.on('data', async (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const sentence = line.trim().replace(/\r$/, '');
      if (!sentence || !sentence.startsWith('$')) continue;

      const deviceId = `nmea-${remote.replace(/[.:]/g, '-')}`;
      const position = parseNmeaSentence(sentence, deviceId);
      if (position) {
        try {
          await ingest(position, 'nmea');
        } catch {}
      }
    }
  });

  socket.on('error', () => {});
}
