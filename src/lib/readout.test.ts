import { describe, expect, it } from 'vitest'
import { allowedNumbers, checkMemo, claimsSignificance, memoText, numbersIn, type ReadoutData } from './readout'

const data: ReadoutData = {
  hypothesis: 'Group chats beat LinkedIn for 18-24 year olds',
  successMetric: 'App opens',
  channels: [
    { channel: 'iMessage', clicks: 19, reach: 40, outcomeCount: 6, outcomeLabel: 'App opens' },
    { channel: 'Class Groupchat', clicks: 10, reach: null, outcomeCount: 2, outcomeLabel: 'App opens' },
    { channel: 'LinkedIn', clicks: 4, reach: 1200, outcomeCount: 0, outcomeLabel: '' },
  ],
}

const good =
  'iMessage is leading with 19 clicks from a reach of 40 and 6 app opens. Class Groupchat has 10 clicks and 2 app opens, ' +
  'but its reach was not entered. LinkedIn has 4 clicks from a reach of 1,200. Click counts are approximate and the sample is small, ' +
  'so this is not statistically significant. Next, test iMessage against Class Groupchat with reach entered for both.'

describe('numbersIn', () => {
  it('reads digits, thousands separators and decimals', () => {
    expect(numbersIn('19 clicks, 1,200 reach, 4.5 avg, 18-24 years')).toEqual([19, 1200, 4.5, 18, 24])
    expect(numbersIn('no digits here')).toEqual([])
  })
})

describe('allowedNumbers', () => {
  it('includes data values and numbers inside text fields', () => {
    const allowed = allowedNumbers(data)
    for (const n of [19, 40, 6, 10, 2, 4, 1200, 0, 18, 24]) expect(allowed.has(n)).toBe(true)
    expect(allowed.has(5)).toBe(false)
  })
})

describe('checkMemo', () => {
  it('accepts a memo that only quotes our numbers and has the caveats', () => {
    expect(checkMemo(good, data)).toEqual({ ok: true })
  })

  it.each([
    ['a computed percentage', good.replace('6 app opens.', '6 app opens (15%).'), '15'],
    ['a rounded number', good.replace('1,200', '1,000'), '1000'],
    ['an invented total', good + ' In total 33 clicks were recorded.', '33'],
    ['a date', good + ' Review on 2026-12-01.', '2026'],
  ])('rejects %s', (_label, memo, number) => {
    const r = checkMemo(memo, data)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problems[0]).toContain(number)
  })

  it('rejects missing caveats, significance claims, and memos that name no channel', () => {
    expect(checkMemo(good.replace('Click counts are approximate and the', 'The'), data).ok).toBe(false)
    expect(checkMemo(good.replace('not statistically significant', 'statistically significant'), data).ok).toBe(false)
    expect(checkMemo('Click counts are approximate. Results look promising overall, keep testing.', data).ok).toBe(false)
    expect(checkMemo('', data).ok).toBe(false)
  })
})

describe('claimsSignificance', () => {
  it('allows negated mentions only', () => {
    expect(claimsSignificance('This is not statistically significant.')).toBe(false)
    expect(claimsSignificance('No significance can be claimed.')).toBe(false)
    expect(claimsSignificance('The lift is statistically significant.')).toBe(true)
    expect(claimsSignificance('A significant win for iMessage.')).toBe(true)
  })
})

describe('memoText', () => {
  it('reads Anthropic-style content blocks', () => {
    expect(memoText({ content: [{ type: 'text', text: ' Hello ' }, { type: 'tool_use' }] })).toBe('Hello')
    expect(memoText({ text: 'plain' })).toBe('plain')
    expect(memoText(null)).toBe('')
  })
})
