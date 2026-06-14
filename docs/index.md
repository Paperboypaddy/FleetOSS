# FleetOSS Documentation

> Open Source Fleet & Asset Intelligence Platform

Welcome to the FleetOSS documentation. This is a self-hostable alternative to Traccar for tracking vehicles, equipment, and other GPS-enabled assets.

## Quick Links

- [Architecture Overview](architecture.md)
- [Getting Started / Deployment](deployment.md)

### Frontend
- [Frontend Overview](frontend/overview.md)
- [Component Reference](frontend/components.md)
- [Data Flow & State](frontend/data-flow.md)

### Backend
- [Backend Overview](backend/overview.md)
- [Database Schema](backend/database.md)
- [GPS Ingestion System](backend/ingestion.md)
- [API Reference](backend/api.md)
- [WebSocket & Real-Time](backend/realtime.md)

---

## Project at a Glance

```
fleetoss/
├── app/                    # React SPA dashboard
├── packages/
│   ├── core/               # Shared TypeScript types
│   └── server/             # Fastify API server
├── docs/                   # This documentation
├── docker-compose.yml      # Dev infrastructure
├── AGENTS.md               # AI agent project guide
└── fleet-tracker.html      # Original prototype (reference only)
```

**Stack:** React 19 + Vite 8 + Tailwind CSS v4 (frontend) · Fastify 5 + Drizzle ORM + PostgreSQL/PostGIS (backend) · TypeScript throughout

**Original prototype:** `fleet-tracker.html` is a single-file HTML/JS proof-of-concept kept unmodified. The `app/` directory is the rebuilt version.
