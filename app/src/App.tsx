import { useState, useCallback, useRef, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import MapPanel from './components/map/MapPanel';
import type { MapPanelHandle } from './components/map/MapPanel';
import TripsPanel from './components/trips/TripsPanel';
import MaintPanel from './components/maint/MaintPanel';
import FuelPanel from './components/fuel/FuelPanel';
import SettingsPanel from './components/settings/SettingsPanel';
import Toast from './components/ui/Toast';
import type { PanelId } from './types';
import { fetchDevices, fetchTrips, connectWebSocket, renameDevice, deleteDevice, fetchTripPositions } from './lib/api';
import type { FrontendDevice, FrontendTrip, ApiPosition, TripPoint } from './lib/api';

export default function App() {
  const [activePanel, setActivePanel] = useState<PanelId>(() => {
    const saved = localStorage.getItem('fleetoss-panel')
    return (saved === 'map' || saved === 'trips' || saved === 'maint' || saved === 'fuel' || saved === 'settings') ? saved : 'map'
  });

  useEffect(() => {
    localStorage.setItem('fleetoss-panel', activePanel)
  }, [activePanel])
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [devices, setDevices] = useState<FrontendDevice[] | null>(null);
  const [trips, setTrips] = useState<FrontendTrip[] | null>(null);
  const mapRef = useRef<MapPanelHandle>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const loadDevices = useCallback(() => fetchDevices().then(setDevices), []);
  const loadTrips = useCallback(() => fetchTrips().then(setTrips), []);

  useEffect(() => {
    loadDevices()
    loadTrips()
    wsRef.current = connectWebSocket((pos: ApiPosition) => {
      setDevices(prev => {
        if (!prev) return prev
        return prev.map(d => {
          if (d.apiId !== pos.deviceId) return d
          return {
            ...d,
            latlng: [pos.latitude, pos.longitude] as [number, number],
            speed: pos.speed || 0,
            battery: pos.batteryLevel ?? d.battery,
            status: (pos.speed && pos.speed > 1 ? 'moving' : d.status) as 'moving' | 'stopped' | 'offline',
            lastUpdate: pos.deviceTimestamp || new Date().toISOString(),
          }
        })
      })
    })
    return () => { wsRef.current?.close() }
  }, [loadDevices, loadTrips])

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
  }, [])

  const handleShowTrip = useCallback(async (trip: FrontendTrip) => {
    setActivePanel('map')
    const points = await fetchTripPositions(trip.deviceId, trip.startTimeIso, trip.endTimeIso)
    const wpts = points.length >= 2 ? points.map(p => p.latlng) : trip.waypoints
    const spds = points.length >= 2 ? points.map(p => p.speed) : []
    await new Promise(r => setTimeout(r, 100))
    mapRef.current?.showTripOnMap(trip, wpts, spds)
  }, [])

  const handleRenameDevice = useCallback(async (deviceId: string, newName: string) => {
    try {
      await renameDevice(deviceId, newName)
      setDevices(prev => prev?.map(d => d.apiId === deviceId ? { ...d, name: newName } : d) || null)
      showToast(`Renamed to "${newName}"`)
    } catch {
      showToast('Failed to rename device')
    }
  }, [showToast])

  const handleDeleteDevice = useCallback(async (deviceId: string) => {
    try {
      await deleteDevice(deviceId)
      setDevices(prev => prev?.filter(d => d.apiId !== deviceId) || null)
      showToast('Device removed')
    } catch {
      showToast('Failed to delete device')
    }
  }, [showToast])

  return (
    <div className="shell flex h-screen">
      <Sidebar activePanel={activePanel} onPanelChange={setActivePanel} />
      <div className="main flex flex-col flex-1 overflow-hidden">
        <Topbar activePanel={activePanel} deviceCount={devices?.length || 0} />
        <div className="content flex-1 flex overflow-hidden">
          {activePanel === 'map' && (
            <MapPanel
              ref={mapRef}
              devices={devices}
              trips={trips}
              onRenameDevice={handleRenameDevice}
              onDeleteDevice={handleDeleteDevice}
            />
          )}
          {activePanel === 'trips' && <TripsPanel showToast={showToast} onShowTrip={handleShowTrip} trips={trips} />}
          {activePanel === 'maint' && <MaintPanel showToast={showToast} />}
          {activePanel === 'fuel' && <FuelPanel showToast={showToast} />}
          {activePanel === 'settings' && <SettingsPanel showToast={showToast} />}
        </div>
      </div>
      <Toast message={toastMsg} onDone={() => setToastMsg(null)} />
    </div>
  );
}
