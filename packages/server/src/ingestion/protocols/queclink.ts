import type { IngestedPosition } from '@fleetoss/core';

// Queclink protocol — used by GL200, GV300, GV500, GV55, GMT100 series
// Default port: 5004

export interface QueclinkMessage {
  deviceId: string
  type: 'login' | 'position' | 'heartbeat' | 'unknown'
  data: Partial<IngestedPosition> | null
  ackId: string
}

// Parse a single Queclink message line
// Format: +RESP:GXXX,protocol_version,device_id,imei,send_time,count,lat,lng,speed,course,altitude,satellites,...
export function parseQueclink(line: string): QueclinkMessage | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('+RESP:')) {
    // Check for login/initial message: +RESP:GTIOS,...
    if (trimmed.startsWith('+RESP:GTIOS,')) {
      const parts = trimmed.split(',')
      const deviceId = parts[2] || parts[3] || 'unknown'
      return { deviceId, type: 'login', data: null, ackId: parts[1] || '' }
    }
    return null
  }

  // Remove +RESP: prefix
  const body = trimmed.slice(6)
  const parts = body.split(',')

  if (parts.length < 5) return null

  const msgType = parts[0] // e.g., GTFRI, GTIGF, GTCAN, etc.
  const protocolVersion = parts[1]
  const deviceId = parts[2] || ''
  const imei = parts[3] || ''
  const actualId = deviceId || imei
  if (!actualId) return null

  const ackId = msgType

  // Position messages have at least 8 fields after the header
  // +RESP:GTFRI,ver,id,imei,time,seq,lat,lng,speed,course,altitude,sat,...
  // Some formats use | as separator instead of comma
  // Time format: DDMMYY,HHMMSS (separated or combined)

  // Find position data — format varies by message type
  // Common: ...,timestamp,lat,lng,speed,course,altitude,satellites,...

  // Try comma-separated format first
  // For GTFRI: +RESP:GTFRI,ver,id,imei,time,seq,lat,lng,speed,course,altitude,sat
  // Index:          0     1   2   3     4    5   6   7    8     9      10   11

  if (msgType === 'GTFRI' || msgType === 'GTIGF' || msgType === 'GTCAN' || msgType === 'GTIGT') {
    if (parts.length < 12) return { deviceId: actualId, type: 'heartbeat', data: null, ackId }

    const latIdx = 6, lngIdx = 7, speedIdx = 8, courseIdx = 9, altIdx = 10

    const latRaw = parts[latIdx]
    const lngRaw = parts[lngIdx]
    if (!latRaw || !lngRaw) return { deviceId: actualId, type: 'heartbeat', data: null, ackId }

    const latitude = parseFloat(latRaw)
    const longitude = parseFloat(lngRaw)
    if (isNaN(latitude) || isNaN(longitude)) return { deviceId: actualId, type: 'heartbeat', data: null, ackId }

    const speedKph = parseFloat(parts[speedIdx])
    const speed = isNaN(speedKph) ? undefined : Math.round(speedKph * 0.621371 * 100) / 100
    const course = parseFloat(parts[courseIdx])
    const bearing = isNaN(course) ? undefined : course
    const altitude = altIdx < parts.length ? parseFloat(parts[altIdx]) : undefined

    let timestamp = new Date().toISOString()
    if (parts[4]) {
      // Time format in parts[4]: YYYYMMDDHHMMSS or DDMMYYHHMMSS
      const timeStr = parts[4].replace(/[^0-9]/g, '')
      if (timeStr.length >= 12) {
        let year = parseInt(timeStr.slice(0, 4))
        let month = parseInt(timeStr.slice(4, 6)) - 1
        let day = parseInt(timeStr.slice(6, 8))
        let hour = parseInt(timeStr.slice(8, 10))
        let min = parseInt(timeStr.slice(10, 12))
        let sec = 0
        if (timeStr.length >= 14) sec = parseInt(timeStr.slice(12, 14))
        if (year < 100) year += 2000
        const ts = new Date(Date.UTC(year, month, day, hour, min, sec))
        if (!isNaN(ts.getTime())) timestamp = ts.toISOString()
      }
    }

    return {
      deviceId: actualId,
      type: 'position',
      data: { latitude, longitude, speed, bearing, altitude, timestamp },
      ackId,
    }
  }

  // Other message types treated as heartbeat
  return { deviceId: actualId, type: 'heartbeat', data: null, ackId }
}

export function buildQueclinkAck(ackId: string): string {
  return `+SACK:${ackId}\n`
}
