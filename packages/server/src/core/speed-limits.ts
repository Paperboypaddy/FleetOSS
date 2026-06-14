// Speed limit lookup using OpenStreetMap Overpass API
// Results are cached server-side; stored in the database after resolution

interface SpeedLimitResult {
  speed: number | null
  source: string
}

const highwayPriority: Record<string, number> = {
  motorway: 10, motorway_link: 9,
  trunk: 8, trunk_link: 7,
  primary: 6, primary_link: 5,
  secondary: 4, secondary_link: 3,
  tertiary: 2, tertiary_link: 1,
  residential: 0, living_street: 0, service: 0, unclassified: 0, road: 0,
}

// Default speed limits by highway type (US defaults, mph)
const highwayDefaults: Record<string, number> = {
  motorway: 65, motorway_link: 55,
  trunk: 60, trunk_link: 50,
  primary: 55, primary_link: 45,
  secondary: 45, secondary_link: 35,
  tertiary: 35, tertiary_link: 30,
  residential: 25, living_street: 15, service: 15,
  unclassified: 35, road: 35,
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
  // Query all highways within 200m, return up to 5
  const q = `[out:json][timeout:10];way(around:200,${lat},${lng})["highway"];out tags 5;`
  const data = await queryOverpass(q)
  if (!data?.elements?.length) return { speed: null, source: 'not_found' }

  // Sort by road priority (highest first) and find the best speed limit
  const roads = data.elements as Array<{ tags: Record<string, string> }>

  // First pass: find highest priority road with an explicit maxspeed
  let bestExplicit: { priority: number; speed: number } | null = null
  // Second pass: find highest priority road for estimation
  let bestEstimate: { priority: number; speed: number; hw: string } | null = null

  for (const road of roads) {
    const hw = road.tags.highway
    const priority = highwayPriority[hw] ?? -1
    if (priority < 0) continue

    // Check for explicit maxspeed
    const maxspeed = road.tags.maxspeed || road.tags['maxspeed:forward'] || road.tags['maxspeed:backward']
    if (maxspeed) {
      const parsed = parseSpeed(maxspeed)
      if (parsed && (!bestExplicit || priority > bestExplicit.priority)) {
        bestExplicit = { priority, speed: parsed }
      }
    }

    // Track best road type for estimation
    if (!bestExplicit && highwayDefaults[hw] && (!bestEstimate || priority > bestEstimate.priority)) {
      bestEstimate = { priority, speed: highwayDefaults[hw], hw }
    }
  }

  if (bestExplicit) return { speed: bestExplicit.speed, source: 'osm' }
  if (bestEstimate) return { speed: bestEstimate.speed, source: `estimated_${bestEstimate.hw}` }
  return { speed: null, source: 'no_match' }
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
