# Frontend Overview

The FleetOSS frontend is a single-page application built with **React 19**, **Vite 8**, **Tailwind CSS v4**, and **Leaflet** for maps.

## Stack

| Technology | Purpose |
|-----------|---------|
| React 19 | UI framework with hooks-based state management |
| TypeScript 6 | Type safety across all components |
| Vite 8 | Dev server and production bundler |
| Tailwind CSS v4 | Utility-first CSS with custom dark theme |
| Leaflet + react-leaflet | Interactive map rendering |
| Google Fonts (Inter + JetBrains Mono) | Typography |
| OSRM (public API) | Road-snapped route fetching for trip playback |

## Directory Structure

```
app/src/
├── types/index.ts              # Frontend-specific TypeScript types
├── data/mockData.ts            # Mock data (devices, trips, maint, fuel)
├── lib/
│   ├── math.ts                 # Haversine, bearing, interpolation, speed color
│   └── osm.ts                  # OSRM route API client
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx         # Navigation sidebar with icons
│   │   └── Topbar.tsx          # Panel title + live status indicator
│   ├── map/
│   │   ├── MapPanel.tsx        # Leaflet map + device markers + trip overlay
│   │   ├── PlaybackBar.tsx     # Trip playback engine (controls, graph, scrubber)
│   │   ├── DeviceList.tsx      # Vehicle sidebar cards
│   │   └── MapInfoCard.tsx     # Speed / ODO / Engine overlay card
│   ├── trips/
│   │   └── TripsPanel.tsx      # Filterable trip log table + stats
│   ├── maint/
│   │   └── MaintPanel.tsx      # Maintenance items list + detail view
│   ├── fuel/
│   │   └── FuelPanel.tsx       # Fuel stats, MPG chart, fill-up log + form
│   └── ui/
│       ├── Icons.tsx           # SVG icon components
│       └── Toast.tsx           # Toast notification system
├── App.tsx                     # Root shell: layout + panel routing + toast
├── main.tsx                    # React entry point
└── index.css                   # Tailwind v4 imports + dark theme + Leaflet overrides
```

## Panel System

The app has four panels controlled by the sidebar:

| Panel | ID | Description |
|-------|----|-------------|
| Live Map | `map` | Leaflet map with device markers, trip playback, info card |
| Trip Log | `trips` | Filterable table of trips with summary statistics |
| Maintenance | `maint` | Service items with progress bars and detail/service history view |
| Fuel Log | `fuel` | MPG chart, fill-up table, and log form |

Panel switching is handled in `App.tsx` via conditional rendering (`{activePanel === 'map' && <MapPanel />}`).

## Cross-Panel Navigation

Clicking a trip row in the Trips panel navigates to the Map panel and shows the trip route:

1. `TripsPanel` calls `onShowTrip(tripIndex)` (passed from App)
2. `App.tsx` sets `activePanel` to `'map'` and waits 100ms for render
3. Then calls `mapRef.current.showTripOnMap(tripIndex)`
4. `MapPanel` (forwardRef) fetches the OSRM route, draws it on the map, opens playback bar

## Theming

The app uses a custom dark theme defined via Tailwind's `@theme` directive in `index.css`:

| Token | Value | Usage |
|-------|-------|-------|
| `--color-bg` | `#0F1117` | Page background |
| `--color-surface` | `#1C2130` | Panel/component backgrounds |
| `--color-surface-2` | `#242B3D` | Hover/darker surfaces |
| `--color-border` | `#2E3650` | Borders and dividers |
| `--color-cyan` | `#00D4FF` | Primary accent, active states |
| `--color-amber` | `#F59E0B` | Warning, stopped status |
| `--color-green` | `#10B981` | Success, moving status, MPG |
| `--color-red` | `#EF4444` | Danger, high speed |

Leaflet popup and control styles are overridden in `index.css` to match the dark theme.
