import { describe, it, expect, beforeAll } from 'vitest'
import { config } from './index.js'

describe('config values', () => {
  it('has required config fields', () => {
    expect(config.port).toBeGreaterThan(0)
    expect(config.port).toBeLessThan(65536)
    expect(config.host).toBeTruthy()
    expect(config.jwtSecret).toBeTruthy()
    expect(config.jwtExpiresIn).toBeTruthy()
  })

  it('has a valid database URL', () => {
    expect(config.databaseUrl).toMatch(/^postgres:\/\//)
  })
})
