# FleetOSS

Open Source Fleet & Asset Intelligence Platform — a self-hostable Traccar alternative.

## Agent API Key

**API Key for OpenCode agents:** `foss_AZ2btKamIRO_2-q_PjBptXRRw6NOU4zc`

Use this key to authenticate API calls to FleetOSS:

```bash
# List devices (paginated)
curl -H "Authorization: Bearer foss_AZ2btKamIRO_2-q_PjBptXRRw6NOU4zc" \
  "http://fleetoss.phnet.xyz:5173/api/devices?page=1&limit=10"

# List trips
curl -H "Authorization: Bearer foss_AZ2btKamIRO_2-q_PjBptXRRw6NOU4zc" \
  "http://fleetoss.phnet.xyz:5173/api/trips?page=1&limit=10"

# Get device positions
curl -H "Authorization: Bearer foss_AZ2btKamIRO_2-q_PjBptXRRw6NOU4zc" \
  "http://fleetoss.phnet.xyz:5173/api/devices/{deviceId}/positions?limit=10"
```

All API endpoints return paginated responses:
```json
{
  "data": [...],
  "total": 42,
  "page": 1,
  "limit": 20,
  "hasMore": true
}
```

Error responses include `requestId` for debugging:
```json
{ "error": "...", "requestId": "abc12345" }
```

## Agent Coordination

**Instructions:** All agents must update this section when starting or completing work. Keep priority items at the top. Log completed changes below.

### Current Priorities
<!-- List active priorities here, newest first -->
- [x] Redis integration: persistent trip detection, async geocode queue, WebSocket fan-out, rate limiting
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
- 2026-06-14 — GitHub OAuth2 provider testing + API key auth + generic DB provider routes
- 2026-06-14 — Pagination on all list endpoints + request IDs on all responses + API auth lockdown
- 2026-06-14 — SSO settings panel (frontend CRUD UI for LDAP/OIDC/OAuth2/SAML provider config)
- 2026-06-14 — Pluggable auth system: LDAP, OIDC, OAuth2, SAML strategies + Keycloak + SSO login page
- 2026-06-14 — Dockerized server + frontend, production docker-compose, CI/CD + release workflows
- 2026-06-14 — Playback keyboard controls (Space, arrow keys, 1-6 for speed, Esc), shortcut hint bar, follow-mode button
- 2026-06-14 — Redis integration: persistent trip detection, async geocode queue, WebSocket fan-out, rate limiting
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
- 2026-06-14 — SSO settings panel (frontend CRUD UI for LDAP/OIDC/OAuth2/SAML provider config)
- 2026-06-14 — Pluggable auth system: LDAP, OIDC, OAuth2, SAML strategies + Keycloak + SSO login page
- 2026-06-14 — Initialized agent coordination section in AGENTS.md
- 2026-06-24 — Selfhosted all-in-one Docker image (Dockerfile.selfhosted): Caddy reverse proxy with auto SSL (Let's Encrypt via DOMAIN/EMAIL env vars), serves frontend + proxies API/WebSocket to Node server
- 2026-06-24 — Vitest unit tests: 37 tests across server (Traccar/NMEA/HTTP-JSON parsers, auth utils, pagination, config) + frontend (math utils). CI pipeline runs lint → test → build → smoke test selfhosted image
- 2026-06-24 — docker-compose.test.yml (integration test env), docker-compose.staging.yml (staging deployment), scripts/test-selfhosted-image.sh

## Architecture

Monorepo with npm workspaces:

```
fleetoss/
├── app/                    # Frontend (React + Vite + Tailwind CSS v4)
├── packages/
│   ├── core/               # Shared TypeScript types (frontend + backend)
│   └── server/             # Backend (Fastify + Drizzle + PostgreSQL/PostGIS)
├── selfhosted/             # All-in-one Docker image with Caddy + Node
│   ├── entrypoint.sh       # Starts Caddy (reverse proxy) + Node server
│   └── Caddyfile           # Caddy config template (auto SSL via Let's Encrypt)
├── Dockerfile.selfhosted   # Multi-stage build: frontend + server + Caddy
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
- `src/components/settings/` — SettingsPanel.tsx (sidebar nav: General, Personal, Users, Devices, SSO), SsoSettings.tsx (SSO provider CRUD)
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
- `src/auth/index.ts` — Strategy registry, JWT sign/verify, authMiddleware, route registration
- `src/auth/strategies/` — LDAP, OIDC, OAuth2, SAML strategy implementations
- `src/auth/db-router.ts` — Dynamic route registration for DB-backed auth providers
- `src/api/routes/auth-providers.ts` — CRUD API for SSO provider config
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
- `src/core/trip-detector.ts` — Speed-based trip start/end detection (Redis-backed state with in-memory fallback, 5-min stop threshold, respects skipTripDetection)
- `src/core/geocode.ts` — Server-side Nominatim reverse geocoding
- `src/core/geocoder.ts` — Async geocode job queue (Redis list)
- `src/core/geocoder-worker.ts` — Background worker polling Redis queue, rate-limited Nominatim calls with retries
- `src/core/rate-limiter.ts` — Sliding window rate limiter (Redis sorted sets)
- `src/db/redis.ts` — Redis connection singleton (lazy connect, graceful fallback)

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
4. **Pluggable auth** — Strategy pattern: local (default) + env-var LDAP/OIDC/OAuth2/SAML + DB-backed providers configurable via Settings → SSO panel
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
- [x] Frontend: SSO settings panel (CRUD UI for LDAP/OIDC/OAuth2/SAML provider config)
- [x] Frontend: Settings/Admin panel with sidebar (General, Users, Devices tabs)
- [x] Frontend: User management (create with role, list, delete)
- [x] Frontend: Device settings with trip detection toggle
- [x] Frontend: Logout button in settings sidebar
- [x] Frontend: Custom site name and logo upload in General settings
- [x] Frontend: JWT login/register page, token persisted to localStorage
- [x] Frontend: Active panel persisted to localStorage across reloads
- [x] Core: Shared TypeScript types (Device, Position, Trip, Geofence, Event, etc.)
- [x] Server: Fastify scaffold with CORS, WebSocket, health check
- [x] Server: Pluggable auth — LDAP, OIDC, OAuth2, SAML strategies + dynamic DB-backed providers
- [x] Server: Auth provider CRUD API (GET/POST/PATCH/DELETE /api/settings/auth-providers)
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
- [x] Infrastructure: Docker Compose (PostGIS, MinIO, Redis, Keycloak)
- [x] Infrastructure: .gitignore (node_modules, dist, .env, *.log)
- [x] Selfhosted all-in-one Docker image: Caddy reverse proxy with auto SSL (Let's Encrypt via DOMAIN/EMAIL env vars)
- [x] Vitest unit tests: 37 tests across server + frontend
- [x] docker-compose.test.yml, docker-compose.staging.yml, image smoke test script
- [x] CI pipeline: lint → test → build → smoke test selfhosted image

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
- [x] Pluggable auth system (LDAP, OIDC, OAuth2, SAML) + SSO settings panel
- [x] Add request logging / request IDs (X-Request-Id header + requestId in error responses)
- [x] Add pagination to list endpoints (page/limit query params, PaginatedResponse format)

### 5. Trip detection improvement
- [ ] Add ignition-based trip detection
- [ ] Add geofence-based trip start/end
- [x] Save geocoded addresses back to trips table

### 6. Infrastructure
- [x] Dockerize the server (multi-stage `Dockerfile`)
- [x] Dockerize the frontend (nginx-based `app/Dockerfile`)
- [x] Production docker-compose (`docker-compose.prod.yml`)
- [x] CI/CD pipeline (GitHub Actions: lint, test, build, push to GHCR)
- [x] Release workflow (tag → build images + GitHub Release)
- [ ] Add Helm chart for Kubernetes deployment

### 7. Redis Integration

- [x] Redis connection singleton (lazy connect, graceful fallback to in-memory)
- [x] Persistent trip detection (Redis hashes + TTL, fallback to in-memory Map)
- [x] Async geocode queue (Redis list + BLPOP worker, Nominatim rate limit, retries)
- [x] WebSocket fan-out (Redis Pub/Sub for multi-instance position broadcasting)
- [x] Rate limiting (sliding window per-IP on ingestion endpoints, 60 req/min)

### 8. Protocol Auto-Detect & Unified Ingestion

**Goal:** A single TCP listener that auto-detects which protocol a device speaks and routes to the correct parser, rather than requiring per-protocol ports.

**Approach:**
- Replace per-port TCP handlers (GT06 on 5001, TK103 on 5002, etc.) with a single `ProtocolDetector` that examines the first bytes of data:
  - Binary protocols: GT06 (0x78/0x79), Teltonika (0x00000000 prefix), Queclink (`+RESP:`)
  - Text protocols: TK103 (`##,imei:` or `*HQ,`), NMEA (`$GP`), TK102
- Maintain a log of ALL connections — including unparseable data — for debugging device compatibility
- Each parsed position should log protocol, device ID, and raw data snippet regardless of parse success

**Files:**
- `packages/server/src/ingestion/protocol-detector.ts` — reads initial bytes, returns protocol name
- `packages/server/src/ingestion/handlers/unified-handler.ts` — single entry point for TCP devices
- Refactor existing per-port handlers to be called by the detector

**Port plan:** Keep port 5001 as unified GPS ingest port. Route 5002/5004/5056/5100 to the same detector for backward compatibility.

### 9. Multi-Tenant (branch: `multi-tenant`)

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

## Important Warnings

- **DO NOT modify `app/vite.config.ts`** unless explicitly instructed by the user. It contains `allowedHosts` and proxy settings that are critical for the deployment. Changing it will break frontend access.

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

# Selfhosted (all-in-one with auto SSL via Caddy):
docker compose -f docker-compose.prod.yml up fleetoss-selfhosted -d
# Or standalone:
docker run -d --name fleetoss -p 80:80 -p 443:443 -p 4000:4000 \
  -e DOMAIN=fleetoss.example.com -e EMAIL=admin@example.com \
  -e DATABASE_URL=postgres://... -e JWT_SECRET=... \
  ghcr.io/fosrl/fleetoss:latest

# Integration test environment
docker compose -f docker-compose.test.yml up -d
npm run db:migrate
npm run test -w packages/server

# Staging (builds from source, staging ports)
docker compose -f docker-compose.staging.yml up -d

# Smoke test selfhosted image
bash scripts/test-selfhosted-image.sh

# Ingest a test position via Traccar protocol:
curl "http://localhost:5055/?id=test-001&lat=47.718&lon=-116.945&speed=34"
```
