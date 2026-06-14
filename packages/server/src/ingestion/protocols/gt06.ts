import type { IngestedPosition } from '@fleetoss/core';

// GT06 / Concox binary protocol — used by Concox, Coban, SinoTrack, and clones
// Default port: 5001

export interface Gt06Message {
  type: number
  data: Buffer
}

interface ParseResult {
  message: Gt06Message
  consumed: number
}

function getNibbles(buf: Buffer, offset: number, count: number): number[] {
  const result: number[] = []
  for (let i = 0; i < count * 2 && offset + Math.floor(i / 2) < buf.length; i++) {
    const byte = buf[offset + Math.floor(i / 2)]
    result.push(i % 2 === 0 ? (byte >> 4) & 0x0f : byte & 0x0f)
  }
  return result
}

function verifyChecksum(msg: Buffer): boolean {
  if (msg.length < 4) return false
  const checksum = msg[msg.length - 3]
  let calc = 0
  for (let i = 2; i < msg.length - 3; i++) {
    calc ^= msg[i]
  }
  return calc === checksum
}

function calcChecksum(dataLen: number, protocol: number, data: Buffer): number {
  let c = 0
  c ^= dataLen
  c ^= protocol
  for (let i = 0; i < data.length; i++) c ^= data[i]
  return c
}

export function parseGt06(buffer: Buffer): ParseResult | null {
  if (buffer.length < 7) return null
  if (buffer[0] !== 0x78 && buffer[0] !== 0x79) return null

  const msgLen = buffer[2]
  if (msgLen < 1) return null

  const totalLen = 2 + 1 + msgLen + 1 + 2
  if (buffer.length < totalLen) return null
  if (buffer[totalLen - 2] !== 0x0D || buffer[totalLen - 1] !== 0x0A) return null

  const msgBuf = buffer.slice(0, totalLen)
  if (!verifyChecksum(msgBuf)) return null

  const protoNum = buffer[3]
  const data = buffer.slice(4, 4 + msgLen - 1)

  return { message: { type: protoNum, data }, consumed: totalLen }
}

export function parseGt06Imei(data: Buffer): string {
  let imei = ''
  for (let i = 0; i < data.length && i < 8; i++) {
    imei += String(data[i] >> 4) + String(data[i] & 0x0f)
  }
  return imei.replace(/^0+/, '')
}

export function buildGt06Response(type: number): Buffer {
  const dataLen = 1
  const data = Buffer.from([type])
  const checksum = calcChecksum(dataLen, 0, data)
  return Buffer.from([0x78, 0x78, dataLen, ...data, checksum, 0x0D, 0x0A])
}

export function parseGt06GpsData(data: Buffer): Partial<IngestedPosition> | null {
  if (data.length < 15) return null

  // Date/Time: 6 bytes BCD (YY/MM/DD HH:MM:SS)
  const nib = (off: number) => getNibbles(data, off, 1)
  const year = 2000 + nib(0)[0] * 10 + nib(0)[1]
  const month = nib(1)[0] * 10 + nib(1)[1]
  const day = nib(2)[0] * 10 + nib(2)[1]
  const hour = nib(3)[0] * 10 + nib(3)[1]
  const minute = nib(4)[0] * 10 + nib(4)[1]
  const second = nib(5)[0] * 10 + nib(5)[1]

  // Latitude: 4 bytes BCD DDMM.MMMM — nibbles: [DD][MM][MMMM]
  const latNib = getNibbles(data, 6, 4)
  const latDeg = latNib[0] * 10 + latNib[1]
  const latMin = (latNib[2] * 10 + latNib[3]) + (latNib[4] * 1000 + latNib[5] * 100 + latNib[6] * 10 + latNib[7]) / 10000
  const latitude = latDeg + latMin / 60

  // Longitude: 4 bytes BCD DDDMM.MMMM — nibbles: [DDD][MM][MMMM] (uses 8 nibbles but degrees are 3 digits)
  const lngNib = getNibbles(data, 10, 4)
  const lngDeg = lngNib[0] * 100 + lngNib[1] * 10 + lngNib[2]
  const lngMin = (lngNib[3] * 10 + lngNib[4]) + (lngNib[5] * 1000 + lngNib[6] * 100 + lngNib[7] * 10) / 10000
  const longitude = lngDeg + lngMin / 60

  const speedKnots = data[14]
  const speed = speedKnots ? Math.round(speedKnots * 1.151 * 100) / 100 : undefined

  const courseStatus = data.readUInt16BE(15)
  const bearing = courseStatus & 0x3ff
  const gpsFix = !!(courseStatus & 0x1000)

  if (!gpsFix || latitude === 0 || longitude === 0) return null

  const ts = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  if (isNaN(ts.getTime())) return null

  return { latitude, longitude, speed, bearing, timestamp: ts.toISOString() }
}
