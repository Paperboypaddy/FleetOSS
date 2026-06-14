# Architecture Overview

FleetOSS follows a **service-oriented monorepo** architecture with three main packages sharing TypeScript types.

## High-Level Diagram

```
┌──────────────────────────────────────────────────────────┐
│                   Frontend (app/)                         │
│  React 19 · Vite 8 · Tailwind CSS v4 · Leaflet           │
│                                                          │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │  Map    │ │  Trips   │ │  Maint   │ │  Fuel    │     │
│  │ Panel   │ │  Panel   │ │  Panel   │ │  Panel   │     │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘     │
│       │           │            │            │           │
│  ┌────┴───────────┴────────────┴────────────┴────┐      │
│  │               App Shell                        │      │
│  │  Sidebar · Topbar · Toast · Panel Routing      │      │
│  └───────────────────────┬───────────────────────┘      │
│                          │ HTTP + WebSocket              │
└──────────────────────────┼──────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────┐
│                    Backend (packages/server/)            │
│  Fastify 5 · Drizzle ORM · PostgreSQL + PostGIS        │
│                          │                               │
│  ┌───────────────────────┴───────────────────────┐      │
│  │              Fastify Server                     │      │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐     │      │
│  │  │  REST    │ │ WebSocket │ │  Ingestion │     │      │
│  │  │  API     │ │   /ws    │ │  POST /api │     │      │
│  │  └────┬─────┘ └────┬─────┘ │  /ingest    │     │      │
│  │       │            │       └────────────┘     │      │
│  │  ┌────┴────────────┴────────────────────┐     │      │
│  │  │          Core Domain                  │     │      │
│  │  │  Trip Detection · Geofencing · Auth   │     │      │
│  │  └─────────────────┬────────────────────┘     │      │
│  └────────────────────┼──────────────────────────┘      │
│                       │                                  │
│  ┌────────────────────┴──────────────────────────┐      │
│  │            Database Layer                       │      │
│  │  Repository Pattern · PostgreSQL + PostGIS      │      │
│  │  Tables: devices, positions, trips, geofences, │      │
│  │          events                                 │      │
│  └─────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────┘
```

## Design Principles

### 1. Pluggable Protocol Ingestion
Each GPS device protocol is a self-contained parser in `packages/server/src/ingestion/protocols/`. Each file exports a `parse(buffer): IngestedPosition` function. Adding a new protocol means dropping in a new file.

### 2. Repository Pattern
Database access is abstracted behind repository functions in `packages/server/src/db/repositories/`. This keeps business logic decoupled from the database implementation.

### 3. Pluggable Storage
File/backup storage uses an S3-compatible abstraction (MinIO SDK). In development, MinIO runs in Docker. In production, swap to AWS S3, GCS, or Azure Blob without code changes.

### 4. Pluggable Auth
Authentication uses a strategy pattern. Start with JWT bearer tokens. Add OAuth2/OIDC SSO by implementing the same strategy interface — no other code changes needed.

### 5. Multi-Tenancy
The database uses schema-per-tenant isolation from day one. Each tenant gets their own PostgreSQL schema (`tenant_xxx`), making horizontal sharding and data separation straightforward.

### 6. Async Processing
Trip detection, geofence evaluation, and alert generation run through an in-memory async queue so ingestion stays fast. Geocoding jobs are pushed to a Redis list and processed by a background worker with rate limiting and retries. Future: replace with RabbitMQ or Kafka for full distributed processing.

### 7. Redis Integration
Redis is optional (graceful fallback) and used for four purposes:
- **Persistent trip detection** — `DeviceTripState` stored in Redis hashes with 24h TTL, survives server restarts
- **Async geocode queue** — Jobs pushed to a Redis list, worker polls with `BLPOP`, respects Nominatim's 1 req/sec limit, retries up to 3 times
- **WebSocket fan-out** — Positions published to a Redis channel, all server instances receive and forward to local WebSocket clients (enables horizontal scaling)
- **Rate limiting** — Sliding window per-IP using Redis sorted sets (60 req/min on ingestion endpoints)
