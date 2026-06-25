import { describe, it, expect } from 'vitest'
import { parseTraccarParams } from './traccar.js'

describe('parseTraccarParams', () => {
  it('parses basic position', () => {
    const r = parseTraccarParams({ id: 'test-001', lat: '47.718', lon: '-116.945' })
    expect(r.deviceId).toBe('test-001')
    expect(r.latitude).toBeCloseTo(47.718)
    expect(r.longitude).toBeCloseTo(-116.945)
  })

  it('converts knots to mph', () => {
    const r = parseTraccarParams({ id: 't1', lat: '0', lon: '0', speed: '10' })
    expect(r.speed).toBeCloseTo(11.51, 1)
  })

  it('parses battery level', () => {
    const r = parseTraccarParams({ id: 't1', lat: '0', lon: '0', batt: '85' })
    expect(r.batteryLevel).toBe(85)
  })

  it('parses ignition as boolean', () => {
    expect(parseTraccarParams({ id: 't1', lat: '0', lon: '0', ignition: 'true' }).ignition).toBe(true)
    expect(parseTraccarParams({ id: 't1', lat: '0', lon: '0', ignition: 'false' }).ignition).toBe(false)
    expect(parseTraccarParams({ id: 't1', lat: '0', lon: '0', ignition: '1' }).ignition).toBe(true)
  })

  it('throws on invalid coordinates', () => {
    expect(() => parseTraccarParams({ id: 't1', lat: 'abc', lon: 'def' })).toThrow('Invalid coordinates')
  })

  it('parses optional fields', () => {
    const r = parseTraccarParams({
      id: 't1', lat: '10', lon: '20',
      bearing: '180', altitude: '100', accuracy: '5',
      odometer: '50000', fuel: '50',
    })
    expect(r.bearing).toBe(180)
    expect(r.altitude).toBe(100)
    expect(r.accuracy).toBe(5)
    expect(r.odometer).toBe(50000)
    expect(r.fuelLevel).toBe(50)
  })

  it('includes event and course in attributes', () => {
    const r = parseTraccarParams({ id: 't1', lat: '0', lon: '0', event: 'sos', course: '270' })
    expect(r.attributes).toEqual({ event: 'sos', course: '270' })
  })
})
