import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutations, useQuery } from 'deepspace'
import { Badge, Button, Input, Label } from '@/components/ui'
import { ErrorPanel, LoadingPanel } from '@/components/StatusPanel'
import type { Experiment } from '@/schemas/experiments-schema'
import { MAX_VARIANTS, MIN_VARIANTS, newSlug, type Variant } from '@/schemas/variants-schema'

function trackedLink(slug: string): string {
  return `${window.location.origin}/go/${slug}`
}

export default function ExperimentPage() {
  const { id = '' } = useParams()
  // Permissions return only the signed-in user's rows, so someone else's id is "not found".
  const experiments = useQuery<Experiment>('experiments')
  const variants = useQuery<Variant>('variants', {
    where: { experimentId: id },
    orderBy: 'createdAt',
    orderDir: 'asc',
  })
  const experiment = experiments.records.find((r) => r.recordId === id)

  if (experiments.status === 'loading') return <Shell><LoadingPanel label="Loading experiment…" /></Shell>
  if (experiments.status === 'error')
    return <Shell><ErrorPanel title="Could not load this experiment" detail={experiments.error} /></Shell>
  if (!experiment)
    return (
      <Shell>
        <ErrorPanel
          title="Experiment not found"
          detail="It may have been deleted, or it belongs to another account."
        />
      </Shell>
    )

  const e = experiment.data
  return (
    <Shell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 data-testid="experiment-title" className="text-2xl font-semibold tracking-tight">{e.title}</h1>
        {e.decision && e.decision !== 'none' && <Badge variant="secondary">{e.decision}</Badge>}
      </div>

      <dl className="mt-6 grid gap-4 rounded-lg border border-border bg-card p-5 text-sm sm:grid-cols-2">
        <Detail label="Hypothesis" value={e.hypothesis} />
        <Detail label="Audience" value={e.audience} />
        <Detail label="Success metric" value={e.successMetric} />
        <Detail label="Destination" value={e.destinationUrl} />
      </dl>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Channels</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add {MIN_VARIANTS} to {MAX_VARIANTS} channels. Each gets its own tracked link to your destination.
        </p>

        {variants.status === 'loading' && <LoadingPanel label="Loading channels…" />}
        {variants.status === 'error' && (
          <div className="mt-4"><ErrorPanel title="Could not load channels" detail={variants.error} /></div>
        )}
        {variants.status === 'ready' && (
          <>
            {variants.records.length === 0 ? (
              <p data-testid="variants-empty" className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No channels yet. Add your first one below.
              </p>
            ) : (
              <ul data-testid="variants-list" className="mt-4 space-y-3">
                {variants.records.map((v) => (
                  <VariantRow key={v.recordId} variant={v.data} />
                ))}
              </ul>
            )}
            {variants.records.length > 0 && variants.records.length < MIN_VARIANTS && (
              <p className="mt-3 text-sm text-muted-foreground">Add at least {MIN_VARIANTS} channels to compare them.</p>
            )}
            {variants.records.length < MAX_VARIANTS ? (
              <AddVariant experimentId={id} />
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">This experiment has the maximum of {MAX_VARIANTS} channels.</p>
            )}
          </>
        )}
      </section>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 text-foreground">
      <Link to="/experiments" className="text-sm text-muted-foreground hover:text-foreground">
        ← My experiments
      </Link>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words">{value || '—'}</dd>
    </div>
  )
}

function VariantRow({ variant }: { variant: Variant }) {
  const link = trackedLink(variant.slug)
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
    <li data-testid="variant-row" className="rounded-lg border border-border bg-card p-4">
      <p className="font-medium">{variant.channelName}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input readOnly value={link} aria-label={`Tracked link for ${variant.channelName}`} data-testid="tracked-link" className="min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied === 'yes' ? 'Copied' : 'Copy link'}
        </Button>
      </div>
      {copied === 'failed' && (
        <p className="mt-2 text-xs text-muted-foreground">Copy failed. Select the link and copy it by hand.</p>
      )}
    </li>
  )
}

function AddVariant({ experimentId }: { experimentId: string }) {
  const { ready, createConfirmed } = useMutations<Variant>('variants')
  const [channelName, setChannelName] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const name = channelName.trim()
    if (!name) return setProblem('Name the channel, for example LinkedIn or Newsletter.')
    setProblem(null)
    setSaving(true)
    // A new random slug is tried if one is already taken (very unlikely).
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await createConfirmed({ experimentId, channelName: name, slug: newSlug(), outcomeCount: 0, outcomeLabel: '' })
        setChannelName('')
        setSaving(false)
        return
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!message.includes('Duplicate') || attempt === 3) {
          setProblem(`The channel could not be added. ${message}`)
          setSaving(false)
          return
        }
      }
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 flex flex-wrap items-end gap-3" noValidate>
      <div className="min-w-48 flex-1 space-y-2">
        <Label htmlFor="channelName">Channel name</Label>
        <Input id="channelName" value={channelName} placeholder="LinkedIn" onChange={(e) => setChannelName(e.target.value)} />
      </div>
      <Button type="submit" disabled={!ready || saving}>
        {saving ? 'Adding…' : 'Add channel'}
      </Button>
      {problem && <div className="w-full"><ErrorPanel title={problem} /></div>}
    </form>
  )
}
