import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { Badge, Button, EmptyState } from '@/components/ui'
import { ErrorPanel, LoadingPanel } from '@/components/StatusPanel'
import type { Experiment } from '@/schemas/experiments-schema'

export default function ExperimentsPage() {
  const navigate = useNavigate()
  // Permissions return only the signed-in user's own experiments.
  const { records, status, error } = useQuery<Experiment>('experiments', {
    orderBy: 'createdAt',
    orderDir: 'desc',
  })

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 text-foreground">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">My experiments</h1>
        <Button onClick={() => navigate('/experiments/new')}>New experiment</Button>
      </div>

      {status === 'loading' && <LoadingPanel label="Loading your experiments…" />}

      {status === 'error' && (
        <ErrorPanel
          title="Could not load your experiments"
          detail={error ?? 'The connection failed. Try reloading the page.'}
        />
      )}

      {status === 'ready' && records.length === 0 && (
        <EmptyState
          data-testid="experiments-empty"
          title="No experiments yet"
          description="Create one to get a tracked link for each channel you want to test."
          action={{ label: 'New experiment', onClick: () => navigate('/experiments/new') }}
        />
      )}

      {status === 'ready' && records.length > 0 && (
        <ul data-testid="experiments-list" className="divide-y divide-border rounded-lg border border-border bg-card">
          {records.map((r) => (
            <li key={r.recordId}>
              <Link
                to={`/experiments/${r.recordId}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-accent/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.data.title}</p>
                  {r.data.hypothesis && (
                    <p className="truncate text-sm text-muted-foreground">{r.data.hypothesis}</p>
                  )}
                </div>
                {r.data.decision && r.data.decision !== 'none' && (
                  <Badge variant="secondary">{r.data.decision}</Badge>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
