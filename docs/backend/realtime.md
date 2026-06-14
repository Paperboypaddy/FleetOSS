# Real-Time & WebSocket

FleetOSS uses WebSockets to stream live GPS positions and device status changes to connected clients.

## Connection

Connect to the WebSocket endpoint:

```
ws://localhost:4000/ws
```

The server uses Fastify's `@fastify/websocket` plugin for WebSocket support.

## Client Messages

### Subscribe to Specific Devices

Clients can optionally filter which device updates they receive:

```json
{
  "type": "subscribe",
  "deviceIds": ["device-uuid-1", "device-uuid-2"]
}
```

Without subscribing, clients receive all position updates.

## Server Messages

### Position Update

Sent whenever a new GPS position is ingested:

```json
{
  "type": "position",
  "data": {
    "id": "uuid",
    "deviceId": "device-uuid",
    "latitude": 47.718,
    "longitude": -116.945,
    "speed": 34,
    "bearing": 180,
    "altitude": 620,
    "accuracy": 5,
    "ignition": true,
    "valid": true,
    "protocol": "http-json",
    "attributes": {},
    "deviceTimestamp": "2026-06-13T12:00:00.000Z",
    "serverTimestamp": "2026-06-13T12:00:01.000Z"
  }
}
```

## Broadcast Flow

```
Position ingested via POST /api/ingest
        │
        ▼
Stored in PostgreSQL
        │
        ▼
broadcastPosition(position)
        │
        ▼
Iterates all connected WebSocket clients
        │
        ├─ Checks if client has deviceFilter
        │     ├─ No filter → send to all
        │     └─ Has filter → only send if deviceId matches
        ├─ Checks readyState === 1 (OPEN)
        └─ Sends JSON message
```

## Frontend Integration (Planned)

The frontend will connect to the WebSocket to receive live position updates:

```typescript
const ws = new WebSocket('ws://localhost:4000/ws')

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  if (msg.type === 'position') {
    updateMarkerOnMap(msg.data)
    updateDeviceInList(msg.data)
  }
}
```

This will replace the current mock data polling with real-time data from the server.

## Event Types (Planned)

Future WebSocket event types:

| Event | Description |
|-------|-------------|
| `position` | New GPS position |
| `deviceStatus` | Device online/offline change |
| `event` | System event (geofence, alarm, etc.) |
| `trip` | Completed trip notification |
