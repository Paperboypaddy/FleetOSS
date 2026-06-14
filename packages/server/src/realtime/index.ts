import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { Position } from '@fleetoss/core';

interface WsClient {
  socket: WebSocket;
  deviceFilter?: string[];
}

const clients = new Set<WsClient>();

export function registerRealtime(app: FastifyInstance) {
  app.get('/ws', { websocket: true }, (socket, request) => {
    const client: WsClient = { socket };

    socket.on('message', (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'subscribe' && msg.deviceIds) {
          client.deviceFilter = msg.deviceIds;
        }
      } catch {}
    });

    socket.on('close', () => {
      clients.delete(client);
    });

    clients.add(client);
  });
}

export function broadcastPosition(position: Position) {
  const msg = JSON.stringify({ type: 'position', data: position });
  for (const client of clients) {
    try {
      if (client.socket.readyState === 1) {
        client.socket.send(msg);
      }
    } catch {
      clients.delete(client);
    }
  }
}
