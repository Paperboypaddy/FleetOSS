import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { Position } from '@fleetoss/core';
import { getRedis } from '../db/redis.js';

const POSITION_CHANNEL = 'positions';

interface WsClient {
  socket: WebSocket;
  deviceFilter?: string[];
}

const clients = new Set<WsClient>();
let subscribed = false;

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

  // Subscribe to Redis channel for multi-instance fan-out
  subscribeToRedis();
}

function subscribeToRedis() {
  if (subscribed) return;
  const redis = getRedis();
  if (!redis) return;

  const sub = redis.duplicate();
  sub.subscribe(POSITION_CHANNEL, () => {
    subscribed = true;
  });
  sub.on('message', (_channel, raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'position' && msg.data) {
        broadcastToLocalClients(msg.data);
      }
    } catch {}
  });
}

export function broadcastPosition(position: Position) {
  // Forward to local WebSocket clients
  broadcastToLocalClients(position);

  // Publish to Redis for other server instances
  const redis = getRedis();
  if (redis) {
    redis.publish(POSITION_CHANNEL, JSON.stringify({ type: 'position', data: position })).catch(() => {});
  }
}

function broadcastToLocalClients(position: Position) {
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
