import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from 'deepspace'
import { Button, Input, Label, Textarea } from '@/components/ui'
import { ErrorPanel } from '@/components/StatusPanel'
import { isHttpUrl } from '@/schemas/experiments-schema'
import { runAction } from '@/lib/actions'

const FIELDS = [
  { name: 'title', label: 'Title', placeholder: 'Founder-led posts vs paid ads', long: false },
  { name: 'hypothesis', label: 'Hypothesis', placeholder: 'Founder posts get more signups per click', long: true },
  { name: 'audience', label: 'Audience', placeholder: 'Seed-stage SaaS founders', long: false },
  { name: 'successMetric', label: 'Success metric', placeholder: 'Signups per 100 clicks', long: false },
  { name: 'destinationUrl', label: 'Destination URL', placeholder: 'https://example.com/landing', long: false },
] as const

type FieldName = (typeof FIELDS)[number]['name']

export default function NewExperimentPage() {
  const navigate = useNavigate()
  const { isSignedIn } = useAuth()
  const ready = Boolean(isSignedIn)
  const [values, setValues] = useState<Record<FieldName, string>>({
    title: '',
    hypothesis: '',
    audience: '',
    successMetric: '',
    destinationUrl: '',
  })
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const title = values.title.trim()
    const destinationUrl = values.destinationUrl.trim()
    if (!title) return setProblem('Give the experiment a title.')
    if (!isHttpUrl(destinationUrl)) return setProblem('The destination must be a full http:// or https:// link.')

    setProblem(null)
    setSaving(true)
    // The server validates again and stamps you as the owner.
    const result = await runAction('createExperiment', {
      title,
      hypothesis: values.hypothesis.trim(),
      audience: values.audience.trim(),
      successMetric: values.successMetric.trim(),
      destinationUrl,
    })
    if (!result.success) {
      setProblem(result.error)
      setSaving(false)
      return
    }
    navigate(`/experiments/${result.data.recordId}`)
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 text-foreground">
      <Link to="/experiments" className="text-sm text-muted-foreground hover:text-foreground">
        ← My experiments
      </Link>
      <h1 className="mb-8 mt-3 text-2xl font-semibold tracking-tight">New experiment</h1>

      <form onSubmit={submit} className="space-y-5" noValidate>
        {FIELDS.map((field) => (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {(field.name === 'title' || field.name === 'destinationUrl') && (
                <span className="text-muted-foreground"> (required)</span>
              )}
            </Label>
            {field.long ? (
              <Textarea
                id={field.name}
                value={values[field.name]}
                placeholder={field.placeholder}
                onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
              />
            ) : (
              <Input
                id={field.name}
                type={field.name === 'destinationUrl' ? 'url' : 'text'}
                value={values[field.name]}
                placeholder={field.placeholder}
                onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
              />
            )}
          </div>
        ))}

        {problem && <ErrorPanel title={problem} />}

        <Button type="submit" disabled={!ready || saving}>
          {saving ? 'Saving…' : ready ? 'Create experiment' : 'Connecting…'}
        </Button>
      </form>
    </div>
  )
}
