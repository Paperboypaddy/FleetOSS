# Data Flow & State Management

## State Philosophy

FleetOSS uses **React hooks for all state management** — no external libraries like Redux, Zustand, or MobX. This is intentional: the app has moderate complexity and React's built-in hooks are sufficient.

## State Categories

### 1. App-Level State (`App.tsx`)
```
activePanel — which panel is displayed
toastMsg — notification text (null = hidden)
mapRef — ref to MapPanel for cross-panel calls
```
Managed via `useState` + `useRef` + `useCallback`.

### 2. Panel-Level State
Each panel manages its own state internally:
- **MapPanel:** `selectedDevice`, `pb` (PlaybackState)
- **TripsPanel:** `selectedIdx`, `vehicleFilter`
- **MaintPanel:** `activeIdx`
- **FuelPanel:** no local state (all from mock data)

### 3. Playback Engine State (`PlaybackBar.tsx`)
```
playing (local useState) — play/pause toggle
rafRef, lastTsRef, pbRef (useRef) — animation frame loop
```
The animation loop runs at 60fps via `requestAnimationFrame`. To avoid re-rendering 60 times per second, the loop uses refs for mutable playback state and only triggers React re-renders when play/pause state changes.

## Data Flow

### Panel Navigation
```
User clicks sidebar button
→ Sidebar.onPanelChange(id)
→ App.setActivePanel(id)
→ Conditional render shows correct panel
```

### Trip Click → Map Display
```
User clicks trip row in TripsPanel
→ TripsPanel.onShowTrip(tripIdx)
→ App.setActivePanel('map')
→ App waits 100ms for map to mount
→ mapRef.current.showTripOnMap(idx)
→ MapPanel fetches OSRM route
→ Draws route layers, markers, sets playback state
```

### Device Selection
```
User clicks device card or marker
→ selectDevice(i)
→ map.flyTo(device.latlng)
→ marker.openPopup()
→ Info card updates to device data
→ Clears any active trip layers
```

## Current Data Sources

### Frontend Mock Data (`app/src/data/mockData.ts`)
All panels currently use hardcoded mock data:
- `devices` — 2 vehicles: T1N Sprinter, Backup Unit
- `tripsData` — 8 trips with waypoints in Idaho/Washington
- `maintData` — 6 service items with history
- `fuelData` — 10 fill-up records

### Live Data
The mock data will be replaced with API calls once the backend is connected. See "Next Steps" in AGENTS.md.

## Future State: Backend Integration

Planned data flow with real backend:

```
Device sends GPS position
→ POST /api/ingest
→ Server stores in PostgreSQL
→ Broadcasts via WebSocket
→ Frontend receives WsEvent
→ Updates map marker position
→ Updates device list status
→ Trip detection runs server-side
→ Completed trip appears in Trips panel
```
