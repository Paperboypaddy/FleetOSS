const API = '/api'
const WS = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`

export interface ApiDevice {
  id: string
  name: string
  uniqueId: string
  plate: string | null
  vin: string | null
  status: 'online' | 'offline' | 'unknown'
  position?: {
    id: string
    latitude: number
    longitude: number
    speed: number | null
    bearing: number | null
    altitude: number | null
    batteryLevel: number | null
    odometer: number | null
    deviceTimestamp: string
  }
  attributes: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ApiTrip {
  id: string
  deviceId: string
  startPositionId: string | null
  endPositionId: string | null
  startTime: string
  endTime: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  startAddress: string | null
  endAddress: string | null
  distance: number
  duration: number
  avgSpeed: number
  maxSpeed: number
  stopDuration: number | null
  attributes: Record<string, unknown>
}

export interface ApiPosition {
  id: string
  deviceId: string
  latitude: number
  longitude: number
  altitude: number | null
  speed: number | null
  bearing: number | null
  accuracy: number | null
  batteryLevel: number | null
  odometer: number | null
  deviceTimestamp: string
  serverTimestamp: string
  protocol: string
}

export interface FrontendDevice {
  apiId: string
  name: string
  plate: string
  status: 'moving' | 'stopped' | 'offline'
  speed: number
  battery: number | null
  latlng: [number, number]
}

export interface FrontendTrip {
  date: string
  vehicle: string
  from: string
  to: string
  dist: number
  dur: string
  avg: number
  max: number
  startSpeed: number
  endSpeed: number
  startTime: string
  type: 'Work' | 'Personal'
  purpose: string
  waypoints: [number, number][]
  apiId?: string
}

function mapStatus(apiStatus: string): 'moving' | 'stopped' | 'offline' {
  if (apiStatus === 'online') return 'moving'
  if (apiStatus === 'offline') return 'offline'
  return 'stopped'
}

function mapDevice(api: ApiDevice, latestPosition?: ApiPosition): FrontendDevice {
  const pos = api.position || latestPosition
  return {
    apiId: api.id,
    name: api.name,
    plate: api.plate || api.uniqueId,
    status: pos?.speed && pos.speed > 1 ? 'moving' : mapStatus(api.status),
    speed: pos?.speed || 0,
    battery: pos?.batteryLevel ?? null,
    latlng: pos ? [pos.latitude, pos.longitude] : [47.718, -116.945],
  }
}

function mapTrip(api: ApiTrip, deviceName: string): FrontendTrip {
  const startDate = new Date(api.startTime)
  const endDate = new Date(api.endTime)
  const durSec = api.duration
  const durMin = Math.floor(durSec / 60)
  const durHr = Math.floor(durMin / 60)
  const durStr = durHr > 0 ? `${durHr}:${String(durMin % 60).padStart(2, '0')}` : `0:${durMin}`
  const startTimeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`

  return {
    date: startDate.toISOString().split('T')[0],
    vehicle: deviceName,
    from: api.startAddress || `${api.startLat.toFixed(4)}, ${api.startLng.toFixed(4)}`,
    to: api.endAddress || `${api.endLat.toFixed(4)}, ${api.endLng.toFixed(4)}`,
    dist: Math.round(api.distance * 10) / 10,
    dur: durStr,
    avg: Math.round(api.avgSpeed),
    max: Math.round(api.maxSpeed),
    startSpeed: 0,
    endSpeed: 0,
    startTime: startTimeStr,
    type: 'Work',
    purpose: '',
    waypoints: [[api.startLat, api.startLng], [api.endLat, api.endLng]],
    apiId: api.id,
  }
}

export async function fetchDevices(): Promise<FrontendDevice[]> {
  try {
    const res = await fetch(`${API}/devices`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: ApiDevice[] = await res.json()
    const result: FrontendDevice[] = []
    for (const d of data) {
      let latestPos: ApiPosition | undefined
      try {
        const posRes = await fetch(`${API}/devices/${d.id}/positions?limit=1`)
        if (posRes.ok) {
          const positions: ApiPosition[] = await posRes.json()
          latestPos = positions[0]
        }
      } catch {}
      result.push(mapDevice(d, latestPos))
    }
    return result
  } catch (err) {
    console.warn('Failed to fetch devices, using mock data fallback', err)
    const { devices } = await import('../data/mockData')
    return devices.map((d: any, i: number) => ({
      apiId: `mock-${i}`,
      name: d.name,
      plate: d.plate,
      status: d.status,
      speed: d.speed,
      battery: null,
      latlng: d.latlng,
    }))
  }
}

export async function renameDevice(deviceId: string, name: string): Promise<void> {
  const res = await fetch(`${API}/devices/${deviceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(`Failed to rename: ${res.status}`)
}

export async function deleteDevice(deviceId: string): Promise<void> {
  const res = await fetch(`${API}/devices/${deviceId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete: ${res.status}`)
}

export async function fetchTrips(): Promise<FrontendTrip[]> {
  try {
    const res = await fetch(`${API}/trips`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: ApiTrip[] = await res.json()
    const deviceRes = await fetch(`${API}/devices`)
    const devices: ApiDevice[] = deviceRes.ok ? await deviceRes.json() : []
    const nameMap = new Map(devices.map(d => [d.id, d.name]))
    return data.map(t => mapTrip(t, nameMap.get(t.deviceId) || t.deviceId))
  } catch (err) {
    console.warn('Failed to fetch trips, using mock data fallback', err)
    const { tripsData } = await import('../data/mockData')
    return tripsData
  }
}

export function connectWebSocket(onPosition: (pos: ApiPosition) => void): WebSocket | null {
  try {
    const ws = new WebSocket(WS)
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', deviceIds: ['*'] }))
    }
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'position' && msg.data) {
          onPosition(msg.data)
        }
      } catch {}
    }
    ws.onerror = () => {}
    return ws
  } catch {
    return null
  }
}
