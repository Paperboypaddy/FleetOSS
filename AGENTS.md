# FleetOSS

Open Source Fleet & Asset Intelligence Platform — a self-hostable Traccar alternative.

## Architecture

Monorepo with npm workspaces:

```
fleetoss/
├── app/                    # Frontend (React + Vite + Tailwind CSS v4)
├── packages/
│   ├── core/               # Shared TypeScript types (frontend + backend)
│   └── server/             # Backend (Fastify + Drizzle + PostgreSQL/PostGIS)
├── docker-compose.yml      # PostGIS + MinIO + Redis
├── fleet-tracker.html      # Original prototype (keep as reference, not for editing)
└── AGENTS.md               # This file
```

## Frontend (`app/`)

**Stack:** React 19, TypeScript 6, Vite 8, Tailwind CSS v4, Leaflet

**Structure:**
- `src/types/index.ts` — Frontend-specific types (Device, Trip, MaintItem, FuelEntry, PlaybackState)
- `src/data/mockData.ts` — Mock data matching the original fleet-tracker.html
- `src/lib/math.ts` — Haversine, bearing, speed color, interpolate, etc.
- `src/lib/osm.ts` — OSRM route fetching for trip playback
- `src/App.tsx` — Shell: sidebar + topbar + panel routing + toast state
- `src/components/layout/` — Sidebar.tsx, Topbar.tsx
- `src/components/map/` — MapPanel.tsx (exposes `showTripOnMap` via ref), PlaybackBar.tsx, DeviceList.tsx, MapInfoCard.tsx
- `src/components/trips/` — TripsPanel.tsx (filterable table + stats)
- `src/components/maint/` — MaintPanel.tsx (service items + detail view)
- `src/components/fuel/` — FuelPanel.tsx (stats, MPG chart, table, log form)
- `src/components/ui/` — Icons.tsx (SVG components), Toast.tsx

**Key patterns:**
- Dark theme with CSS custom properties defined in `index.css` via `@theme`
- Google Fonts: Inter (sans) + JetBrains Mono (mono)
- Leaflet popups/controls styled dark in `index.css`
- Trip playback engine lives in PlaybackBar.tsx (ref-based animation loop + local `playing` state)
- Cross-panel navigation: TripsPanel calls `onShowTrip(idx)`, App switches to map panel and calls `mapRef.current.showTripOnMap(idx)`
- MapPanel uses `forwardRef` + `useImperativeHandle` to expose `showTripOnMap`

**Dev server:** `npm run dev` in `app/` → http://localhost:5173

## Backend (`packages/server/`)

**Stack:** Fastify 5, TypeScript, Drizzle ORM, PostgreSQL 16 + PostGIS 3.4, Zod

**Structure:**
- `src/index.ts` — Entry point: Fastify server with CORS, WebSocket, health check
- `src/config/index.ts` — Environment config (PORT, DATABASE_URL, JWT_SECRET, S3, Redis)
- `src/db/`
  - `connection.ts` — Drizzle + pg Pool singleton
  - `schema.ts` — Drizzle table definitions (devices, positions, trips, geofences, events)
  - `migrate.ts` — Raw SQL migration (creates PostGIS extension + all tables + indexes)
  - `seed.ts` — Demo data (1 device, 8 positions, 1 trip)
  - `repositories/device.ts` — findOrCreateDevice, updateDeviceStatus, listDevices, getDeviceById
  - `repositories/position.ts` — insertPosition, getLatestPosition, getPositions
- `src/ingestion/`
  - `server.ts` — `POST /api/ingest` and `POST /api/ingest/batch` endpoints
  - `protocols/http-json.ts` — Zod-validated parser for HTTP JSON GPS data
  - Future: `nmea/`, `tk103/`, `obd/` protocol parsers
- `src/api/routes/devices.ts` — `GET /api/devices`, `GET /api/devices/:id`
- `src/realtime/index.ts` — WebSocket at `/ws`, broadcasts positions to connected clients
- `src/core/trip-detector.ts` — Speed-based trip start/end detection (in-memory state per device)

**Dev server:** `npm run dev -w packages/server` or `npm run dev` from root → http://localhost:4000

**Database:** `docker-compose up` → PostGIS on :5432, then `npm run db:migrate`

## Shared Types (`packages/core/`)

**Location:** `packages/core/src/index.ts`

Contains interfaces used by both frontend and backend:
- Device, Position, Trip, Geofence, Event, Maintenance, User
- IngestedPosition (input for GPS ingestion)
- PaginatedResponse, ApiError
- WsEvent (WebSocket message types)

Frontend has its own types in `app/src/types/index.ts` (older/separate — consider migrating to core).

## Design Decisions

1. **Monorepo with npm workspaces** — shared types between frontend and backend, single `npm install`
2. **Pluggable protocol ingestion** — each GPS protocol is a file exporting `parse(buffer): IngestedPosition`
3. **Pluggable storage** — Repository pattern, S3 abstraction via MinIO SDK
4. **Pluggable auth** — Strategy pattern, start with JWT, add OAuth2/OIDC later
5. **Database** — PostgreSQL + PostGIS with raw SQL migrations (not Drizzle Kit) for control; Drizzle ORM for queries
6. **Multi-tenancy ready** — Schema-per-tenant from the start
7. **Async processing** — Trip detection, geofencing, alerts go through in-memory queue (future: RabbitMQ/Kafka)
8. **Original prototype** — `fleet-tracker.html` is the proof-of-concept, kept unmodified for reference

## What's Been Done

- [x] Frontend: Full SPA with Map (Leaflet + OSRM routing + playback), Trips, Maintenance, Fuel panels
- [x] Frontend: Cross-panel trip navigation (click trip → show on map)
- [x] Core: Shared TypeScript types (Device, Position, Trip, Geofence, Event, etc.)
- [x] Server: Fastify scaffold with CORS, WebSocket, health check
- [x] Server: Database schema (devices, positions, trips, geofences, events) with PostGIS indexes
- [x] Server: Database migration script + seed data
- [x] Server: HTTP/JSON ingestion endpoint (single + batch)
- [x] Server: Device API routes (list, get by ID)
- [x] Server: WebSocket real-time position broadcasting
- [x] Server: Basic trip detection (speed-based start/stop)
- [x] Infrastructure: Docker Compose (PostGIS, MinIO, Redis)

## Next Steps (Priority Order)

### 1. Server polish
- [ ] Fix TypeScript strict mode issues (implicit any, etc.)
- [ ] Add error handling middleware
- [ ] Add request logging / request IDs
- [ ] Implement auth middleware (JWT initially)
- [ ] Add pagination to list endpoints
- [ ] Create `.env` file from `.env.example`

### 2. More protocol parsers
- [ ] NMEA/GPRMC parser (standard GPS sentence format)
- [ ] TK103 protocol parser (Chinese GPS trackers)
- [ ] OBD-II ELM327 parser (vehicle telemetry)
- [ ] Document protocol plugin interface

### 3. Trip detection improvement
- [ ] Fix: trip-detector.ts `wasMoving` logic needs previous position's moving state, not current
- [ ] Add ignition-based trip detection
- [ ] Add geofence-based trip start/end
- [ ] Add reverse geocoding for start/end addresses

### 4. API completeness
- [ ] Trips API: list, get by ID, get by device
- [ ] Positions API: get by device with date range
- [ ] Geofences CRUD API
- [ ] Events API

### 5. Frontend → Backend integration
- [ ] Replace mock data with API calls
- [ ] Add WebSocket connection for live positions
- [ ] Add real-time device status updates on map
- [ ] Add auth UI (login page)

### 6. Infrastructure
- [ ] Dockerize the server
- [ ] Dockerize the frontend
- [ ] Add CI/CD pipeline
- [ ] Add Helm chart for Kubernetes deployment

## Coding Conventions

- **TypeScript** — strict mode, ES2022 target, ESM (`"type": "module"`)
- **No semicolons** in frontend code; semicolons in backend code
- **Imports** — use `.js` extension in backend (ESM requirement), no extension in frontend (Vite handles it)
- **CSS** — Tailwind utility classes preferred; custom CSS in `index.css` for Leaflet overrides and animations
- **Components** — named exports for functions, default export for the component
- **Files** — PascalCase for components, camelCase for utilities
- **State** — React hooks (useState, useCallback, useRef); avoid external state management for now
- **Database** — snake_case column names; camelCase in TypeScript via Drizzle field mapping

## Running Everything

```bash
# Database
docker compose up -d

# Backend
cp packages/server/.env.example packages/server/.env
npm run db:migrate
npm run dev          # starts server on :4000

# Frontend (separate terminal)
cd app && npm run dev  # starts on :5173

# Ingest a test position:
curl -X POST http://localhost:4000/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"test-001","latitude":47.718,"longitude":-116.945,"speed":34,"timestamp":"2026-06-13T12:00:00Z"}'
```
