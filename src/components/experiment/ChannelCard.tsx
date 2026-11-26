import { useState, type FormEvent } from 'react'
import { useMutations, type RecordData } from 'deepspace'
import { Button, ConfirmModal, Input, Label } from '@/components/ui'
import { runAction } from '@/lib/actions'
import { clickRate, outcomeRate, parseCount } from '@/lib/stats'
import type { Variant } from '@/schemas/variants-schema'

type Props = {
  variant: RecordData<Variant>
  clicks: number
  canDelete: boolean
}

export function ChannelCard({ variant, clicks, canDelete }: Props) {
  const v = variant.data
  const link = `${window.location.origin}/go/${v.slug}`
  const reach = typeof v.reach === 'number' ? v.reach : null
  const outcomes = typeof v.outcomeCount === 'number' ? v.outcomeCount : 0

  return (
    <li data-testid="variant-row" data-channel={v.channelName} className="rounded-lg border border-border bg-card p-4">
      <ChannelName variant={variant} />
      <LinkRow link={link} channel={v.channelName} />

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="Clicks (approx.)" value={String(clicks)} testId="click-count" />
        <Stat label="Outcomes" value={String(outcomes)} />
        <Stat label="Clicks per reach" value={clickRate(clicks, reach)} testId="click-rate" />
        <Stat label="Outcomes per click" value={outcomeRate(outcomes, clicks, reach)} testId="outcome-rate" />
      </dl>

      <ManualFields variant={variant} />
      <DeleteChannel variant={variant} clicks={clicks} canDelete={canDelete} />
    </li>
  )
}

function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums" data-testid={testId}>{value}</dd>
    </div>
  )
}

function ChannelName({ variant }: { variant: RecordData<Variant> }) {
  const { ready, putConfirmed } = useMutations<Variant>('variants')
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(variant.data.channelName)
  const [problem, setProblem] = useState<string | null>(null)

  async function save(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setProblem('The channel needs a name.')
    try {
      await putConfirmed(variant.recordId, { channelName: trimmed })
      setEditing(false)
      setProblem(null)
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Could not rename the channel.')
    }
  }

  if (!editing)
    return (
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium" data-testid="channel-name">{variant.data.channelName}</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setName(variant.data.channelName); setEditing(true) }}>
          Rename
        </Button>
      </div>
    )

  return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-2">
      <Input aria-label="New channel name" value={name} onChange={(e) => setName(e.target.value)} className="min-w-40 flex-1" autoFocus />
      <Button type="submit" size="sm" disabled={!ready}>Save name</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(false); setProblem(null) }}>Cancel</Button>
      {problem && <p role="alert" className="w-full text-xs text-destructive">{problem}</p>}
    </form>
  )
}

function LinkRow({ link, channel }: { link: string; channel: string }) {
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null)
  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied('yes')
    } catch {
      setCopied('failed')
    }
    setTimeout(() => setCopied(null), 2000)
  }
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input readOnly value={link} aria-label={`Tracked link for ${channel}`} data-testid="tracked-link" className="min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <Button type="button" variant="outline" size="sm" onClick={copy}>{copied === 'yes' ? 'Copied' : 'Copy link'}</Button>
      </div>
      {copied === 'failed' && <p className="mt-2 text-xs text-muted-foreground">Copy failed. Select the link and copy it by hand.</p>}
    </>
  )
}

/** Reach, outcome count and outcome label, entered by hand. */
function ManualFields({ variant }: { variant: RecordData<Variant> }) {
  const { ready, putConfirmed } = useMutations<Variant>('variants')
  const v = variant.data
  const [reach, setReach] = useState(typeof v.reach === 'number' ? String(v.reach) : '')
  const [outcomeCount, setOutcomeCount] = useState(String(v.outcomeCount ?? 0))
  const [outcomeLabel, setOutcomeLabel] = useState(v.outcomeLabel ?? '')
  const [state, setState] = useState<{ kind: 'idle' | 'saving' | 'saved' } | { kind: 'error'; message: string }>({ kind: 'idle' })

  async function save(event: FormEvent) {
    event.preventDefault()
    const r = parseCount(reach)
    const o = parseCount(outcomeCount)
    if (!r.ok) return setState({ kind: 'error', message: 'Reach must be a whole number, or blank.' })
    if (!o.ok) return setState({ kind: 'error', message: 'Outcome count must be a whole number.' })
    setState({ kind: 'saving' })
    try {
      await putConfirmed(variant.recordId, { reach: r.value, outcomeCount: o.value ?? 0, outcomeLabel: outcomeLabel.trim() })
      setState({ kind: 'saved' })
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : 'Could not save.' })
    }
  }

  const id = variant.recordId
  return (
    <form onSubmit={save} className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end" noValidate>
      <div className="space-y-1">
        <Label htmlFor={`reach-${id}`}>Reach</Label>
        <Input id={`reach-${id}`} inputMode="numeric" placeholder="People who could see it" value={reach} onChange={(e) => setReach(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`outcomes-${id}`}>Outcome count</Label>
        <Input id={`outcomes-${id}`} inputMode="numeric" value={outcomeCount} onChange={(e) => setOutcomeCount(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`label-${id}`}>Outcome label</Label>
        <Input id={`label-${id}`} placeholder="Signups" value={outcomeLabel} onChange={(e) => setOutcomeLabel(e.target.value)} />
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={!ready || state.kind === 'saving'}>
        {state.kind === 'saving' ? 'Saving…' : 'Save'}
      </Button>
      {state.kind === 'saved' && <p className="text-xs text-muted-foreground sm:col-span-4" role="status">Saved.</p>}
      {state.kind === 'error' && <p className="text-xs text-destructive sm:col-span-4" role="alert">{state.message}</p>}
    </form>
  )
}

function DeleteChannel({ variant, clicks, canDelete }: { variant: RecordData<Variant>; clicks: number; canDelete: boolean }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    const result = await runAction('deleteChannel', { variantId: variant.recordId })
    setBusy(false)
    setOpen(false)
    if (!result.success) setProblem(result.error)
  }

  const reason = clicks > 0 ? 'Channels with clicks cannot be deleted, so their click data is kept.' : !canDelete ? 'Keep at least 2 channels.' : null
  return (
    <div className="mt-3 text-right">
      <Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={reason !== null} title={reason ?? undefined} onClick={() => setOpen(true)}>
        Delete channel
      </Button>
      {reason && <p className="mt-1 text-xs text-muted-foreground">{reason}</p>}
      {problem && <p role="alert" className="mt-1 text-xs text-destructive">{problem}</p>}
      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        loading={busy}
        title={`Delete "${variant.data.channelName}"?`}
        description="Its tracked link will stop working. This cannot be undone."
        confirmText="Delete channel"
      />
    </div>
  )
}
