# Component Reference

## App.tsx (Root Shell)

The top-level component managing global state and layout.

**State:**
- `activePanel` — Which panel is currently shown (`'map' | 'trips' | 'maint' | 'fuel'`)
- `toastMsg` — Current toast notification text
- `mapRef` — Ref to MapPanel for calling `showTripOnMap()` from other panels

**Callbacks:**
- `showToast(msg)` — Shows a toast notification that auto-hides after 2.2s
- `handleShowTrip(idx)` — Switches to map panel and triggers trip route display

## Layout Components

### Sidebar.tsx
Dark sidebar with icon navigation buttons. Highlights active panel. Shows tooltips on hover. Settings button at bottom is placeholder.

### Topbar.tsx
Shows "FLEETOS" branding, current panel label, and a green "2 Active" live status pill. The pill label updates based on active panel.

## Map Components

### MapPanel.tsx
**Exported interface:** `MapPanelHandle` with `showTripOnMap(tripIdx: number): Promise<void>`

Uses `forwardRef` + `useImperativeHandle` to expose `showTripOnMap`.

**Internal state:**
- `mapRef` — Leaflet map instance
- `selectedDevice` — Currently selected device index
- `pb` — PlaybackState object (null when no trip shown)

**Key behavior:**
- Initializes Leaflet map with OSM tiles on mount
- Creates device markers with animated ping rings for moving devices
- `showTripOnMap()` fetches OSRM route, draws speed-colored route segments with tooltips, adds start/end markers, vehicle marker, fits bounds, and creates playback state
- Device selection flies map to device location and opens popup

### PlaybackBar.tsx
Trip playback engine with speed graph, scrubber, and controls.

**Local state:** `playing` (boolean) for play/pause icon toggling

**Refs:** `rafRef`, `lastTsRef`, `pbRef` — used for smooth animation frame loop without excessive React re-renders

**Playback controls:**
- Skip −15s, Play/Pause, Skip +15s, Stop
- Speed multiplier (1× – 60×)
- Scrubber bar with speed heatmap ticks
- Speed graph canvas with gradient fill
- Stat pills: Speed (color-coded), Distance covered, Distance remaining, Heading

**Scrubber interaction:** Mouse/touch drag on track bar. Updates `currentSec` on parent via `onSeek`.

### DeviceList.tsx
Right sidebar showing vehicle cards. Each card shows: name, status dot (green/amber/grey), plate, speed/status, ODO, today's mileage. Clicking selects device and flies map.

### MapInfoCard.tsx
Overlay card at bottom-left of map. Shows: Speed, Odometer, Today's mileage, Engine/route info. Displays device data normally, trip data when playing back.

## Trips Components

### TripsPanel.tsx
Filterable table of trips with vehicle, date range, and type dropdowns. Clicking a row triggers `onShowTrip(idx)`.

**Stats bar:** Total miles, Work miles, Trip count, Average per trip.

## Maintenance Components

### MaintPanel.tsx
Split view: list of service items on left, detail view on right.

**List:** Each item shows name, vehicle, status badge (Urgent/Soon/OK), progress bar, due description.
**Detail:** Shows health percentage, status, and a vertical timeline of service history entries.

## Fuel Components

### FuelPanel.tsx
Three sections:

1. **Stats bar:** Avg MPG, Total Fuel (gal), Avg $/gal, Total Spend
2. **MPG Chart:** Bar chart showing MPG trend for last 10 fill-ups
3. **Fill-up table:** Full log with date, vehicle, odometer, gallons, price, total cost, MPG, station
4. **Log form:** Right sidebar form for logging new fill-ups (vehicle, date, odometer, gallons, PPG, station)

## UI Components

### Icons.tsx
SVG icon components: MapIcon, TripsIcon, MaintIcon, FuelIcon, SettingsIcon, ShieldIcon.

Each is a functional component accepting optional `className` prop.

### Toast.tsx
Fixed-position toast notification. Slides up from bottom, auto-hides after 2.2 seconds.

**Props:** `message` (string | null) and `onDone` callback.
