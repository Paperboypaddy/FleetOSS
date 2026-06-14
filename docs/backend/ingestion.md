# GPS Ingestion System

The ingestion system is designed to be **protocol-agnostic** — any GPS device or app can push position data, regardless of the wire format.

## Architecture

```
GPS Device / Android App (any protocol)
        │
        ▼
  ┌──────────────┐
  │ Rate Limiter  │  ← Sliding window (60 req/min/IP)
  └──────┬───────┘
         │
  ┌──────┴──────┐
  │  Protocol   │  ← Pluggable: one file per protocol
  │  Parser     │
  └──────┬──────┘
         │
  ┌──────┴──────┐
  │  Repository │  ← Stores in PostgreSQL
  └──────┬──────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
  WS        Redis
  clients   Pub/Sub
    │         │
    │    ┌────┴────┐
    │    │ Geocode │
    │    │ Queue   │  ← BLPOP worker → Nominatim
    │    └─────────┘
    │
  ┌──────┴──────┐
  │  Trip       │  ← Redis-backed state (persistent)
  │  Detector   │
  └─────────────┘
```

## Endpoints

### `POST /api/ingest`
Accept a single GPS position.

**Rate limiting:** 60 requests per minute per IP (sliding window via Redis sorted sets). Returns `429 Too Many Requests` when exceeded. Falls open (allows all) if Redis is unavailable.

**Request body (JSON):**
```json
{
  "deviceId": "my-phone-001",
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
  "timestamp": "2026-06-13T12:00:00Z",
  "attributes": {
    "source": "gps-logger-android"
  }
}
```

**Response:** `201 Created`
```json
{ "id": "uuid-of-saved-position" }
```

Only `deviceId`, `latitude`, and `longitude` are required. Everything else is optional.

### `POST /api/ingest/batch`
Accept multiple positions in a single request.

**Request body:** Array of position objects (same format as single).

**Response:** `201 Created` with array of IDs:
```json
[{ "id": "uuid-1" }, { "id": "uuid-2" }]
```

## Protocol Parsers

Each protocol parser lives in `packages/server/src/ingestion/protocols/` and exports a function that transforms raw input into a typed `IngestedPosition`.

### http-json.ts (current)
Parses standard HTTP JSON POST bodies. Uses **Zod** for validation.

**Validation rules:**
- `deviceId` — required, non-empty string
- `latitude` — required, range -90 to 90
- `longitude` — required, range -180 to 180
- `speed` — optional, >= 0
- `bearing` — optional, 0–360
- All other fields are optional with appropriate type constraints

### Future Parsers (planned)

| Protocol | File | Source |
|----------|------|--------|
| NMEA/GPRMC | `protocols/nmea.ts` | Standard GPS sentence format, many trackers |
| TK103 | `protocols/tk103.ts` | Chinese GPS trackers (traccar-compatible) |
| GT06 | `protocols/gt06.ts` | Another common Chinese tracker protocol |
| OBD-II ELM327 | `protocols/obd.ts` | Vehicle diagnostic data via Bluetooth/WiFi |

## Adding a New Protocol

1. Create a new file in `packages/server/src/ingestion/protocols/`
2. Export a function that parses input and returns `IngestedPosition`
3. Add a new route in `ingestion/server.ts` that calls the parser
4. (Optional) Register a TCP/UDP listener for non-HTTP protocols

### Protocol Interface

```typescript
// Each protocol parser should export a function matching this signature:
function parse(raw: unknown): IngestedPosition
```

The `IngestedPosition` type is defined in `packages/core/src/index.ts`:
```typescript
interface IngestedPosition {
  deviceId: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  bearing?: number;
  accuracy?: number;
  ignition?: boolean;
  engineHours?: number;
  odometer?: number;
  fuelLevel?: number;
  batteryLevel?: number;
  rpm?: number;
  fuelConsumption?: number;
  timestamp: string;       // ISO 8601
  attributes?: Record<string, unknown>;
}
```

## Android Phone Integration

For first real GPS data from an Android phone:

1. Install **GPS Logger** or **Traccar Client** from Google Play
2. Configure HTTP endpoint: `http://<server-ip>:4000/api/ingest`
3. Set JSON format
4. Phone will POST position updates at regular intervals

Future: Build a dedicated FleetOSS Android app for better control.
