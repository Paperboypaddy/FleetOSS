# Deployment Guide

## Prerequisites

- Node.js 20+
- Docker & Docker Compose (for database)
- npm workspaces support

## Quick Start

```bash
# 1. Start infrastructure (PostgreSQL + PostGIS, MinIO, Redis)
docker compose up -d

# 2. Install dependencies
npm install

# 3. Build shared types
npm run build -w packages/core

# 4. Configure the server
cp packages/server/.env.example packages/server/.env
# Edit .env if needed (defaults work with Docker Compose)

# 5. Run database migrations
npm run db:migrate

# 6. (Optional) Seed demo data
npm run db:seed -w packages/server

# 7. Start the backend
npm run dev
# Server starts on http://localhost:4000

# 8. In another terminal, start the frontend
cd app && npm run dev
# Frontend starts on http://localhost:5173
```

## Docker Compose Services

| Service | Port  | Purpose                      |
|---------|-------|------------------------------|
| PostGIS | 5432  | Geospatial database          |
| MinIO   | 9000  | S3-compatible object storage |
| MinIO Console | 9001 | MinIO web admin        |
| Redis   | 6379  | Caching / pub-sub            |

## Production Deployment

### Backend
```bash
# Build
npm run build

# Run (after building)
node packages/server/dist/index.js
```

### Frontend
```bash
cd app
npm run build
# Serve dist/ with nginx or your CDN of choice
```

### Docker (future)
The project includes Dockerfiles for both frontend and backend in the planned infrastructure phase. See `AGENTS.md` for priority.

## Testing Ingestion

Once the server is running, test GPS ingestion:

```bash
# Single position
curl -X POST http://localhost:4000/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"test-001","latitude":47.718,"longitude":-116.945,"speed":34,"timestamp":"2026-06-13T12:00:00Z"}'

# Batch positions
curl -X POST http://localhost:4000/api/ingest/batch \
  -H 'Content-Type: application/json' \
  -d '[{"deviceId":"test-001","latitude":47.718,"longitude":-116.945,"speed":34,"timestamp":"2026-06-13T12:00:00Z"}]'

# Check health
curl http://localhost:4000/api/health
```

## Android Phone GPS Setup

To send real GPS data from an Android phone:

1. Install a GPS broadcasting app like **GPS Logger** or **Traccar Client** from the Play Store
2. Configure it to send HTTP POST requests to `http://<your-server-ip>:4000/api/ingest`
3. Set the body format to JSON with fields: `deviceId`, `latitude`, `longitude`, `speed`, `timestamp`

Future: FleetOSS will have its own lightweight Android agent app and support the Traccar client protocol directly.
