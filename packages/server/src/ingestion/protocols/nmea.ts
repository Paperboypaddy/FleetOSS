import type { IngestedPosition } from '@fleetoss/core';

// NMEA coordinate format: DDDMM.MMMM → Decimal degrees
// Latitude: DDMM.MMMM (2 digit degrees)
// Longitude: DDDMM.MMMM (3 digit degrees)
function nmeaToDecimal(nmea: string, direction: string): number {
  if (!nmea) return 0
  const dot = nmea.indexOf('.')
  const degLen = direction === 'N' || direction === 'S' ? 2 : 3
  const deg = parseFloat(nmea.slice(0, degLen))
  const min = parseFloat(nmea.slice(degLen))
  const decimal = deg + min / 60
  return (direction === 'S' || direction === 'W') ? -decimal : decimal
}

// GPGGA: Time, position, fix
// $GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47
function parseGPGGA(fields: string[]): Partial<IngestedPosition> | null {
  if (fields.length < 6 || fields[6] === '0') return null // no fix
  return {
    latitude: nmeaToDecimal(fields[2], fields[3]),
    longitude: nmeaToDecimal(fields[4], fields[5]),
    altitude: fields[9] ? parseFloat(fields[9]) : undefined,
  }
}

// GPRMC: Recommended minimum navigation data
// $GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A
function parseGPRMC(fields: string[]): Partial<IngestedPosition> | null {
  if (fields.length < 7 || fields[2] !== 'A') return null // A = active/valid
  const result: Partial<IngestedPosition> = {
    latitude: nmeaToDecimal(fields[3], fields[4]),
    longitude: nmeaToDecimal(fields[5], fields[6]),
  }
  if (fields[7]) result.speed = parseFloat(fields[7]) * 1.151 // knots → mph
  if (fields[8]) result.bearing = parseFloat(fields[8])
  // Date + time from fields[9] (date) and fields[1] (time)
  if (fields[1] && fields[9]) {
    const time = fields[1]
    const date = fields[9]
    const h = parseInt(time.slice(0, 2))
    const m = parseInt(time.slice(2, 4))
    const s = parseInt(time.slice(4, 6))
    const d = parseInt(date.slice(0, 2))
    const mo = parseInt(date.slice(2, 4)) - 1
    const y = parseInt(date.slice(4, 6)) + 2000
    result.timestamp = new Date(Date.UTC(y, mo, d, h, m, s)).toISOString()
  }
  return result
}

// GPGLL: Geographic position
// $GPGLL,4807.038,N,01131.000,E,123519,A*44
function parseGPGLL(fields: string[]): Partial<IngestedPosition> | null {
  if (fields.length < 7 || fields[6] !== 'A') return null
  return {
    latitude: nmeaToDecimal(fields[1], fields[2]),
    longitude: nmeaToDecimal(fields[3], fields[4]),
  }
}

// Main parser: takes a raw NMEA sentence, returns IngestedPosition or null
export function parseNmeaSentence(sentence: string, deviceId: string): IngestedPosition | null {
  const trimmed = sentence.trim()
  if (!trimmed.startsWith('$')) return null

  // Strip checksum
  const star = trimmed.indexOf('*')
  const body = star >= 0 ? trimmed.slice(1, star) : trimmed.slice(1)
  const fields = body.split(',')

  const type = fields[0]
  let parsed: Partial<IngestedPosition> | null = null

  if (type === 'GPGGA') parsed = parseGPGGA(fields)
  else if (type === 'GPRMC') parsed = parseGPRMC(fields)
  else if (type === 'GPGLL') parsed = parseGPGLL(fields)

  if (!parsed) return null

  return {
    deviceId,
    latitude: parsed.latitude!,
    longitude: parsed.longitude!,
    speed: parsed.speed,
    bearing: parsed.bearing,
    altitude: parsed.altitude,
    timestamp: parsed.timestamp || new Date().toISOString(),
  }
}
