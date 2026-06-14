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
│   │   ├── App.tsx              # Shell + panel routing
│   │   ├── components/
│   │   │   ├── layout/          # Sidebar, Topbar
│   │   │   ├── map/             # Map, playback, device list
│   │   │   ├── trips/           # Trip table + editing
│   │   │   ├── maint/           # Maintenance panel
│   │   │   ├── fuel/            # Fuel tracking
│   │   │   ├── settings/        # Admin/server stats
│   │   │   └── ui/              # Icons, Toast
│   │   ├── lib/
│   │   │   ├── api.ts           # REST + WebSocket client
│   │   │   ├── math.ts          # Haversine, etc.
│   │   │   └── osm.ts           # OSRM routing
│   │   └── data/mockData.ts     # Fallback data
│   └── vite.config.ts           # Vite + Tailwind + API proxy
├── packages/
│   ├── core/                    # Shared TS types
│   │   └── src/index.ts
│   └── server/                  # Fastify backend
│       └── src/
│           ├── index.ts         # Entry (dual-port: 4000 + 5055)
│           ├── config/          # Environment config
│           ├── db/              # Schema, migrations, repos
│           ├── ingestion/       # Protocol parsers
│           │   └── protocols/   # http-json, traccar
│           ├── api/routes/      # REST endpoints
│           ├── realtime/        # WebSocket broadcasting
│           └── core/            # Trip detection, geocoding
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
