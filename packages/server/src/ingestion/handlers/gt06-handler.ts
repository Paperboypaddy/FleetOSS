import net from 'net';
import type { IngestedPosition } from '@fleetoss/core';
import { parseGt06, buildGt06Response, parseGt06GpsData, parseGt06Imei } from '../protocols/gt06.js';
import { parseTk103 } from '../protocols/tk103.js';

export function gt06Handler(socket: net.Socket, ingest: (data: IngestedPosition, protocol: string) => Promise<void>) {
  let buffer = Buffer.alloc(0);
  let textBuffer = '';
  let deviceId = '';
  const addr = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`5001: client connected from ${addr}`);

  socket.on('error', (err) => {
    console.error(`5001: socket error from ${addr}: ${err.message}`);
  });

  socket.on('close', () => {
    console.log(`5001: client disconnected from ${addr}`);
  });

  socket.on('data', async (chunk: Buffer) => {
    console.log(`5001: received ${chunk.length} bytes from ${addr}`);

    // Try GT06 binary protocol first
    buffer = Buffer.concat([buffer, chunk]);
    let parsed = true;
    while (parsed) {
      const result = parseGt06(buffer);
      parsed = false;
      if (result) {
        parsed = true;
        const { message, consumed } = result;
        buffer = buffer.slice(consumed);

        if (message.type === 0x01) {
          deviceId = parseGt06Imei(message.data);
          socket.write(buildGt06Response(0x01));
          console.log(`5001: GT06 login from device ${deviceId}`);
        } else if ((message.type === 0x12 || message.type === 0x22) && deviceId) {
          const gps = parseGt06GpsData(message.data);
          if (gps && gps.latitude !== undefined && gps.longitude !== undefined) {
            const position: IngestedPosition = {
              deviceId, latitude: gps.latitude, longitude: gps.longitude,
              speed: gps.speed, bearing: gps.bearing,
              timestamp: gps.timestamp || new Date().toISOString(),
            };
            try { await ingest(position, 'gt06'); } catch {}
            socket.write(buildGt06Response(0x12));
          }
        } else if (message.type === 0x13) {
          socket.write(buildGt06Response(0x13));
        }
      }
    }

    // If GT06 didn't consume it, try TK103 text protocol (*HQ, or ##, format)
    if (buffer.length > 0) {
      textBuffer += buffer.toString();
      buffer = Buffer.alloc(0);
      const lines = textBuffer.split('\n');
      textBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || (!trimmed.startsWith('*HQ,') && !trimmed.startsWith('##,'))) continue;

        const msg = parseTk103(trimmed);
        if (!msg || msg.type !== 'position' || !msg.data) {
          if (msg && (msg.type === 'login' || msg.type === 'heartbeat')) {
            socket.write('ON\n');
          }
          continue;
        }

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
          console.log(`5001: TK103 position from ${msg.deviceId}`);
        } catch {}
        socket.write('LOAD\n');
      }
    }
  });
}
