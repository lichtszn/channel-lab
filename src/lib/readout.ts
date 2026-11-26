/**
 * Pure helpers for the AI readout: what we send, how we ask, and how we check
 * the answer. No I/O here, so all of it is unit-tested.
 */

export type ReadoutChannel = {
  channel: string
  clicks: number
  /** null when reach was not entered. */
  reach: number | null
  outcomeCount: number
  outcomeLabel: string
}

export type ReadoutData = {
  hypothesis: string
  successMetric: string
  channels: ReadoutChannel[]
}

export const READOUT_SYSTEM_PROMPT = [
  'You write short go-to-market experiment readouts for a small team.',
  'Use ONLY the data in the user message. Never invent, round, estimate or compute numbers:',
  'no percentages, ratios, differences, totals or sums. Quote numbers exactly as given, as digits.',
  'Write no other numbers at all: no dates, list numbering, counts of things or numbers spelled with digits.',
  'Write about 120 to 180 words of plain prose with no headings or lists, covering:',
  '1. Which channel is leading and why, quoting the exact numbers you used.',
  '2. That click counts are approximate and the sample is small.',
  '3. That this is not statistically significant and does not prove one channel is better.',
  '4. One concrete next test to run.',
  'If reach is null it was not entered; say so rather than guessing.',
].join('\n')

export function buildUserMessage(data: ReadoutData): string {
  return `Experiment data (JSON):\n${JSON.stringify(data, null, 2)}`
}

/** Every number written with digits in a text, as numbers ("1,200" is 1200, "4.5" is 4.5). */
export function numbersIn(text: string): number[] {
  const matches = text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []
  return matches
    .map((m) => m.replace(/,(?=\d{3}(\D|$))/g, '').replace(/,$/, ''))
    .map(Number)
    .filter((n) => Number.isFinite(n))
}

/** Numbers that may appear in the memo: every number in the data we sent, including inside text fields. */
export function allowedNumbers(data: ReadoutData): Set<number> {
  return new Set(numbersIn(JSON.stringify(data)))
}

/** True when the text claims significance without negating it nearby. */
export function claimsSignificance(text: string): boolean {
  const re = /significan/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 60), m.index).toLowerCase()
    if (!/\b(not|no|isn't|aren't|cannot|can't|without|nor)\b/.test(before)) return true
  }
  return false
}

export type MemoCheck = { ok: true } | { ok: false; problems: string[] }

/** Rejects a memo that uses a number we did not send, or that misses the required caveats. */
export function checkMemo(memo: string, data: ReadoutData): MemoCheck {
  const problems: string[] = []
  const allowed = allowedNumbers(data)
  const unknown = [...new Set(numbersIn(memo).filter((n) => !allowed.has(n)))]
  if (unknown.length) problems.push(`it used numbers that are not in your data: ${unknown.join(', ')}`)
  if (!/approximate/i.test(memo)) problems.push('it did not say click counts are approximate')
  if (claimsSignificance(memo)) problems.push('it claimed statistical significance')
  if (!data.channels.some((c) => c.channel && memo.toLowerCase().includes(c.channel.toLowerCase())))
    problems.push('it did not name a channel')
  if (memo.trim().length < 40) problems.push('it was empty or too short')
  return problems.length ? { ok: false, problems } : { ok: true }
}

/** Pulls the text out of an Anthropic Messages-style response. */
export function memoText(response: unknown): string {
  if (!response || typeof response !== 'object') return ''
  const r = response as { content?: unknown; text?: unknown }
  if (Array.isArray(r.content)) {
    return r.content
      .map((block) => (block && typeof block === 'object' && (block as { type?: string }).type === 'text' ? String((block as { text?: unknown }).text ?? '') : ''))
      .join('')
      .trim()
  }
  return typeof r.text === 'string' ? r.text.trim() : ''
}

export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}
