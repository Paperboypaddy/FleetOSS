# FleetOSS Documentation

> Open Source Fleet & Asset Intelligence Platform — a self-hostable Traccar alternative.

## Quick Links

- [Architecture Overview](architecture.md)
- [Getting Started / Deployment](deployment.md)

### Frontend
- [Frontend Overview](frontend/overview.md)

### Backend
- [Backend Overview](backend/overview.md)
- [GPS Ingestion System](backend/ingestion.md)
- [API Reference](backend/api.md)
- [WebSocket & Real-Time](backend/realtime.md)

---

## Project at a Glance

```
fleetoss/
├── app/                    # React SPA dashboard
│   ├── src/
│   │   ├── App.tsx              # Shell + panel routing + auth
│   │   ├── components/
│   │   │   ├── auth/            # Login/Register page
│   │   │   ├── layout/          # Sidebar, Topbar
│   │   │   ├── map/             # Map, playback, device list
│   │   │   ├── trips/           # Trip table + editing
│   │   │   ├── maint/           # Maintenance (placeholder)
│   │   │   ├── fuel/            # Fuel (placeholder)
│   │   │   ├── settings/        # Admin panel (General, Users, Devices)
│   │   │   └── ui/              # Icons, Toast
│   │   ├── lib/
│   │   │   ├── api.ts           # REST + WebSocket client
│   │   │   ├── auth.tsx         # AuthProvider + useAuth hook
│   │   │   ├── math.ts          # Haversine, etc.
│   │   │   └── osm.ts           # OSRM routing (deprecated)
│   │   └── auth.tsx             # Auth context
│   └── vite.config.ts           # Vite + Tailwind + API proxy
├── packages/
│   ├── core/                    # Shared TS types
│   │   └── src/index.ts
│   └── server/                  # Fastify backend
│       └── src/
│           ├── index.ts         # Entry (dual-port: 4000 + 5055)
│           ├── config/          # Environment config
│           ├── auth/            # JWT, LDAP, OIDC, OAuth2, SAML strategies
│           ├── db/
│           │   ├── connection.ts    # Drizzle + pg Pool singleton
│           │   ├── redis.ts         # Redis singleton (lazy, graceful fallback)
│           │   ├── schema.ts        # Drizzle ORM table definitions
│           │   ├── migrate.ts       # Raw SQL migrations
│           │   └── repositories/    # Device, position, etc.
│           ├── ingestion/       # Protocol parsers (HTTP, Traccar, TCP)
│           │   ├── server.ts    # POST /api/ingest (with rate limiting)
│           │   ├── protocols/   # http-json, traccar, nmea, tk103, etc.
│           │   └── handlers/    # NMEA, GT06, TK103, Teltonika, Queclink
│           ├── api/
│           │   ├── errors.ts    # AppError class + global error handler
│           │   └── routes/      # devices, trips, positions, users, etc.
│           ├── realtime/        # WebSocket + Redis Pub/Sub fan-out
│           └── core/
│               ├── trip-detector.ts  # Redis-backed trip detection
│               ├── geocode.ts        # Nominatim caller (direct)
│               ├── geocoder.ts       # Async geocode job queue
│               ├── geocoder-worker.ts # BLPOP worker, rate-limited
│               └── rate-limiter.ts   # Sliding window per-IP
├── docker-compose.yml           # PostGIS, MinIO, Redis
└── fleet-tracker.html           # Original prototype (reference only)
```

## Quick Start

```bash
# Start infrastructure
docker compose up -d

# Install dependencies & setup DB
npm install
cp packages/server/.env.example packages/server/.env
npm run db:migrate

# Start backend (port 4000 + 5055)
npm run dev

# Start frontend (separate terminal, port 5173)
cd app && npm run dev
```

## Ports

| Service | Port |
|---------|------|
| Backend API | 4000 |
| Traccar Client | 5055 |
| Frontend (Vite) | 5173 |
