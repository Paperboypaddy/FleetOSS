import { describe, it, expect } from 'vitest'
import { haversineMi, bearing, speedColor, secToMMSS, addMins, buildCumDist } from './math'

describe('haversineMi', () => {
  it('returns 0 for same point', () => {
    expect(haversineMi([47.7, -116.9], [47.7, -116.9])).toBe(0)
  })

  it('calculates Chicago to NYC ~790mi', () => {
    const d = haversineMi([41.8781, -87.6298], [40.7128, -74.006])
    expect(d).toBeGreaterThan(700)
    expect(d).toBeLessThan(850)
  })
})

describe('bearing', () => {
  it('returns N for northward', () => {
    expect(bearing([40, -74], [41, -74])).toBe('N')
  })

  it('returns NE for northeast', () => {
    expect(bearing([40, -74], [41, -73])).toBe('NE')
  })
})

describe('speedColor', () => {
  it('green for low speed', () => expect(speedColor(25)).toBe('#10B981'))
  it('yellow for medium speed', () => expect(speedColor(50)).toBe('#F59E0B'))
  it('red for high speed', () => expect(speedColor(65)).toBe('#EF4444'))
})

describe('secToMMSS', () => {
  it('converts seconds', () => {
    expect(secToMMSS(125)).toBe('2:05')
    expect(secToMMSS(0)).toBe('0:00')
    expect(secToMMSS(3600)).toBe('60:00')
  })
})

describe('addMins', () => {
  it('adds minutes to time string', () => {
    expect(addMins('9:00', 90)).toBe('10:30 AM')
    expect(addMins('11:30', 45)).toBe('12:15 PM')
  })
})

describe('buildCumDist', () => {
  it('zero for single point', () => expect(buildCumDist([[47.7, -116.9]])).toEqual([0]))
  it('builds cumulative', () => {
    const cum = buildCumDist([[40, -74], [40.5, -74], [41, -74]])
    expect(cum[0]).toBe(0)
    expect(cum[1]).toBeGreaterThan(0)
    expect(cum[2]).toBeGreaterThan(cum[1])
  })
})
