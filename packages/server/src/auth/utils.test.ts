import { describe, it, expect } from 'vitest'
import { signToken, verifyToken } from './utils.js'

describe('auth utils', () => {
  it('signs and verifies valid token', () => {
    const token = signToken('user-1', 'test@example.com', 'admin')
    const payload = verifyToken(token)
    expect(payload).not.toBeNull()
    expect(payload!.sub).toBe('user-1')
    expect(payload!.email).toBe('test@example.com')
    expect(payload!.role).toBe('admin')
  })

  it('returns null for invalid token', () => {
    expect(verifyToken('invalid')).toBeNull()
  })

  it('returns null for tampered token', () => {
    const token = signToken('user-1', 'test@example.com', 'admin')
    const tampered = token.slice(0, -5) + 'XXXXX'
    expect(verifyToken(tampered)).toBeNull()
  })
})
