import { useEffect, useState } from 'react'
import { Button } from '@/components/ui'
import { runAction } from '@/lib/actions'
import type { ReadoutData } from '@/lib/readout'

type Readout = { memo: string; data: ReadoutData; model: string; used: number; limit: number }
type Settings = { enabled: boolean; userLimit: number; appLimit: number; offMessage: string }
type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'done'; readout: Readout }

/** "Generate readout": calls the generateReadout server action and shows the checked memo beside the numbers it used. */
export function ReadoutPanel({ experimentId, channelCount }: { experimentId: string; channelCount: number }) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  // Whether the owner has switched the readout on (it is off by default, to avoid cost).
  const [settings, setSettings] = useState<Settings | 'loading' | 'error'>('loading')
  useEffect(() => {
    let live = true
    runAction<Settings>('readoutSettings', {}).then((r) => live && setSettings(r.success ? r.data : 'error'))
    return () => {
      live = false
    }
  }, [])
  const off = settings !== 'loading' && (settings === 'error' || !settings.enabled)

  async function generate() {
    setState({ kind: 'loading' })
    const result = await runAction<Readout>('generateReadout', { experimentId })
    setState(result.success ? { kind: 'done', readout: result.data } : { kind: 'error', message: result.error })
  }

  const loading = state.kind === 'loading'
  return (
    <section data-testid="readout-panel" className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">AI readout</h2>
          <p className="text-xs text-muted-foreground">
            {typeof settings === 'object' ? `Up to ${settings.userLimit} per person per day (UTC). ` : ''}Uses only the numbers shown with it.
          </p>
        </div>
        <Button type="button" onClick={generate} disabled={loading || off || settings === 'loading' || channelCount === 0} aria-busy={loading}>
          {loading ? 'Generating…' : state.kind === 'done' ? 'Generate again' : 'Generate readout'}
        </Button>
      </div>

      {settings === 'error' && (
        <p role="alert" className="mt-3 text-sm text-muted-foreground">Could not check whether the AI readout is on. Reload the page to try again.</p>
      )}
      {typeof settings === 'object' && !settings.enabled && (
        <p data-testid="readout-off" className="mt-3 rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground">{settings.offMessage}</p>
      )}
      {channelCount === 0 && <p className="mt-3 text-sm text-muted-foreground">Add a channel first.</p>}
      {loading && <p role="status" className="mt-4 text-sm text-muted-foreground">Writing the readout. This can take a few seconds…</p>}

      {state.kind === 'error' && (
        <div role="alert" data-testid="readout-error" className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">No readout this time</p>
          <p className="mt-1 text-muted-foreground">{state.message}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={generate}>Try again</Button>
        </div>
      )}

      {state.kind === 'done' && (
        <div className="mt-4 grid gap-4 md:grid-cols-[3fr_2fr]">
          <div>
            <p data-testid="readout-memo" className="whitespace-pre-line text-sm leading-relaxed">{state.readout.memo}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              Every number above was checked against the table. Click counts are approximate. Readout {state.readout.used} of {state.readout.limit} today.
            </p>
          </div>
          <NumbersUsed data={state.readout.data} />
        </div>
      )}
    </section>
  )
}

function NumbersUsed({ data }: { data: ReadoutData }) {
  return (
    <div data-testid="readout-numbers" className="rounded-md bg-secondary p-3 text-xs">
      <p className="mb-2 font-medium">Numbers sent to the AI</p>
      <table className="w-full tabular-nums">
        <thead className="text-left text-muted-foreground">
          <tr><th className="font-normal">Channel</th><th className="font-normal">Clicks</th><th className="font-normal">Reach</th><th className="font-normal">Outcomes</th></tr>
        </thead>
        <tbody>
          {data.channels.map((c) => (
            <tr key={c.channel}>
              <td className="pr-2">{c.channel}</td>
              <td>{c.clicks}</td>
              <td>{c.reach ?? 'n/a'}</td>
              <td>{c.outcomeCount}{c.outcomeLabel ? ` ${c.outcomeLabel}` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2"><span className="text-muted-foreground">Success metric:</span> {data.successMetric || '—'}</p>
      <p><span className="text-muted-foreground">Hypothesis:</span> {data.hypothesis || '—'}</p>
    </div>
  )
}
