import { describe, expect, it } from 'vitest'
import { clickRate, clicksPerDay, countByVariant, outcomeRate, parseCount } from './stats'

describe('rates', () => {
  it('clicks per reach needs reach', () => {
    expect(clickRate(5, 200)).toBe('2.5%')
    expect(clickRate(50, 200)).toBe('25%')
    expect(clickRate(5, null)).toBe('n/a')
    expect(clickRate(5, undefined)).toBe('n/a')
    expect(clickRate(5, 0)).toBe('n/a')
  })

  it('outcomes per click needs reach and clicks', () => {
    expect(outcomeRate(2, 40, 1000)).toBe('5.0%')
    expect(outcomeRate(2, 40, null)).toBe('n/a')
    expect(outcomeRate(2, 0, 1000)).toBe('n/a')
  })
})

describe('counts', () => {
  it('counts clicks per variant', () => {
    const m = countByVariant([{ variant: 'a' }, { variant: 'b' }, { variant: 'a' }])
    expect(m.get('a')).toBe(2)
    expect(m.get('b')).toBe(1)
    expect(m.get('c')).toBeUndefined()
  })

  it('groups clicks by UTC day, including empty days', () => {
    const now = new Date('2026-11-25T03:00:00Z')
    const days = clicksPerDay(
      [
        { clickedAt: '2026-11-25T01:00:00.000Z' },
        { clickedAt: '2026-11-24T23:59:00.000Z' },
        { clickedAt: '2026-11-24T00:00:00.000Z' },
        { clickedAt: '2026-10-01T00:00:00.000Z' },
      ],
      3,
      now,
    )
    expect(days).toEqual([
      { day: '2026-11-23', count: 0 },
      { day: '2026-11-24', count: 2 },
      { day: '2026-11-25', count: 1 },
    ])
  })
})

describe('parseCount', () => {
  it('accepts blank and whole numbers only', () => {
    expect(parseCount('')).toEqual({ ok: true, value: null })
    expect(parseCount(' 42 ')).toEqual({ ok: true, value: 42 })
    for (const bad of ['-1', '1.5', 'ten', '1e3']) expect(parseCount(bad)).toEqual({ ok: false })
  })
})
