import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { devices, tripsData } from '../../data/mockData';
import { fetchOSRMRoute } from '../../lib/osm';
import { buildSpeedProfile, buildCumDist, speedColor, addMins } from '../../lib/math';
import PlaybackBar from './PlaybackBar';
import DeviceList from './DeviceList';
import MapInfoCard from './MapInfoCard';
import type { PlaybackState } from '../../types';

export interface MapPanelHandle {
  showTripOnMap: (tripIdx: number) => Promise<void>;
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
      <div class="fleet-pin-ring" style="position:absolute;width:32px;height:32px;border-radius:50%;border:1.5px solid #00D4FF;animation:ping 2.5s ease-out infinite;opacity:0;pointer-events:none"></div>
      <div class="fleet-pin-ring2" style="position:absolute;width:32px;height:32px;border-radius:50%;border:1.5px solid #00D4FF;animation:ping 2.5s ease-out infinite 0.8s;opacity:0;pointer-events:none"></div>
      <div class="fleet-pin-dot" style="width:14px;height:14px;border-radius:50%;border:2.5px solid #0F1117;box-shadow:0 0 12px rgba(0,212,255,0.6);background:#00D4FF;position:relative;z-index:1"></div>
    </div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

const MapPanel = forwardRef<MapPanelHandle, object>(function MapPanel(_props, ref) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [selectedDevice, setSelectedDevice] = useState(0);
  const [pb, setPb] = useState<PlaybackState | null>(null);
  const activeTripLayers = useRef<L.Layer[]>([]);
  const pbDoneLine = useRef<L.Polyline | null>(null);

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

    devices.forEach((d, i) => {
      const isMoving = d.status === 'moving';
      const marker = L.marker(d.latlng, { icon: makeVehicleIcon(isMoving) })
        .addTo(map)
        .bindPopup(
          `<div style="font-weight:600;font-size:13px;margin-bottom:6px">${d.name}</div>
          <div style="display:flex;justify-content:space-between;gap:14px;margin-bottom:3px;color:#64748B;font-size:11px"><span>Plate</span><span style="font-family:'JetBrains Mono',monospace;color:#E2E8F0">${d.plate}</span></div>
          <div style="display:flex;justify-content:space-between;gap:14px;margin-bottom:3px;color:#64748B;font-size:11px"><span>Status</span><span style="color:${isMoving ? '#00D4FF' : '#F59E0B'}">${isMoving ? 'Moving' : 'Stopped'}</span></div>
          <div style="display:flex;justify-content:space-between;gap:14px;margin-bottom:3px;color:#64748B;font-size:11px"><span>Speed</span><span style="font-family:'JetBrains Mono',monospace;color:#E2E8F0">${d.speed} mph</span></div>
          <div style="display:flex;justify-content:space-between;gap:14px;margin-bottom:3px;color:#64748B;font-size:11px"><span>ODO</span><span style="font-family:'JetBrains Mono',monospace;color:#E2E8F0">${d.odo.toLocaleString()} mi</span></div>
          <div style="display:flex;justify-content:space-between;gap:14px;margin-bottom:3px;color:#64748B;font-size:11px"><span>Today</span><span style="font-family:'JetBrains Mono',monospace;color:#E2E8F0">${d.today} mi</span></div>`,
          { maxWidth: 220 },
        );
      marker.on('click', () => setSelectedDevice(i));
      markersRef.current.push(marker);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const pbSeek = useCallback((sec: number) => {
    setPb(prev => {
      if (!prev) return prev;
      return { ...prev, currentSec: Math.max(0, Math.min(prev.totalDur, sec)) };
    });
  }, []);

  const showTripOnMap = useCallback(async (tripIdx: number) => {
    clearTripLayers();
    setPb(null);
    const t = tripsData[tripIdx];
    if (!t || !t.waypoints) return;

    const route = await fetchOSRMRoute(t.waypoints);
    if (!route) return;

    const coords = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
    const speeds = buildSpeedProfile(coords, t);
    const cumDist = buildCumDist(coords);
    const totalDur = route.duration;

    const newPb: PlaybackState = {
      active: true, playing: false,
      route, coords, speeds, totalDur, currentSec: 0, speed: 5,
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
      const seg = L.polyline([coords[i], coords[i + 1]], {
        color: speedColor(spd), weight: 5, opacity: 0.7,
      }).bindTooltip(
        `<div style="display:flex;gap:10px;justify-content:space-between;margin-bottom:2px"><span style="color:#64748B">Speed</span><span style="font-weight:600;color:${speedColor(spd)}">${spd} mph</span></div>
        <div style="display:flex;gap:10px;justify-content:space-between;margin-bottom:2px"><span style="color:#64748B">Time</span><span style="font-weight:600">${timeStr}</span></div>
        <div style="display:flex;gap:10px;justify-content:space-between"><span style="color:#64748B">Elapsed</span><span style="font-weight:600">${mins}m ${secs}s</span></div>`,
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
    const d = devices[i];
    setSelectedDevice(i);
    clearTripLayers();
    setPb(null);
    if (mapRef.current) {
      mapRef.current.flyTo(d.latlng, 13, { duration: 1.2 });
      markersRef.current[i]?.openPopup();
    }
  }, [clearTripLayers]);

  const infoCard = (() => {
    if (!pb || !pb.tripData) {
      const d = devices[selectedDevice];
      return {
        speed: d.speed ? `${d.speed} mph` : '0 mph',
        odo: `${d.odo.toLocaleString()} mi`,
        today: `${d.today} mi`,
        engine: d.engine,
        engineColor: d.engine === 'Running' ? '#10B981' : '#64748B',
      };
    }
    const t = pb.tripData;
    return {
      speed: `${t.avg} mph avg`,
      odo: `${t.dist} mi`,
      today: t.dur,
      engine: `${t.from} → ${t.to}`,
      engineColor: '#00D4FF',
    };
  })();

  return (
    <div id="panel-map" className="flex w-full h-full relative">
      <div className="map-area flex-1 relative overflow-hidden">
        <div ref={mapContainerRef} id="leaflet-map" className="w-full h-full" />
        <PlaybackBar pb={pb} onSeek={pbSeek} />
        <MapInfoCard {...infoCard} />
      </div>
      <DeviceList devices={devices} selected={selectedDevice} onSelect={selectDevice} />
    </div>
  );
});

export default MapPanel;
