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
import LoginPage from './components/auth/LoginPage';
import { AuthProvider, useAuth } from './lib/auth';
import type { PanelId } from './types';
import { fetchDevices, fetchTrips, connectWebSocket, renameDevice, deleteDevice, fetchTripPositions } from './lib/api';
import type { FrontendDevice, FrontendTrip, ApiPosition, TripPoint } from './lib/api';

function getInitialTheme(): 'dark' | 'light' {
  const saved = localStorage.getItem('fleetoss-theme')
  if (saved === 'light' || saved === 'dark') return saved
  return 'dark'
}

function getInitialColorTheme(): string {
  return localStorage.getItem('fleetoss-color-theme') || 'default'
}

function AppContent() {
  const { user, loading } = useAuth()
  const [activePanel, setActivePanel] = useState<PanelId>(() => {
    const saved = localStorage.getItem('fleetoss-panel')
    return (saved === 'map' || saved === 'trips' || saved === 'maint' || saved === 'fuel' || saved === 'settings') ? saved : 'map'
  });
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme)
  const [colorTheme, setColorTheme] = useState<string>(getInitialColorTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    localStorage.setItem('fleetoss-theme', theme)
  }, [theme])

  useEffect(() => {
    const themes = ['default', 'emerald', 'violet', 'rose', 'amber']
    for (const t of themes) {
      document.documentElement.classList.toggle(`theme-${t}`, colorTheme === t && t !== 'default')
    }
    localStorage.setItem('fleetoss-color-theme', colorTheme)
  }, [colorTheme])

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
    const spdLimits = points.length >= 2 ? points.map(p => p.speedLimit) : []
    await new Promise(r => setTimeout(r, 100))
    mapRef.current?.showTripOnMap(trip, wpts, spds, spdLimits)
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
        <Topbar activePanel={activePanel} deviceCount={devices?.length || 0} theme={theme} onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />
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
          {activePanel === 'settings' && <SettingsPanel showToast={showToast} colorTheme={colorTheme} onColorThemeChange={setColorTheme} />}
        </div>
      </div>
      <Toast message={toastMsg} onDone={() => setToastMsg(null)} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}

function AppInner() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <LoginPage />
  return <AppContent />
}
