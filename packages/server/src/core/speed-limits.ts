// Speed limit lookup using OpenStreetMap Overpass API
// Only returns limits from explicit maxspeed tags — no road-type estimation

interface SpeedLimitResult {
  speed: number | null // mph, null if unknown
  source: string
}

function parseSpeed(raw: string): number | null {
  const num = parseFloat(raw)
  if (isNaN(num)) return null
  if (raw.includes('km/h') || raw.includes('kph') || raw.includes('kmh')) {
    return Math.round(num * 0.621371)
  }
  return Math.round(num)
}

let lastRequestTime = 0
const MIN_REQUEST_INTERVAL = 200

async function queryOverpass(query: string): Promise<any> {
  const now = Date.now()
  const wait = MIN_REQUEST_INTERVAL - (now - lastRequestTime)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastRequestTime = Date.now()

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'FleetOSS/1.0',
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) return null
  return res.json()
}

async function lookupSpeedLimit(lat: number, lng: number): Promise<SpeedLimitResult> {
  // Only look for roads with an explicit maxspeed tag — no estimation
  const q = `[out:json][timeout:10];way(around:200,${lat},${lng})["highway"]["maxspeed"];out tags 1;`
  const data = await queryOverpass(q)
  if (!data?.elements?.length) return { speed: null, source: 'not_found' }

  const raw = data.elements[0].tags.maxspeed ||
              data.elements[0].tags['maxspeed:forward'] ||
              data.elements[0].tags['maxspeed:backward']
  if (!raw) return { speed: null, source: 'no_tag' }

  const speed = parseSpeed(raw)
  return speed ? { speed, source: 'osm' } : { speed: null, source: 'unparseable' }
}

const cache = new Map<string, SpeedLimitResult>()

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`
}

export async function getSpeedLimit(lat: number, lng: number): Promise<SpeedLimitResult> {
  const key = cacheKey(lat, lng)
  const cached = cache.get(key)
  if (cached) return cached
  const result = await lookupSpeedLimit(lat, lng)
  cache.set(key, result)
  return result
}

export async function getSpeedLimits(coords: Array<[number, number]>): Promise<(number | null)[]> {
  return Promise.all(coords.map(async ([lat, lng]) => {
    const r = await getSpeedLimit(lat, lng)
    return r.speed
  }))
}

export async function resolveSpeedLimitForPosition(positionId: string, lat: number, lng: number): Promise<void> {
  try {
    const result = await getSpeedLimit(lat, lng)
    if (result.speed != null) {
      const { getDb } = await import('../db/connection.js')
      const { positions } = await import('../db/schema.js')
      const { eq } = await import('drizzle-orm')
      const db = getDb()
      await db.update(positions).set({ speedLimit: result.speed }).where(eq(positions.id, positionId))
    }
  } catch {}
}
