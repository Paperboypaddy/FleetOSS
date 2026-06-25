import { describe, it, expect } from 'vitest'
import { parsePagination, paginatedResponse } from './pagination.js'

describe('parsePagination', () => {
  it('returns defaults for empty query', () => {
    const r = parsePagination({})
    expect(r.page).toBe(1)
    expect(r.limit).toBe(20)
    expect(r.offset).toBe(0)
  })

  it('parses page and limit', () => {
    const r = parsePagination({ page: '3', limit: '50' })
    expect(r.page).toBe(3)
    expect(r.limit).toBe(50)
    expect(r.offset).toBe(100)
  })

  it('caps limit at 1000', () => {
    const r = parsePagination({ limit: '9999' })
    expect(r.limit).toBe(1000)
  })

  it('ensures minimum page of 1', () => {
    const r = parsePagination({ page: '0' })
    expect(r.page).toBe(1)
  })

  it('handles invalid values', () => {
    const r = parsePagination({ page: 'abc', limit: 'xyz' })
    expect(r.page).toBe(1)
    expect(r.limit).toBe(20)
  })
})

describe('paginatedResponse', () => {
  it('returns correct format with hasMore', () => {
    const items = [{ id: 1 }, { id: 2 }]
    const r = paginatedResponse(items, 10, 1, 5)
    expect(r.data).toEqual(items)
    expect(r.total).toBe(10)
    expect(r.page).toBe(1)
    expect(r.limit).toBe(5)
    expect(r.hasMore).toBe(true)
  })

  it('hasMore false on last page', () => {
    const r = paginatedResponse([], 5, 1, 5)
    expect(r.hasMore).toBe(false)
  })
})
