# FleetOSS

Open Source Fleet & Asset Intelligence Platform — a self-hostable Traccar alternative.

## Agent Coordination

**Instructions:** All agents must update this section when starting or completing work. Keep priority items at the top. Log completed changes below.

### Current Priorities
<!-- List active priorities here, newest first -->
- [x] Color themes (Emerald, Violet, Rose, Amber) + Personal tab in Settings with theme picker
- [x] Dark/light theme toggle (sun/moon icon in Topbar), light mode CSS variables, persisted to localStorage
- [x] Device approval flow: new GPS devices created as unapproved, admin adds them via Settings → Devices
- [x] Custom site name and logo upload in General settings
- [x] JWT Authentication — login/register page, protected routes, 7-day tokens
- [x] Settings/Admin panel — sidebar nav, user management (create/list/delete), device config
- [x] Device-level trip detection toggle (`skipTripDetection` attribute honored by trip detector)
- [x] Collapsible asset sidebar for mobile
- [x] Trip playback with green moving marker + trail
- [x] Real GPS speed readings in playback (not synthetic curve)
- [x] Editable trip type (None/Work/Personal) and purpose
- [x] Auto-geocoded addresses saved to DB at trip detection time
- [x] Server-side reverse geocoding via Nominatim
- [x] Remove mock data — real API calls throughout
- [x] Fix trip detector: in-memory state tracking, 5-min stop threshold

### Agent Change Log
<!-- Agents log their changes here with date/description -->
- 2026-06-14 — Error handling middleware (AppError class + global error handler), removed redundant try/catch from all routes
- 2026-06-14 — Fix TypeScript strict mode: eliminated all `any` types across server codebase
- 2026-06-14 — Color themes (Emerald, Violet, Rose, Amber) + Personal tab in Settings with theme picker
- 2026-06-14 — Dark/light theme toggle (sun/moon icon in Topbar), light mode CSS variables, persisted to localStorage
- 2026-06-14 — Device approval flow: `approved` column/flag, unapproved devices hidden from map, Settings → Devices shows "Devices Awaiting Approval" with Add button
- 2026-06-14 — Geofences/Events/Maintenance/Fuel CRUD APIs + real frontend panels
- 2026-06-14 — TK103 + Teltonika Codec 8 protocol parsers on ports 5002, 5056
- 2026-06-14 — NMEA/GPRMC protocol parser + TCP server on port 5100
- 2026-06-14 — Custom site name and logo upload in General settings
- 2026-06-14 — Settings sidebar, user management (create/list/delete), device trip detection toggle, logout button
- 2026-06-14 — JWT auth with login/register page, protected routes, token management
- 2026-06-14 — Remove all mock data; Fuel/Maint panels show placeholders
- 2026-06-14 — Server-side geocoding at trip detection time (addresses saved to DB)
- 2026-06-14 — Fix trip detector: in-memory state, 5-min stop gap, backfill script
- 2026-06-14 — Raw GPS trace on map (skip OSRM), real speed readings in playback
- 2026-06-14 — Background Geolocation format parser, m/s → mph conversion
- 2026-06-14 — Initialized agent coordination section in AGENTS.md

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
- `src/lib/api.ts` — API client: fetch devices/trips/positions, WebSocket, rename/delete, reverse geocode
- `src/lib/auth.tsx` — AuthProvider, useAuth hook, token management
- `src/lib/math.ts` — Haversine, bearing, speed color, interpolate, etc.
- `src/lib/osm.ts` — OSRM route fetching for trip playback (deprecated — using raw GPS positions now)
- `src/App.tsx` — Shell: sidebar + topbar + panel routing + auth wrapping + toast state
- `src/components/auth/` — LoginPage.tsx (login/register form)
- `src/components/layout/` — Sidebar.tsx, Topbar.tsx
- `src/components/map/` — MapPanel.tsx (exposes `showTripOnMap` via ref), PlaybackBar.tsx, DeviceList.tsx, MapInfoCard.tsx
- `src/components/trips/` — TripsPanel.tsx (filterable table + editable type/purpose + geocoded addresses)
- `src/components/maint/` — MaintPanel.tsx (placeholder — coming soon)
- `src/components/fuel/` — FuelPanel.tsx (placeholder — coming soon)
- `src/components/settings/` — SettingsPanel.tsx (sidebar nav: General, Personal, Users, Devices)
- `src/components/ui/` — Icons.tsx (SVG components), Toast.tsx

**Key patterns:**
- Dark theme with CSS custom properties defined in `index.css` via `@theme`
- Google Fonts: Inter (sans) + JetBrains Mono (mono)
- Leaflet popups/controls styled dark in `index.css`
- Trip playback engine lives in PlaybackBar.tsx (ref-based animation loop + local `playing` state)
- Cross-panel navigation: TripsPanel calls `onShowTrip(trip)`, App fetches GPS positions and calls `mapRef.current.showTripOnMap(trip, wpts, speeds)`
- MapPanel uses `forwardRef` + `useImperativeHandle` to expose `showTripOnMap`
- Active panel persisted to `localStorage` across reloads
- Live position updates via WebSocket (broadcast from server on ingestion)

**Dev server:** `npm run dev` in `app/` → http://localhost:5173

## Backend (`packages/server/`)

**Stack:** Fastify 5, TypeScript, Drizzle ORM, PostgreSQL 16 + PostGIS 3.4, Zod

**Structure:**
- `src/index.ts` — Entry point: Fastify server with CORS, WebSocket, health check, dual-port (4000 + 5055)
- `src/config/index.ts` — Environment config (PORT, DATABASE_URL, JWT_SECRET, S3, Redis)
- `src/auth/index.ts` — JWT sign/verify, register/login, authMiddleware for protected routes
- `src/db/`
  - `connection.ts` — Drizzle + pg Pool singleton
  - `schema.ts` — Drizzle table definitions (devices, positions, trips, geofences, events, users)
  - `migrate.ts` — Raw SQL migration (creates PostGIS extension + all tables + indexes)
  - `seed.ts` — Demo data (1 device, 8 positions, 1 trip)
  - `backfill-trips.ts` — One-time script to detect trips from existing position data
  - `repositories/device.ts` — findOrCreateDevice, updateDeviceStatus, listDevices, getDeviceById, updateDeviceName, deleteDeviceById
  - `repositories/position.ts` — insertPosition, getLatestPosition, getPositions (with date range)
- `src/ingestion/`
  - `server.ts` — `POST /api/ingest`, `POST /api/ingest/batch`, `GET/POST /api/ingest/traccar`
  - `protocols/http-json.ts` — Zod-validated parser for HTTP JSON GPS data
  - `protocols/traccar.ts` — Parser for Traccar/OsmAnd HTTP query-param + Background Geolocation (nested JSON)
  - Future: `nmea/`, `tk103/`, `obd/` protocol parsers
- `src/api/routes/devices.ts` — `GET /api/devices`, `GET /api/devices/:id`, `PATCH /api/devices/:id` (rename + attributes), `DELETE /api/devices/:id`
- `src/api/routes/positions.ts` — `GET /api/devices/:deviceId/positions?from=&to=&limit=`
- `src/api/routes/trips.ts` — `GET /api/trips`, `GET /api/trips/:id`, `PATCH /api/trips/:id` (type/purpose), `GET /api/devices/:deviceId/trips`
- `src/api/routes/users.ts` — `GET /api/users`, `POST /api/users`, `DELETE /api/users/:id` (admin-only)
- `src/api/routes/stats.ts` — `GET /api/stats` (device/position/trip counts, protocol breakdown)
- `src/realtime/index.ts` — WebSocket at `/ws`, broadcasts positions to connected clients
- `src/core/trip-detector.ts` — Speed-based trip start/end detection (in-memory state per device, 5-min stop threshold, respects skipTripDetection)
- `src/core/geocode.ts` — Server-side Nominatim reverse geocoding

**Dev server:** `npm run dev -w packages/server` or `npm run dev` from root → http://localhost:4000
**Traccar-compatible port:** Also listens on :5055 for Traccar Client apps

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

- [x] Frontend: Full SPA with Map (Leaflet + raw GPS traces + playback), Trips, Maintenance, Fuel panels
- [x] Frontend: Cross-panel trip navigation (click trip → fetch GPS breadcrumbs → show on map)
- [x] Frontend: WebSocket live position updates on map
- [x] Frontend: API client with auth headers, fallback to empty arrays on error
- [x] Frontend: Car icon in sidebar, uploaded logo in topbar
- [x] Frontend: Maintenance panel with real API data
- [x] Frontend: Fuel panel with real API data (log fill-ups)
- [x] Frontend: Collapsible asset sidebar for mobile
- [x] Frontend: Rename/delete devices inline
- [x] Frontend: Battery level display, last seen timestamps
- [x] Frontend: Editable trip type (None/Work/Personal) and purpose
- [x] Frontend: Auto-geocoded trip addresses from Nominatim
- [x] Frontend: Settings/Admin panel with sidebar (General, Users, Devices tabs)
- [x] Frontend: User management (create with role, list, delete)
- [x] Frontend: Device settings with trip detection toggle
- [x] Frontend: Logout button in settings sidebar
- [x] Frontend: Custom site name and logo upload in General settings
- [x] Frontend: JWT login/register page, token persisted to localStorage
- [x] Frontend: Active panel persisted to localStorage across reloads
- [x] Core: Shared TypeScript types (Device, Position, Trip, Geofence, Event, etc.)
- [x] Server: Fastify scaffold with CORS, WebSocket, health check
- [x] Server: JWT auth — register (first-run), login, /api/auth/me
- [x] Server: User management API (list, create, delete users)
- [x] Server: Database schema + migrations (devices, positions, trips, geofences, events, users)
- [x] Server: HTTP/JSON ingestion endpoint (single + batch)
- [x] Server: Traccar/OsmAnd protocol endpoint (GET/POST with query params)
- [x] Server: Background Geolocation format support (transistorsoft nested JSON)
- [x] Server: Device API routes (list, get, rename, delete, update attributes)
- [x] Server: Device-level trip detection toggle (skipTripDetection)
- [x] Server: Trip detector respects per-device skipTripDetection flag
- [x] Server: Positions API (by device with date range)
- [x] Server: Trips API (list, get, update type/purpose, by device)
- [x] Server: Stats API (device/position/trip counts, protocol breakdown)
- [x] Server: WebSocket real-time position broadcasting
- [x] Server: Trip detection (in-memory, 2 mph threshold, 5-min stop gap)
- [x] Server: Server-side reverse geocoding via Nominatim for trip addresses
- [x] Server: Geocoded addresses saved to trips table at detection time
- [x] Server: Port 5055 listener for Traccar Client compatibility
- [x] Server: NMEA/GPRMC protocol parser + TCP server on port 5100
- [x] Server: GT06/Concox protocol parser + TCP server on port 5001
- [x] Server: TK103 protocol parser + TCP server on port 5002
- [x] Server: Teltonika Codec 8/8E protocol parser + TCP server on port 5056
- [x] Server: Queclink protocol parser + TCP server on port 5004
- [x] Infrastructure: Docker Compose (PostGIS, MinIO, Redis)
- [x] Infrastructure: .gitignore (node_modules, dist, .env, *.log)

## Next Steps (Priority Order)

### 1. More protocol parsers
- [x] NMEA/GPRMC parser + TCP server on port 5100
- [x] GT06/Concox protocol parser + TCP server on port 5001
- [x] TK103 protocol parser (Chinese GPS trackers) on port 5002
- [x] Teltonika Codec 8/8E protocol parser on port 5056
- [x] Queclink protocol parser on port 5004
- [ ] OBD-II ELM327 parser (vehicle telemetry)
- [ ] Document protocol plugin interface

### 2. API completeness
- [x] Geofences CRUD API
- [x] Events API
- [x] Maintenance API
- [x] Fuel entries API

### 3. Frontend polish
- [x] Fuel/Maint panels wired to real data
- [x] Dark/light theme toggle
- [x] Color themes (Emerald, Violet, Rose, Amber) + Personal tab in Settings

### 4. Server polish
- [x] Fix TypeScript strict mode issues (implicit any, etc.)
- [x] Add error handling middleware
- [ ] Add request logging / request IDs
- [ ] Add pagination to list endpoints

### 5. Trip detection improvement
- [ ] Add ignition-based trip detection
- [ ] Add geofence-based trip start/end
- [x] Save geocoded addresses back to trips table

### 6. Infrastructure
- [ ] Dockerize the server
- [ ] Dockerize the frontend
- [ ] Add CI/CD pipeline
- [ ] Add Helm chart for Kubernetes deployment

### 7. Multi-Tenant (branch: `multi-tenant`)

**Architecture:** Schema-per-tenant — each customer gets an isolated PostgreSQL schema.

**New tables (public schema):**
- `tenants` — id, name, slug, schema_name, created_at
- `tenant_users` — id, tenant_id, email, name, password_hash, role, created_at

**Schema routing:**
- Detect tenant from subdomain (`abc.fleetoss.phnet.xyz` → `tenant_abc`) or request header
- Fastify `onRequest` hook: parse tenant → `SET search_path TO tenant_abc;`
- All Drizzle queries automatically resolve to the correct schema

**Connection layer:**
- `getDb()` uses the pool with `search_path` set per-request
- `packages/server/src/db/create-tenant.ts` — creates schema + runs DDL + seeds admin user

**Auth changes:**
- Login accepts tenant slug → scopes session to that tenant
- JWT includes `tenant` claim
- Registration creates tenant → schema → admin user

**Isolation:** No shared data between tenants. Schema-level backups. Independent migration versions.

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
npm run dev          # starts server on :4000 (+ :5055 for Traccar)

# Frontend (separate terminal)
cd app && npm run dev  # starts on :5173

# Ingest a test position via Traccar protocol:
curl "http://localhost:5055/?id=test-001&lat=47.718&lon=-116.945&speed=34"
```
