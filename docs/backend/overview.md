# Backend Overview

The FleetOSS backend is a **Fastify 5** API server with **PostgreSQL + PostGIS** for geospatial data, **Drizzle ORM** for type-safe queries, and **WebSocket** for real-time position streaming.

## Stack

| Technology | Purpose |
|-----------|---------|
| Fastify 5 | HTTP server framework (fast, schema-based, plugin architecture) |
| TypeScript 5 | Strict mode, ESM throughout |
| Drizzle ORM | Type-safe SQL queries with PostgreSQL dialect |
| PostgreSQL 16 | Primary database |
| PostGIS 3.4 | Geospatial extension (geometry indexes, spatial queries) |
| Zod | Runtime request validation (used in ingestion) |
| @fastify/websocket | WebSocket for real-time position streaming |
| pg (node-postgres) | PostgreSQL driver |
| pino-pretty | Human-readable logging |

## Directory Structure

```
packages/server/src/
├── index.ts                        # Server entry point
├── config/
│   └── index.ts                    # Environment config loader
├── db/
│   ├── connection.ts               # Drizzle + pg Pool singleton
│   ├── schema.ts                   # Drizzle ORM table definitions
│   ├── migrate.ts                  # Raw SQL migration script
│   ├── seed.ts                     # Demo data seeder
│   └── repositories/
│       ├── device.ts               # Device CRUD operations
│       └── position.ts             # Position insert/query operations
├── ingestion/
│   ├── server.ts                   # POST /api/ingest and /api/ingest/batch
│   └── protocols/
│       └── http-json.ts            # HTTP/JSON GPS protocol parser
├── api/
│   └── routes/
│       └── devices.ts              # GET /api/devices, GET /api/devices/:id
├── realtime/
│   └── index.ts                    # WebSocket server + broadcast
└── core/
    └── trip-detector.ts            # Speed-based trip start/end detection
```

## Request Flow

```
GPS Device / Android App
        │
        ▼
POST /api/ingest
        │
        ├─ Zod validation (parseHttpJson)
        ├─ findOrCreateDevice (auto-registers unknown devices)
        ├─ insertPosition (stores in PostgreSQL)
        ├─ updateDeviceStatus (marks device online)
        ├─ broadcastPosition (pushes to WebSocket clients)
        └─ detectTrip (evaluates trip start/end)
```

## Configuration

Environment variables in `packages/server/.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Server listen port |
| `HOST` | `0.0.0.0` | Server bind address |
| `DATABASE_URL` | postgres://fleetoss:fleetoss_dev@localhost:5432/fleetoss | PostgreSQL connection string |
| `JWT_SECRET` | `change-me-in-production` | Token signing key |
| `S3_ENDPOINT` | `http://localhost:9000` | MinIO/S3 endpoint |
| `S3_ACCESS_KEY` | `fleetoss` | S3 access key |
| `S3_SECRET_KEY` | `fleetoss_dev` | S3 secret key |
| `S3_BUCKET` | `fleetoss` | S3 bucket name |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |

## Development

```bash
# Start the server with hot-reload
npm run dev -w packages/server

# Run database migration
npm run db:migrate -w packages/server

# Seed demo data
npm run db:seed -w packages/server

# Build for production
npm run build -w packages/server
```

## Logging

The server uses Pino with `pino-pretty` for development. Log format:
```
16:30:05 INFO  Server listening on http://0.0.0.0:4000
16:30:05 INFO  Ingested position for device test-001
```
