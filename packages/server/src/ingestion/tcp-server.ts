import net from 'net';
import type { IngestedPosition } from '@fleetoss/core';
import { insertPosition } from '../db/repositories/position.js';
import { findOrCreateDevice, updateDeviceStatus } from '../db/repositories/device.js';
import { broadcastPosition } from '../realtime/index.js';
import { detectTrip } from '../core/trip-detector.js';

async function ingest(data: IngestedPosition, protocol: string) {
  const device = await findOrCreateDevice(data.deviceId);
  const position = await insertPosition({ ...data, deviceId: device.id }, protocol);
  await updateDeviceStatus(device.id, 'online');
  broadcastPosition(position);
  detectTrip(device.id, position);
}

export type TcpHandler = (socket: net.Socket, ingestFn: typeof ingest) => void;

export function startTcpServer(port: number, label: string, handler: TcpHandler) {
  const server = net.createServer(socket => {
    handler(socket, ingest);
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`${label} TCP server listening on port ${port}`);
  });

  server.on('error', (err: any) => {
    console.error(`${label} server error on port ${port}: ${err.message}`);
  });

  return server;
}
