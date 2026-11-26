import type { ReactNode } from 'react'

/** Shared loading and error panels for the experiment screens. */
export function LoadingPanel({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="py-16 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}

export function ErrorPanel({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-5 text-sm">
      <p className="font-medium text-foreground">{title}</p>
      {detail && <p className="mt-1 text-muted-foreground">{detail}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
