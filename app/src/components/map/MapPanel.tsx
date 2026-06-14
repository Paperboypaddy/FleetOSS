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

const MapPanel = forwardRef<MapPanelHandle, MapPanelProps>(function MapPanel({ devices: devicesProp, trips: tripsProp, onRenameDevice, onDeleteDevice }, ref) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [selectedDevice, setSelectedDevice] = useState(0);
  const [pb, setPb] = useState<PlaybackState | null>(null);
  const activeTripLayers = useRef<L.Layer[]>([]);
  const pbDoneLine = useRef<L.Polyline | null>(null);

  const [showAssets, setShowAssets] = useState(true)
  const deviceArr = devicesProp || []
  const tripsArr = tripsProp || []

  const clearTripLayers = useCallback(() => {
    activeTripLayers.current.forEach(l => { try { mapRef.current?.removeLayer(l); } catch {} });
    activeTripLayers.current = [];
    if (pbDoneLine.current) { try { mapRef.current?.removeLayer(pbDoneLine.current); } catch {} pbDoneLine.current = null; }
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [47.718, -116.945],
      zoom: 11,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    const defaultCenter = [47.718, -116.945] as [number, number];

    deviceArr.forEach((d, i) => {
      const isMoving = d.status === 'moving' || d.speed > 0;
      const batColor = batteryColor(d.battery);
      const batText = d.battery !== null ? `${Math.round(d.battery)}%` : 'N/A';
      const marker = L.marker(d.latlng || defaultCenter, { icon: makeVehicleIcon(isMoving) })
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

    if (!deviceArr.length && !markersRef.current.length) {
      const defaultMarker = L.marker(defaultCenter, { icon: makeVehicleIcon(false) }).addTo(map);
      markersRef.current.push(defaultMarker);
    }
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

    // Draw completed portion of the route
    const map = mapRef.current;
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
      active: true, playing: false,
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

  useImperativeHandle(ref, () => ({ showTripOnMap }), [showTripOnMap]);

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
        <PlaybackBar pb={pb} onSeek={pbSeek} />
        {pb?.active ? null : <MapInfoCard {...infoCard} />}
        {!showAssets && (
          <button
            onClick={() => setShowAssets(true)}
            className="absolute top-3 right-3 z-[1000] w-9 h-9 rounded-lg bg-surface border border-border text-text-muted hover:text-text cursor-pointer flex items-center justify-center text-sm transition-colors shadow-lg"
            title="Show assets"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </button>
        )}
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
