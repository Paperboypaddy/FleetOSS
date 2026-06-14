import net from 'net';
import { parseNmeaSentence } from './protocols/nmea.js';
import { insertPosition } from '../db/repositories/position.js';
import { findOrCreateDevice, updateDeviceStatus } from '../db/repositories/device.js';
import { broadcastPosition } from '../realtime/index.js';
import { detectTrip } from '../core/trip-detector.js';

async function ingest(data: import('@fleetoss/core').IngestedPosition, protocol: string) {
  const device = await findOrCreateDevice(data.deviceId);
  const position = await insertPosition({ ...data, deviceId: device.id }, protocol);
  await updateDeviceStatus(device.id, 'online');
  broadcastPosition(position);
  detectTrip(device.id, position);
}

export function startTcpServer(port: number) {
  const server = net.createServer(socket => {
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
          } catch (err) {
            console.error('[NMEA] Ingest error:', err);
          }
        }
      }
    });

    socket.on('error', () => {});
    socket.on('close', () => {});
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`NMEA TCP server listening on port ${port}`);
  });

  return server;
}
