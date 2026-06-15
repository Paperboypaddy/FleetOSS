import type { IngestedPosition } from '@fleetoss/core';

// Traccar protocol — used by Traccar Client (Android), OsmAnd, and other apps
// Sends data as HTTP GET query params:
//   ?id=123&lat=47.7&lon=-116.9&speed=34&bearing=180&altitude=700&accuracy=10
//   &batt=85&timestamp=1718300000&odometer=50000&fuel=50&ignition=true
// iOS Traccar Client sends speed in m/s — convert to mph

export interface TraccarParams {
  id: string
  lat: string
  lon: string
  timestamp?: string
  speed?: string
  bearing?: string
  altitude?: string
  accuracy?: string
  batt?: string
  odometer?: string
  fuel?: string
  ignition?: string
  course?: string
  event?: string
  [key: string]: string | undefined
}

export function parseTraccarParams(params: TraccarParams): IngestedPosition {
  const lat = parseFloat(params.lat)
  const lon = parseFloat(params.lon)

  if (isNaN(lat) || isNaN(lon)) {
    throw new Error(`Invalid coordinates: lat=${params.lat}, lon=${params.lon}`)
  }

  let timestamp: string
  if (params.timestamp) {
    const tsNum = parseInt(params.timestamp, 10)
    timestamp = new Date(tsNum * 1000).toISOString()
  } else {
    timestamp = new Date().toISOString()
  }

  const result: IngestedPosition = {
    deviceId: params.id,
    latitude: lat,
    longitude: lon,
    timestamp,
  }

  if (params.speed !== undefined) {
    const ms = parseFloat(params.speed)
    if (!isNaN(ms)) result.speed = Math.round(ms * 2.237 * 100) / 100 // m/s → mph
  }
  if (params.bearing !== undefined) {
    result.bearing = parseFloat(params.bearing)
  }
  if (params.altitude !== undefined) {
    result.altitude = parseFloat(params.altitude)
  }
  if (params.accuracy !== undefined) {
    result.accuracy = parseFloat(params.accuracy)
  }
  if (params.batt !== undefined) {
    result.batteryLevel = parseFloat(params.batt)
  }
  if (params.odometer !== undefined) {
    result.odometer = parseFloat(params.odometer)
  }
  if (params.fuel !== undefined) {
    result.fuelLevel = parseFloat(params.fuel)
  }
  if (params.ignition !== undefined) {
    result.ignition = params.ignition === 'true' || params.ignition === '1'
  }

  const attrs: Record<string, unknown> = {}
  if (params.event) attrs.event = params.event
  if (params.course) attrs.course = params.course
  if (Object.keys(attrs).length > 0) {
    result.attributes = attrs
  }

  return result
}
