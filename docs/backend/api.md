# API Reference

Base URL: `http://localhost:4000/api`

## Health

### `GET /api/health`

Returns server status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-06-13T16:30:00.000Z"
}
```

## Devices

### `GET /api/devices`

List all registered devices.

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "T1N Sprinter",
    "uniqueId": "t1n-sprinter-001",
    "plate": "ABC-1234",
    "vin": null,
    "status": "online",
    "attributes": {},
    "createdAt": "2026-06-13T12:00:00.000Z",
    "updatedAt": "2026-06-13T16:30:00.000Z"
  }
]
```

### `GET /api/devices/:id`

Get a single device by UUID.

**Response:** `200 OK` with device object, or `404 Not Found`.

## Ingestion

### `POST /api/ingest`

Ingest a single GPS position.

**Request body** (JSON):
```json
{
  "deviceId": "test-001",
  "latitude": 47.718,
  "longitude": -116.945,
  "speed": 34,
  "bearing": 180,
  "altitude": 620,
  "accuracy": 5,
  "ignition": true,
  "odometer": 187432,
  "fuelLevel": 75,
  "batteryLevel": 85,
  "rpm": 2200,
  "fuelConsumption": 0.04,
  "timestamp": "2026-06-13T12:00:00Z",
  "attributes": { "source": "android-phone" }
}
```

**Response:** `201 Created`
```json
{ "id": "uuid-of-saved-position" }
```

**Validation errors:** `400 Bad Request`
```json
{
  "error": "Validation failed",
  "details": [
    { "code": "invalid_type", "expected": "number", "received": "string", "path": ["latitude"], "message": "Expected number, received string" }
  ]
}
```

### `POST /api/ingest/batch`

Ingest multiple positions in one request.

**Request body** (JSON array):
```json
[
  { "deviceId": "test-001", "latitude": 47.718, "longitude": -116.945, "speed": 34, "timestamp": "2026-06-13T12:00:00Z" },
  { "deviceId": "test-001", "latitude": 47.719, "longitude": -116.946, "speed": 35, "timestamp": "2026-06-13T12:01:00Z" }
]
```

**Response:** `201 Created`
```json
[{ "id": "uuid-1" }, { "id": "uuid-2" }]
```

## WebSocket

### `ws://localhost:4000/ws`

See [Real-Time & WebSocket](realtime.md) for details.

## Planned Endpoints

These are not yet implemented but are in the project roadmap:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/trips` | List trips (with deviceId, dateFrom, dateTo filters) |
| GET | `/api/trips/:id` | Get trip details |
| GET | `/api/positions` | Get positions (with deviceId, from, to, limit params) |
| CRUD | `/api/geofences` | Manage geofences |
| GET | `/api/events` | List events |
| POST | `/api/register` | User registration |
| POST | `/api/login` | User login (JWT) |

## Error Format

All errors follow a consistent format:

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Device not found"
}
```
