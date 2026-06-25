import net from 'net';
import type { IngestedPosition } from '@fleetoss/core';
import { parseTk103 } from '../protocols/tk103.js';

export function tk103Handler(socket: net.Socket, ingest: (data: IngestedPosition, protocol: string) => Promise<void>) {
  let buffer = '';
  const addr = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`TK103: client connected from ${addr}`);

  socket.on('error', (err) => {
    console.error(`TK103: socket error from ${addr}: ${err.message}`);
  });

  socket.on('close', () => {
    console.log(`TK103: client disconnected from ${addr}`);
  });

  socket.on('data', async (chunk: Buffer) => {
    buffer += chunk.toString();
    console.log(`TK103: received ${chunk.length} bytes from ${addr}`);

    // Try to extract messages. Devices may send without newlines,
    // so split by known message boundaries (*HQ, ##,imei:, etc.)
    const messages: string[] = [];
    let idx = 0;
    while (idx < buffer.length) {
      const nextHQ = buffer.indexOf('*HQ,', idx);
      const nextHash = buffer.indexOf('##,', idx);
      let nextStart = -1;
      if (nextHQ >= 0 && nextHash >= 0) nextStart = Math.min(nextHQ, nextHash);
      else if (nextHQ >= 0) nextStart = nextHQ;
      else if (nextHash >= 0) nextStart = nextHash;

      if (nextStart < 0) break; // no more messages

      // Find the end of this message — next start marker or end of string
      const searchFrom = nextStart + 1;
      const nextHQ2 = buffer.indexOf('*HQ,', searchFrom);
      const nextHash2 = buffer.indexOf('##,', searchFrom);
      let nextEnd = -1;
      if (nextHQ2 >= 0 && nextHash2 >= 0) nextEnd = Math.min(nextHQ2, nextHash2);
      else if (nextHQ2 >= 0) nextEnd = nextHQ2;
      else if (nextHash2 >= 0) nextEnd = nextHash2;
      else nextEnd = buffer.length;

      messages.push(buffer.slice(nextStart, nextEnd));
      idx = nextEnd;
    }
    buffer = buffer.slice(idx);

    for (const msg of messages) {
      const trimmed = msg.trim();
      if (!trimmed) continue;
      console.log(`TK103: parsing: ${trimmed.slice(0, 80)}...`);

      const parsed = parseTk103(trimmed);
      if (!parsed) continue;

      if (parsed.type === 'position' && parsed.data && parsed.data.latitude != null && parsed.data.longitude != null) {
        const position: IngestedPosition = {
          deviceId: parsed.deviceId,
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
          speed: parsed.data.speed,
          bearing: parsed.data.bearing,
          timestamp: parsed.data.timestamp || new Date().toISOString(),
        };
        try {
          await ingest(position, 'tk103');
          console.log(`TK103: position saved for device ${parsed.deviceId} at ${parsed.data.latitude},${parsed.data.longitude}`);
        } catch (e: unknown) {
          console.error(`TK103: ingest error for ${parsed.deviceId}: ${e instanceof Error ? e.message : 'unknown'}`);
        }
        socket.write('LOAD\n');
      } else if (parsed.type === 'login' || parsed.type === 'heartbeat') {
        console.log(`TK103: ${parsed.type} from ${parsed.deviceId}`);
        socket.write('ON\n');
      }
    }
  });
}
