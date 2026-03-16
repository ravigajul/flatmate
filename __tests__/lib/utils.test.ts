import { describe, it, expect } from 'vitest'
import { cn, formatCurrency, formatDate, getClientIp } from '@/lib/utils'

describe('cn (class merging)', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-2')).toBe('px-2 py-2')
  })

  it('handles conditional classes', () => {
    const active = true
    const result = cn('base', active && 'active')
    expect(result).toContain('base')
    expect(result).toContain('active')
  })

  it('deduplicates conflicting tailwind classes (last wins)', () => {
    // tailwind-merge keeps the last conflicting utility
    const result = cn('px-2', 'px-4')
    expect(result).toBe('px-4')
  })

  it('handles undefined/null/false gracefully', () => {
    const result = cn('base', undefined, null, false, 'extra')
    expect(result).toBe('base extra')
  })

  it('returns empty string with no args', () => {
    expect(cn()).toBe('')
  })
})

describe('formatCurrency', () => {
  it('formats a round number in INR', () => {
    const result = formatCurrency(1000)
    // Should contain the numeric value
    expect(result).toContain('1,000')
  })

  it('formats zero', () => {
    const result = formatCurrency(0)
    expect(result).toBeTruthy()
    expect(result).toContain('0')
  })

  it('formats large amounts', () => {
    const result = formatCurrency(100000)
    expect(result).toContain('1,00,000')
  })

  it('omits decimal digits (maximumFractionDigits: 0)', () => {
    const result = formatCurrency(1500.75)
    // Should round and not show .75
    expect(result).not.toContain('.75')
  })

  it('returns a string', () => {
    expect(typeof formatCurrency(5000)).toBe('string')
  })
})

describe('formatDate', () => {
  it('formats a Date object', () => {
    // Use a fixed date to avoid timezone variance
    const date = new Date('2024-01-15T00:00:00.000Z')
    const result = formatDate(date)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('formats a date string', () => {
    const result = formatDate('2024-06-20')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('includes the year', () => {
    const result = formatDate(new Date('2023-03-10'))
    expect(result).toContain('2023')
  })

  it('includes a month abbreviation', () => {
    const result = formatDate(new Date('2024-01-15'))
    // Should contain Jan or similar
    expect(result).toMatch(/[A-Za-z]/)
  })
})

describe('getClientIp', () => {
  function makeRequest(headers: Record<string, string>): Request {
    return new Request('http://localhost:3000/', { headers })
  }

  it('returns x-forwarded-for first IP when present', () => {
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.1, 10.0.0.1' })
    expect(getClientIp(req)).toBe('203.0.113.1')
  })

  it('trims whitespace from x-forwarded-for', () => {
    const req = makeRequest({ 'x-forwarded-for': '  203.0.113.5 , 10.0.0.2' })
    expect(getClientIp(req)).toBe('203.0.113.5')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = makeRequest({ 'x-real-ip': '198.51.100.42' })
    expect(getClientIp(req)).toBe('198.51.100.42')
  })

  it('returns "unknown" when no IP headers are present', () => {
    const req = makeRequest({})
    expect(getClientIp(req)).toBe('unknown')
  })

  it('prefers x-forwarded-for over x-real-ip', () => {
    const req = makeRequest({
      'x-forwarded-for': '203.0.113.1',
      'x-real-ip': '198.51.100.42',
    })
    expect(getClientIp(req)).toBe('203.0.113.1')
  })
})
