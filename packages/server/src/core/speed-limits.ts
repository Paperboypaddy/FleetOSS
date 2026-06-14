// Speed limit lookup using OpenStreetMap Overpass API

interface SpeedLimitResult {
  speed: number | null // mph, null if unknown
  source: string
}

// Default speed limits by highway type (US defaults)
const highwayDefaults: Record<string, number> = {
  motorway: 65,
  motorway_link: 55,
  trunk: 60,
  trunk_link: 50,
  primary: 55,
  primary_link: 45,
  secondary: 45,
  secondary_link: 35,
  tertiary: 35,
  tertiary_link: 30,
  residential: 25,
  living_street: 15,
  service: 15,
  unclassified: 35,
  road: 35,
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
const MIN_REQUEST_INTERVAL = 500 // ms between Overpass requests

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
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return null
  return res.json()
}

async function lookupSpeedLimit(lat: number, lng: number): Promise<SpeedLimitResult> {
  // First try: find road with explicit maxspeed tag within 200m
  const q1 = `[out:json][timeout:10];way(around:200,${lat},${lng})["highway"]["maxspeed"];out tags 1;`
  const d1 = await queryOverpass(q1)
  if (d1?.elements?.length) {
    const raw = d1.elements[0].tags.maxspeed
    const speed = parseSpeed(raw)
    if (speed) return { speed, source: 'osm' }
  }

  // Second try: find any highway and estimate from road type
  const q2 = `[out:json][timeout:10];way(around:200,${lat},${lng})["highway"];out tags 1;`
  const d2 = await queryOverpass(q2)
  if (d2?.elements?.length) {
    const hw = d2.elements[0].tags.highway
    const name = d2.elements[0].tags.name || ''
    if (hw && highwayDefaults[hw]) {
      return { speed: highwayDefaults[hw], source: `estimated_${hw}` }
    }
    return { speed: null, source: `no_default_${hw || 'unknown'}` }
  }

  return { speed: null, source: 'not_found' }
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
  const results: (number | null)[] = []
  const queries: Array<{ lat: number; lng: number; idx: number }> = []

  for (let i = 0; i < coords.length; i++) {
    const [lat, lng] = coords[i]
    const key = cacheKey(lat, lng)
    const cached = cache.get(key)
    if (cached) {
      results[i] = cached.speed
    } else {
      results[i] = null
      queries.push({ lat, lng, idx: i })
    }
  }

  for (const q of queries) {
    const result = await lookupSpeedLimit(q.lat, q.lng)
    const key = cacheKey(q.lat, q.lng)
    cache.set(key, result)
    results[q.idx] = result.speed
  }

  return results
}
