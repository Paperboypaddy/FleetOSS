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
  lastUpdate: string | null // ISO timestamp
}

export function timeAgo(iso: string | null): string {
  if (!iso) return 'never'
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 10) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export interface FrontendTrip {
  date: string
  vehicle: string
  from: string
  to: string
  dist: number
  dur: string
  durationSec: number
  avg: number
  max: number
  startSpeed: number
  endSpeed: number
  startTime: string
  endTime: string
  type: 'Work' | 'Personal' | null
  purpose: string
  waypoints: [number, number][]
  apiId?: string
  deviceId: string
  startTimeIso: string
  endTimeIso: string
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
    lastUpdate: pos?.deviceTimestamp || null,
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
  const endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`

  const attrs = (api.attributes || {}) as Record<string, string>
  const tripType = (attrs.type === 'Work' || attrs.type === 'Personal') ? attrs.type : null

  return {
    date: startDate.toISOString().split('T')[0],
    vehicle: deviceName,
    from: api.startAddress || `${api.startLat.toFixed(4)}, ${api.startLng.toFixed(4)}`,
    to: api.endAddress || `${api.endLat.toFixed(4)}, ${api.endLng.toFixed(4)}`,
    dist: Math.round(api.distance * 10) / 10,
    dur: durStr,
    durationSec: durSec,
    avg: Math.round(api.avgSpeed),
    max: Math.round(api.maxSpeed),
    startSpeed: 0,
    endSpeed: 0,
    startTime: startTimeStr,
    endTime: endTimeStr,
    type: tripType as 'Work' | 'Personal' | null,
    purpose: attrs.purpose || '',
    waypoints: [[api.startLat, api.startLng], [api.endLat, api.endLng]],
    apiId: api.id,
    deviceId: api.deviceId,
    startTimeIso: api.startTime,
    endTimeIso: api.endTime,
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
      lastUpdate: null,
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

export interface TripPoint {
  latlng: [number, number]
  speed: number
}

export async function updateTrip(tripId: string, data: { type?: string; purpose?: string }): Promise<void> {
  await fetch(`${API}/trips/${tripId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } },
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.address) return null
    const a = data.address
    // Build a short address: "Street Name, City" or "City, State"
    const street = [a.house_number, a.road, a.pedestrian].filter(Boolean).join(' ')
    const city = a.city || a.town || a.village || a.municipality || ''
    const state = a.state || ''
    if (street && city) return `${street}, ${city}`
    if (city && state) return `${city}, ${state}`
    if (street) return street
    if (city) return city
    return data.display_name?.split(',').slice(0, 3).join(',') || null
  } catch {
    return null
  }
}

export async function fetchTripPositions(deviceId: string, from: string, to: string): Promise<TripPoint[]> {
  try {
    const fromParam = encodeURIComponent(from)
    const toParam = encodeURIComponent(to)
    const res = await fetch(`${API}/devices/${deviceId}/positions?from=${fromParam}&to=${toParam}&limit=1000`)
    if (!res.ok) return []
    const positions: ApiPosition[] = await res.json()
    return positions.reverse().map(p => ({
      latlng: [p.latitude, p.longitude] as [number, number],
      speed: (p.speed != null && p.speed >= 0) ? Math.round(p.speed) : 0,
    }))
  } catch {
    return []
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
