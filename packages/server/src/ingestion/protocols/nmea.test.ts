import { describe, it, expect } from 'vitest'
import { parseNmeaSentence } from './nmea.js'

describe('parseNmeaSentence', () => {
  it('parses GPRMC with valid fix', () => {
    const r = parseNmeaSentence(
      '$GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A',
      'gps-001',
    )
    expect(r).not.toBeNull()
    expect(r!.deviceId).toBe('gps-001')
    expect(r!.latitude).toBeCloseTo(48.1173, 2)
    expect(r!.longitude).toBeCloseTo(11.5167, 2)
    expect(r!.speed).toBeCloseTo(25.78, 1)
    expect(r!.bearing).toBeCloseTo(84.4)
  })

  it('rejects GPRMC with invalid fix', () => {
    expect(parseNmeaSentence(
      '$GPRMC,123519,V,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A',
      'gps-001',
    )).toBeNull()
  })

  it('parses GPGGA', () => {
    const r = parseNmeaSentence(
      '$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47',
      'gps-001',
    )
    expect(r).not.toBeNull()
    expect(r!.latitude).toBeCloseTo(48.1173, 2)
    expect(r!.longitude).toBeCloseTo(11.5167, 2)
    expect(r!.altitude).toBeCloseTo(545.4)
  })

  it('rejects GPGGA without fix', () => {
    expect(parseNmeaSentence(
      '$GPGGA,123519,4807.038,N,01131.000,E,0,08,0.9,545.4,M,46.9,M,,*47',
      'gps-001',
    )).toBeNull()
  })

  it('parses GPGLL', () => {
    const r = parseNmeaSentence(
      '$GPGLL,4807.038,N,01131.000,E,123519,A*44',
      'gps-001',
    )
    expect(r).not.toBeNull()
    expect(r!.latitude).toBeCloseTo(48.1173, 2)
    expect(r!.longitude).toBeCloseTo(11.5167, 2)
  })

  it('returns null for non-NMEA strings', () => {
    expect(parseNmeaSentence('hello', 'gps-001')).toBeNull()
  })

  it('handles southern hemisphere', () => {
    const r = parseNmeaSentence(
      '$GPGGA,123519,3343.000,S,15122.000,E,1,08,0.9,20.0,M,,*00',
      'gps-001',
    )
    expect(r).not.toBeNull()
    expect(r!.latitude).toBeLessThan(0)
    expect(r!.latitude).toBeCloseTo(-33.7167, 2)
    expect(r!.longitude).toBeCloseTo(151.3667, 2)
  })
})
