/** Pure helpers for the experiment page's numbers. No statistics beyond ratios. */

/** A ratio as a percentage string, or "n/a" when it cannot be computed. */
export function rate(numerator: number, denominator: number | null | undefined): string {
  if (denominator === null || denominator === undefined || !(denominator > 0)) return 'n/a'
  const pct = (numerator / denominator) * 100
  return `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`
}

/** Clicks per reach: shown only when reach was entered. */
export function clickRate(clicks: number, reach: number | null | undefined): string {
  return rate(clicks, reach)
}

/** Outcomes per click: only when reach was entered and there are clicks. */
export function outcomeRate(outcomes: number, clicks: number, reach: number | null | undefined): string {
  if (reach === null || reach === undefined) return 'n/a'
  return rate(outcomes, clicks)
}

/** Counts clicks per variant id. */
export function countByVariant(clicks: { variant: string }[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const c of clicks) counts.set(c.variant, (counts.get(c.variant) ?? 0) + 1)
  return counts
}

/** Clicks per UTC day for the last `days` days, oldest first, including empty days. */
export function clicksPerDay(
  clicks: { clickedAt: string }[],
  days: number,
  now: Date = new Date(),
): { day: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const c of clicks) {
    const day = typeof c.clickedAt === 'string' ? c.clickedAt.slice(0, 10) : ''
    if (day) counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  const out: { day: string; count: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
    const day = d.toISOString().slice(0, 10)
    out.push({ day, count: counts.get(day) ?? 0 })
  }
  return out
}

/** Parses a hand-entered whole number; '' means "not entered". */
export function parseCount(input: string): { ok: true; value: number | null } | { ok: false } {
  const trimmed = input.trim()
  if (trimmed === '') return { ok: true, value: null }
  if (!/^\d{1,12}$/.test(trimmed)) return { ok: false }
  return { ok: true, value: Number(trimmed) }
}
