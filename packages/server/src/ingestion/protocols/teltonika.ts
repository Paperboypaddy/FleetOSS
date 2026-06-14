import type { IngestedPosition } from '@fleetoss/core';

// Teltonika Codec 8 / Codec 8 Extended protocol
// Used by: FM/FMB/FMC/FMM series, FMC003, etc.
// Default port: 5056

// IMEI is sent as the first 15 bytes (ASCII) at connection start
export function extractImei(data: Buffer): string | null {
  const str = data.toString('ascii', 0, 15)
  return /^\d{15}$/.test(str) ? str : null
}

// Codec 8 GPS data: 8 bytes per AVL record
// 4 bytes lat, 4 bytes lon, 2 bytes altitude, 2 bytes angle, 1 byte satellites, 2 bytes speed
export function decodeCodec8Data(data: Buffer): { latitude: number; longitude: number; altitude: number; bearing: number; speed: number } {
  // All values are signed big-endian
  const latRaw = data.readInt32BE(0)
  const lngRaw = data.readInt32BE(4)
  const altitude = data.readInt16BE(8)
  const angle = data.readUInt16BE(10)
  const satellites = data[12]
  const speedKph = data.readUInt16BE(13)

  // Teltonika uses: degrees * 10000000 for lat/lng
  const latitude = latRaw / 10000000
  const longitude = lngRaw / 10000000
  // Speed is in km/h * 10 → convert to mph
  const speed = speedKph ? Math.round(speedKph / 10 * 0.621371 * 100) / 100 : 0
  const bearing = angle

  return { latitude, longitude, altitude, bearing, speed }
}

// Parse Codec 8 AVL packet
export function parseCodec8(buffer: Buffer, imei: string): IngestedPosition[] {
  const positions: IngestedPosition[] = []

  if (buffer.length < 12) return positions

  let offset = 0
  const preamble = buffer.readUInt32BE(offset); offset += 4
  if (preamble !== 0) return positions // AVL ID should be 0 for Codec 8

  const dataLength = buffer.readUInt32BE(offset); offset += 4
  const codecId = buffer[offset]; offset += 1
  const recordCount = buffer[offset]; offset += 1

  if (codecId !== 8 && codecId !== 0x8E) return positions // Only Codec 8 and 8 Extended

  for (let i = 0; i < recordCount; i++) {
    // Each AVL record: timestamp (8 bytes) + GPS (15 bytes) + IO data
    if (offset + 24 > buffer.length) break

    // Timestamp: 8 bytes, milliseconds since epoch
    const tsMs = Number(buffer.readBigUInt64BE(offset)); offset += 8
    const timestamp = new Date(tsMs).toISOString()

    // GPS data: 15 bytes
    const gps = decodeCodec8Data(buffer.slice(offset, offset + 15))
    offset += 15

    // IO element count (1 byte followed by variable IO data) — skip for now
    if (offset >= buffer.length) break
    const ioCount = buffer[offset]; offset += 1

    // Skip IO elements (1 byte ID + 1 byte count + N * value bytes)
    for (let j = 0; j < ioCount && offset < buffer.length; j++) {
      const propId = buffer[offset]; offset += 1
      const propLen = buffer[offset]; offset += 1
      offset += propLen
      if (propId === 1) {
        // Priority
      }
    }

    positions.push({
      deviceId: imei,
      latitude: gps.latitude,
      longitude: gps.longitude,
      speed: gps.speed,
      bearing: gps.bearing,
      altitude: gps.altitude,
      timestamp,
    })
  }

  return positions
}
