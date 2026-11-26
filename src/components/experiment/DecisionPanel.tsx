import { useState, type FormEvent } from 'react'
import { Button, Label, Textarea } from '@/components/ui'
import { runAction } from '@/lib/actions'
import type { Decision } from '@/schemas/experiments-schema'

const CHOICES: { value: Decision; label: string }[] = [
  { value: 'keep', label: 'Keep' },
  { value: 'change', label: 'Change' },
  { value: 'stop', label: 'Stop' },
  { value: 'none', label: 'Undecided' },
]

/** Saves the decision through the setDecision server action, which checks the value. */
export function DecisionPanel({ experimentId, decision, reason }: { experimentId: string; decision: Decision; reason: string }) {
  const [choice, setChoice] = useState<Decision>(decision || 'none')
  const [text, setText] = useState(reason ?? '')
  const [state, setState] = useState<{ kind: 'idle' | 'saving' | 'saved' } | { kind: 'error'; message: string }>({ kind: 'idle' })

  async function save(event: FormEvent) {
    event.preventDefault()
    if (text.trim().length > 500) return setState({ kind: 'error', message: 'Keep the reason under 500 characters.' })
    setState({ kind: 'saving' })
    const result = await runAction('setDecision', { experimentId, decision: choice, reason: text })
    setState(result.success ? { kind: 'saved' } : { kind: 'error', message: result.error })
  }

  return (
    <form onSubmit={save} className="rounded-lg border border-border bg-card p-5" noValidate>
      <fieldset>
        <legend className="text-lg font-semibold">Decision</legend>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Decision">
          {CHOICES.map((c) => (
            <label
              key={c.value}
              className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${choice === c.value ? 'border-primary bg-primary/10 font-medium' : 'border-border'}`}
            >
              <input type="radio" name="decision" value={c.value} checked={choice === c.value} onChange={() => setChoice(c.value)} className="sr-only" />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-4 space-y-2">
        <Label htmlFor="decisionReason">Reason</Label>
        <Textarea id="decisionReason" value={text} maxLength={500} placeholder="Why keep, change or stop?" onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" disabled={state.kind === 'saving'}>{state.kind === 'saving' ? 'Saving…' : 'Save decision'}</Button>
        {state.kind === 'saved' && <span role="status" className="text-sm text-muted-foreground">Decision saved.</span>}
        {state.kind === 'error' && <span role="alert" className="text-sm text-destructive">{state.message}</span>}
      </div>
    </form>
  )
}
