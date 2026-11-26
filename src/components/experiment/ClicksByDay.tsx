import { clicksPerDay } from '@/lib/stats'

/** Simple bar list of clicks per UTC day for the last 14 days. */
export function ClicksByDay({ clicks }: { clicks: { clickedAt: string }[] }) {
  const days = clicksPerDay(clicks, 14)
  const max = Math.max(1, ...days.map((d) => d.count))
  return (
    <div data-testid="clicks-by-day" className="rounded-lg border border-border bg-card p-5">
      <h3 className="font-semibold">Clicks per day</h3>
      <p className="mt-1 text-xs text-muted-foreground">Last 14 days, UTC.</p>
      <ol className="mt-4 space-y-1">
        {days.map((d) => (
          <li key={d.day} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-2 text-xs">
            <span className="tabular-nums text-muted-foreground">{d.day.slice(5)}</span>
            <span className="h-2 rounded-sm bg-secondary">
              <span className="block h-2 rounded-sm bg-primary" style={{ width: `${(d.count / max) * 100}%` }} />
            </span>
            <span className="text-right tabular-nums">{d.count}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
