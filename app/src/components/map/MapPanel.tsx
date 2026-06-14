import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { buildCumDist, speedColor, addMins, interpAtSec } from '../../lib/math';
import PlaybackBar from './PlaybackBar';
import DeviceList from './DeviceList';
import MapInfoCard from './MapInfoCard';
import type { PlaybackState } from '../../types';
import type { FrontendDevice, FrontendTrip } from '../../lib/api';
import { timeAgo } from '../../lib/api';

export interface MapPanelHandle {
  showTripOnMap: (trip: FrontendTrip, waypoints: [number, number][], actualSpeeds?: number[], speedLimits?: (number | null | undefined)[]) => Promise<void>;
  updateSpeedLimits: (limits: (number | null | undefined)[]) => void;
}

interface MapPanelProps {
  devices: FrontendDevice[] | null;
  trips: FrontendTrip[] | null;
  onRenameDevice?: (deviceId: string, newName: string) => void;
  onDeleteDevice?: (deviceId: string) => void;
}

function makeVehicleIcon(isMoving: boolean) {
  return L.divIcon({
    html: `<div class="fleet-marker" style="display:flex;align-items:center;justify-content:center;position:relative">
      ${isMoving ? '<div class="fleet-pin-ring" style="position:absolute;width:32px;height:32px;border-radius:50%;border:1.5px solid #00D4FF;animation:ping 2.5s ease-out infinite;opacity:0;pointer-events:none"></div><div class="fleet-pin-ring2" style="position:absolute;width:32px;height:32px;border-radius:50%;border:1.5px solid #00D4FF;animation:ping 2.5s ease-out infinite 0.8s;opacity:0;pointer-events:none"></div>' : ''}
      <div class="fleet-pin-dot" style="width:14px;height:14px;border-radius:50%;border:2.5px solid #0F1117;box-shadow:0 0 12px ${isMoving ? 'rgba(0,212,255,0.6)' : 'rgba(245,158,11,0.6)'};background:${isMoving ? '#00D4FF' : '#F59E0B'};position:relative;z-index:1"></div>
    </div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

function makeTripEndpoint(type: 'start' | 'end') {
  const bg = type === 'start' ? '#10B981' : '#EF4444';
  return L.divIcon({
    html: `<div class="trip-endpoint" style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);background:${bg};color:#fff">${type === 'start' ? 'A' : 'B'}</div>`,
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14],
  });
}

function makePlaybackVehicleIcon() {
  return L.divIcon({
    html: `<div class="fleet-marker" style="display:flex;align-items:center;justify-content:center;position:relative">
      <div class="fleet-pin-ring" style="position:absolute;width:32px;height:32px;border-radius:50%;border:1.5px solid #10B981;animation:ping 2.5s ease-out infinite;opacity:0;pointer-events:none"></div>
      <div class="fleet-pin-ring2" style="position:absolute;width:32px;height:32px;border-radius:50%;border:1.5px solid #10B981;animation:ping 2.5s ease-out infinite 0.8s;opacity:0;pointer-events:none"></div>
      <div class="fleet-pin-dot" style="width:16px;height:16px;border-radius:50%;border:2.5px solid #0F1117;box-shadow:0 0 14px rgba(16,185,129,0.7);background:#10B981;position:relative;z-index:1"></div>
    </div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function batteryColor(level: number | null): string {
  if (level === null) return '#64748B'
  if (level >= 70) return '#10B981'
  if (level >= 30) return '#F59E0B'
  return '#EF4444'
}

interface MapLayerDef {
  url: string;
  attr: string;
  maxZoom: number;
  opacity?: number;
}

interface MapStyleDef {
  id: string;
  label: string;
  layers: MapLayerDef[];
}

const MAP_STYLES: MapStyleDef[] = [
  {
    id: 'osm', label: 'Street',
    layers: [{ url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 }],
  },
  {
    id: 'satellite', label: 'Satellite',
    layers: [
      { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '© Esri', maxZoom: 18 },
    ],
  },
  {
    id: 'voyager', label: 'Voyager',
    layers: [{ url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attr: '© <a href="https://carto.com/attributions">CARTO</a>', maxZoom: 19 }],
  },
  {
    id: 'topo', label: 'Topo',
    layers: [{ url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attr: '© <a href="https://opentopomap.org">OpenTopoMap</a>', maxZoom: 17 }],
  },
]

type MapStyleId = MapStyleDef['id']

const MapPanel = forwardRef<MapPanelHandle, MapPanelProps>(function MapPanel({ devices: devicesProp, trips: tripsProp, onRenameDevice, onDeleteDevice }, ref) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [selectedDevice, setSelectedDevice] = useState(0);
  const [pb, setPb] = useState<PlaybackState | null>(null);
  const activeTripLayers = useRef<L.Layer[]>([]);
  const pbDoneLine = useRef<L.Polyline | null>(null);
  const tileLayersRef = useRef<L.TileLayer[]>([]);

  const [showAssets, setShowAssets] = useState(true)
  const [mapStyle, setMapStyle] = useState<MapStyleId>('osm')
  const [showLayers, setShowLayers] = useState(false)
  const deviceArr = devicesProp || []

  // Close layers dropdown on outside click
  useEffect(() => {
    if (!showLayers) return
    const close = () => setShowLayers(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [showLayers])

  const switchMapStyle = useCallback((styleId: MapStyleId) => {
    const style = MAP_STYLES.find(s => s.id === styleId)
    if (!style || !mapRef.current) return
    for (const layer of tileLayersRef.current) {
      mapRef.current.removeLayer(layer)
    }
    tileLayersRef.current = style.layers.map(l =>
      L.tileLayer(l.url, { attribution: l.attr, maxZoom: l.maxZoom, opacity: l.opacity ?? 1 }).addTo(mapRef.current!)
    )
    setMapStyle(styleId)
  }, [])

  const clearTripLayers = useCallback(() => {
    activeTripLayers.current.forEach(l => { try { mapRef.current?.removeLayer(l); } catch {} });
    activeTripLayers.current = [];
    if (pbDoneLine.current) { try { mapRef.current?.removeLayer(pbDoneLine.current); } catch {} pbDoneLine.current = null; }
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [20, 0],
      zoom: 2,
      zoomControl: true,
    });
    const tile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    tileLayersRef.current = [tile];
    mapRef.current = map;

    // My Location button
    const LocateControl = L.Control.extend({
      onAdd() {
        const btn = document.createElement('button')
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>'
        btn.title = 'Show my location'
        btn.className = 'leaflet-control-zoom leaflet-bar leaflet-control'
        btn.style.cssText = 'width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;background:#1E293B;border:1px solid #334155;border-radius:4px;color:#E2E8F0;margin-bottom:4px'
        btn.onmouseenter = () => { btn.style.background = '#334155' }
        btn.onmouseleave = () => { btn.style.background = '#1E293B' }
        btn.onclick = () => {
          if (!map) return
          map.locate({ setView: true, maxZoom: 15 })
        }
        return btn
      },
    })
    new LocateControl({ position: 'bottomright' }).addTo(map)

    // Try browser location on load
    map.on('locationfound', (e: any) => {
      L.circleMarker(e.latlng, { radius: 8, color: '#00D4FF', fillColor: '#00D4FF', fillOpacity: 0.3, weight: 2 }).addTo(map)
    })

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    deviceArr.forEach((d, i) => {
      const isMoving = d.status === 'moving' || d.speed > 0;
      const batColor = batteryColor(d.battery);
      const batText = d.battery !== null ? `${Math.round(d.battery)}%` : 'N/A';
      const marker = L.marker(d.latlng, { icon: makeVehicleIcon(isMoving) })
        .addTo(map)
        .bindPopup(
          `<div style="font-weight:600;font-size:13px;margin-bottom:6px">${d.name}</div>
          <div style="display:flex;justify-content:space-between;gap:14px;margin-bottom:3px;color:#64748B;font-size:11px"><span>ID</span><span style="font-family:'JetBrains Mono',monospace;color:#E2E8F0">${d.plate}</span></div>
          <div style="display:flex;justify-content:space-between;gap:14px;margin-bottom:3px;color:#64748B;font-size:11px"><span>Status</span><span style="color:${isMoving ? '#00D4FF' : '#F59E0B'}">${isMoving ? 'Moving' : 'Stopped'}</span></div>
          <div style="display:flex;justify-content:space-between;gap:14px;margin-bottom:3px;color:#64748B;font-size:11px"><span>Speed</span><span style="font-family:'JetBrains Mono',monospace;color:#E2E8F0">${d.speed.toFixed(1)} mph</span></div>
          <div style="display:flex;justify-content:space-between;gap:14px;margin-bottom:3px;color:#64748B;font-size:11px"><span>Battery</span><span style="font-family:'JetBrains Mono',monospace;color:${batColor}">${batText}</span></div>
          <div style="display:flex;justify-content:space-between;gap:14px;color:#64748B;font-size:11px"><span>Last Update</span><span style="font-family:'JetBrains Mono',monospace;color:#94A3B8">${timeAgo(d.lastUpdate)}</span></div>`,
          { maxWidth: 220 },
        );
      marker.on('click', () => setSelectedDevice(i));
      markersRef.current.push(marker);
    });

  }, [deviceArr]);

  const pbSeek = useCallback((sec: number) => {
    setPb(prev => {
      if (!prev) return prev;
      return { ...prev, currentSec: Math.max(0, Math.min(prev.totalDur, sec)) };
    });
  }, []);

  // Move playback vehicle marker and update done-line trail
  useEffect(() => {
    if (!pb?.active || !pb.vehicleMarker || !pb.coords.length || !pb.totalDur) return;
    const { latlng, idx } = interpAtSec(pb.currentSec, pb.coords, pb.speeds, pb.totalDur);
    pb.vehicleMarker.setLatLng(latlng);

    // Follow mode — keep vehicle centered (instant, no animation to avoid frame-interruption wobble)
    const map = mapRef.current;
    if (map && pb.follow) {
      map.setView(latlng, map.getZoom(), { animate: false });
    }

    // Draw completed portion of the route
    if (!map) return;
    if (pbDoneLine.current) { try { map.removeLayer(pbDoneLine.current); } catch {} }
    const doneCoords = pb.coords.slice(0, Math.min(idx + 2, pb.coords.length));
    if (doneCoords.length >= 2) {
      pbDoneLine.current = L.polyline(doneCoords, { color: '#10B981', weight: 4, opacity: 0.9 }).addTo(map);
    }
  }, [pb?.currentSec, pb?.active]);

  const showTripOnMap = useCallback(async (trip: FrontendTrip, wpts: [number, number][], actualSpeeds?: number[], speedLimits?: (number | null | undefined)[]) => {
    clearTripLayers();
    setPb(null);
    const t = trip;
    if (!t || !wpts || wpts.length < 2) return;

    // Downsample to ~200 points max for performance
    let coords = wpts;
    let speeds: number[];
    let limits: (number | null | undefined)[] = []
    if (coords.length > 200) {
      const step = coords.length / 200;
      const indices = Array.from({ length: 200 }, (_, i) => Math.min(Math.floor(i * step), coords.length - 1));
      coords = indices.map(i => wpts[i]);
      speeds = actualSpeeds?.length ? indices.map(i => actualSpeeds[i]) : [];
      limits = speedLimits?.length ? indices.map(i => speedLimits[i]) : [];
    } else {
      speeds = actualSpeeds || [];
      limits = speedLimits || []
    }

    const totalDur = t.durationSec;
    const cumDist = buildCumDist(coords);
    // Use actual GPS speed readings, or fall back to a synthetic profile
    if (!speeds.length) {
      speeds = coords.map((_, i) => {
        const pct = i / Math.max(coords.length - 1, 1);
        if (pct < 0.15) return Math.round(t.avg * (pct / 0.15));
        if (pct < 0.4) return Math.round(t.avg + (t.max - t.avg) * ((pct - 0.15) / 0.25));
        if (pct < 0.65) return Math.round(t.max - (t.max - t.avg) * ((pct - 0.4) / 0.25));
        return Math.round(t.avg * (1 - (pct - 0.65) / 0.35));
      });
    }

    const newPb: PlaybackState = {
      active: true, playing: false, follow: false,
      route: null, coords, speeds, speedLimits: limits, totalDur, currentSec: 0, speed: 5,
      rafId: null, lastTs: null, tripData: t, cumDist,
      fullLine: null, doneLine: null, vehicleMarker: null, startMarker: null, endMarker: null, segLayers: [],
    };

    const map = mapRef.current;
    if (!map) return;

    const fullLine = L.polyline(coords, { color: '#00D4FF', weight: 3, opacity: 0.18, dashArray: '5,5' }).addTo(map);
    newPb.fullLine = fullLine;
    activeTripLayers.current.push(fullLine);

    for (let i = 0; i < coords.length - 1; i++) {
      const spd = speeds[i];
      const elapsed = totalDur * (i / (coords.length - 1));
      const mins = Math.floor(elapsed / 60), secs = Math.floor(elapsed % 60);
      const timeStr = addMins(t.startTime, mins);
      const limit = limits[i]
      const overLimit = limit != null && spd > limit
      const limitHtml = limit != null
        ? `<div style="display:flex;gap:10px;justify-content:space-between"><span style="color:#64748B">Speed Limit</span><span style="font-weight:600;color:${overLimit ? '#EF4444' : '#10B981'}">${limit} mph${overLimit ? ' ⚠' : ''}</span></div>`
        : ''
      const seg = L.polyline([coords[i], coords[i + 1]], {
        color: overLimit ? '#EF4444' : speedColor(spd), weight: 5, opacity: 0.7,
      }).bindTooltip(
        `<div style="display:flex;gap:10px;justify-content:space-between;margin-bottom:2px"><span style="color:#64748B">Speed</span><span style="font-weight:600;color:${overLimit ? '#EF4444' : speedColor(spd)}">${spd} mph</span></div>
        <div style="display:flex;gap:10px;justify-content:space-between;margin-bottom:2px"><span style="color:#64748B">Time</span><span style="font-weight:600">${timeStr}</span></div>
        <div style="display:flex;gap:10px;justify-content:space-between"><span style="color:#64748B">Elapsed</span><span style="font-weight:600">${mins}m ${secs}s</span></div>
        ${limitHtml}`,
        { className: 'trail-tooltip', sticky: true, direction: 'top', offset: [0, -6] },
      );
      seg.on('click', () => {
        const sec = totalDur * (i / (coords.length - 1));
        pbSeek(sec);
      });
      seg.addTo(map);
      newPb.segLayers.push(seg);
      activeTripLayers.current.push(seg);
    }

    const startMarker = L.marker(coords[0], { icon: makeTripEndpoint('start') })
      .addTo(map)
      .bindPopup(`<div style="font-weight:600">▶ Start</div><div style="font-size:11px;color:#94A3B8">${t.from}</div>`, { maxWidth: 180 });
    newPb.startMarker = startMarker;
    activeTripLayers.current.push(startMarker);

    const endMarker = L.marker(coords[coords.length - 1], { icon: makeTripEndpoint('end') })
      .addTo(map)
      .bindPopup(`<div style="font-weight:600">■ End</div><div style="font-size:11px;color:#94A3B8">${t.to}</div>`, { maxWidth: 180 });
    newPb.endMarker = endMarker;
    activeTripLayers.current.push(endMarker);

    const vehicleMarker = L.marker(coords[0], { icon: makePlaybackVehicleIcon(), zIndexOffset: 1000 }).addTo(map);
    newPb.vehicleMarker = vehicleMarker;
    activeTripLayers.current.push(vehicleMarker);

    map.fitBounds(L.latLngBounds(coords), { padding: [40, 100], maxZoom: 14 });
    setPb(newPb);
  }, [clearTripLayers, pbSeek]);

  const updateSpeedLimits = useCallback((limits: (number | null | undefined)[]) => {
    setPb(prev => {
      if (!prev) return prev;
      return { ...prev, speedLimits: limits };
    });
  }, []);

  useImperativeHandle(ref, () => ({ showTripOnMap, updateSpeedLimits }), [showTripOnMap, updateSpeedLimits]);

  const selectDevice = useCallback((i: number) => {
    const d = deviceArr[i];
    if (!d) return;
    setSelectedDevice(i);
    clearTripLayers();
    setPb(null);
    if (mapRef.current) {
      mapRef.current.flyTo(d.latlng, 13, { duration: 1.2 });
      markersRef.current[i]?.openPopup();
    }
  }, [clearTripLayers, deviceArr]);

  const infoCard = (() => {
    if (!pb || !pb.tripData) {
      const d = deviceArr[selectedDevice] || { speed: 0, battery: null };
      return {
        speed: d.speed ? `${d.speed.toFixed(1)} mph` : '0 mph',
        battery: d.battery !== null ? `${Math.round(d.battery)}%` : 'N/A',
        batteryColor: batteryColor(d.battery),
      };
    }
    const t = pb.tripData;
    return {
      speed: `${t.avg} mph avg`,
      battery: t.dur,
      batteryColor: '#00D4FF',
    };
  })();

  return (
    <div id="panel-map" className="flex w-full h-full relative">
      <div className="map-area flex-1 relative overflow-hidden">
        <div ref={mapContainerRef} id="leaflet-map" className="w-full h-full" />
        <PlaybackBar pb={pb} onSeek={pbSeek} onSetFollow={(v) => setPb(prev => prev ? { ...prev, follow: v } : prev)} />
        {pb?.active ? null : <MapInfoCard {...infoCard} />}

        {/* Show assets toggle */}
        {!showAssets && (
          <button
            onClick={() => setShowAssets(true)}
            className="absolute top-3 right-3 z-[1000] w-9 h-9 rounded-lg bg-surface border border-border text-text-muted hover:text-text cursor-pointer flex items-center justify-center text-sm transition-colors shadow-lg"
            title="Show assets"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </button>
        )}

        {/* Layers button + dropdown */}
        <div className="absolute top-3 right-14 z-[1000] flex flex-col items-end" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setShowLayers(v => !v)}
            className="px-2.5 py-1.5 rounded-lg bg-surface/80 border border-border text-text-muted hover:text-text cursor-pointer flex items-center gap-1.5 text-[11px] font-medium transition-colors shadow-lg backdrop-blur-sm"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            {MAP_STYLES.find(s => s.id === mapStyle)?.label}
          </button>
          <div
            className={`mt-1 bg-surface/90 border border-border rounded-lg overflow-hidden shadow-lg backdrop-blur-sm transition-all duration-200 ${
              showLayers ? 'opacity-100 max-h-[300px]' : 'opacity-0 max-h-0 pointer-events-none'
            }`}
          >
            {MAP_STYLES.map(s => (
              <button
                key={s.id}
                onClick={() => { switchMapStyle(s.id); setShowLayers(false) }}
                className={`block w-full text-left px-3 py-1.5 text-[11px] font-medium cursor-pointer transition-colors border-b border-border/50 last:border-b-0 ${
                  mapStyle === s.id
                    ? 'bg-cyan-dim text-cyan'
                    : 'text-text-muted hover:bg-surface-2 hover:text-text'
                }`}
              >{s.label}</button>
            ))}
          </div>
        </div>
      </div>
      {showAssets && (
        <div className="relative">
          <button
            onClick={() => setShowAssets(false)}
            className="absolute -left-3 top-3 z-[1000] w-6 h-6 rounded-full bg-surface border border-border text-text-muted hover:text-text cursor-pointer flex items-center justify-center text-xs transition-colors shadow-lg"
            title="Hide assets"
          >{'◀'}</button>
          <DeviceList
            devices={deviceArr}
            selected={selectedDevice}
            onSelect={selectDevice}
            onRename={onRenameDevice}
            onDelete={onDeleteDevice}
          />
        </div>
      )}
    </div>
  );
});

export default MapPanel;
