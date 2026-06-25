import { describe, it, expect } from 'vitest'
import { parseHttpJson } from './http-json.js'

describe('parseHttpJson', () => {
  it('parses valid position', () => {
    const r = parseHttpJson({ deviceId: 'test-001', latitude: 47.718, longitude: -116.945, speed: 34 })
    expect(r.deviceId).toBe('test-001')
    expect(r.latitude).toBeCloseTo(47.718)
    expect(r.longitude).toBeCloseTo(-116.945)
    expect(r.speed).toBe(34)
  })

  it('accepts optional fields', () => {
    const r = parseHttpJson({ deviceId: 't1', latitude: 10, longitude: 20, altitude: 500, bearing: 90, batteryLevel: 80 })
    expect(r.altitude).toBe(500)
    expect(r.bearing).toBe(90)
    expect(r.batteryLevel).toBe(80)
  })

  it('rejects invalid latitude', () => {
    expect(() => parseHttpJson({ deviceId: 't1', latitude: 100, longitude: 0 })).toThrow()
  })

  it('rejects missing deviceId', () => {
    expect(() => parseHttpJson({ latitude: 0, longitude: 0 })).toThrow()
  })
})
