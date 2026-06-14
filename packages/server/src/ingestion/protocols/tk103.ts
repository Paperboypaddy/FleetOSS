import type { IngestedPosition } from '@fleetoss/core';

// TK103 text-based protocol — used by TK103, TK104, and many Chinese GPS tracker clones
// Default port: 5002

export interface Tk103Message {
  deviceId: string
  type: 'login' | 'position' | 'heartbeat' | 'unknown'
  data: Partial<IngestedPosition> | null
}

// Parse coordinate: DDMM.MMMM or DDDMM.MMMM format
function parseCoord(value: string, dir: string): number {
  if (!value) return 0
  const dot = value.indexOf('.')
  const degLen = (dir === 'N' || dir === 'S') ? 2 : 3
  const deg = parseFloat(value.slice(0, degLen))
  const min = parseFloat(value.slice(degLen))
  const decimal = deg + min / 60
  return (dir === 'S' || dir === 'W') ? -decimal : decimal
}

// Primary TK103 format: ##,imei:XXXXXX,A/B/C,data...
export function parseTk103(line: string): Tk103Message | null {
  const trimmed = line.trim()

  // Skip empty or malformed lines
  if (!trimmed.startsWith('##,')) return null

  // Extract IMEI from ##,imei:XXXXXXXXX,
  const imeiMatch = trimmed.match(/##,imei:(\d+),?/)
  if (!imeiMatch) return null
  const deviceId = imeiMatch[1]

  // Login: ##,imei:XXXXXX,A;
  // Heartbeat: ##,imei:XXXXXX,; or ##,imei:XXXXXX;
  // Position: ##,imei:XXXXXX,B,DDMMYY,HHMMSS,lat,NS,lon,EW,speed,course,status,...;

  const typeCode = trimmed.includes(',A;') || trimmed.includes(',A,') ? 'A' :
                   trimmed.includes(',B;') || trimmed.includes(',B,') ? 'B' :
                   trimmed.includes(',C;') || trimmed.includes(',C,') ? 'C' : ''

  if (typeCode === 'A' || trimmed.includes('imei:') && !typeCode) {
    // Login / heartbeat with no position
    const hasPos = trimmed.includes(',B,')
    return {
      deviceId,
      type: hasPos ? 'position' : 'login',
      data: null,
    }
  }

  if (typeCode === 'B' || typeCode === 'C') {
    // Parse position data: ##,imei:ID,B,DDMMYY,HHMMSS,lat,NS,lon,EW,speed,course,status,...
    const parts = trimmed.split(',')
    // Find the type B marker position
    const typeIdx = parts.findIndex(p => p === 'B' || p === 'C')
    if (typeIdx < 0 || typeIdx + 9 > parts.length) return { deviceId, type: 'position', data: null }

    const dateStr = parts[typeIdx + 1]  // DDMMYY
    const timeStr = parts[typeIdx + 2]  // HHMMSS
    const latStr = parts[typeIdx + 3]
    const nsDir = parts[typeIdx + 4]
    const lngStr = parts[typeIdx + 5]
    const ewDir = parts[typeIdx + 6]
    const speedKnots = parseFloat(parts[typeIdx + 7])
    const course = parseFloat(parts[typeIdx + 8])

    const latitude = parseCoord(latStr, nsDir)
    const longitude = parseCoord(lngStr, ewDir)
    const speed = isNaN(speedKnots) ? undefined : Math.round(speedKnots * 1.151 * 100) / 100
    const bearing = isNaN(course) ? undefined : course

    // Build timestamp from DDMMYY + HHMMSS
    let timestamp = new Date().toISOString()
    if (dateStr && timeStr && dateStr.length === 6 && timeStr.length === 6) {
      const d = parseInt(dateStr.slice(0, 2))
      const mo = parseInt(dateStr.slice(2, 4)) - 1
      const y = 2000 + parseInt(dateStr.slice(4, 6))
      const h = parseInt(timeStr.slice(0, 2))
      const mi = parseInt(timeStr.slice(2, 4))
      const s = parseInt(timeStr.slice(4, 6))
      const ts = new Date(Date.UTC(y, mo, d, h, mi, s))
      if (!isNaN(ts.getTime())) timestamp = ts.toISOString()
    }

    return {
      deviceId,
      type: 'position',
      data: { latitude, longitude, speed, bearing, timestamp },
    }
  }

  // Just a heartbeat with no recognizable type
  return { deviceId, type: 'heartbeat', data: null }
}
