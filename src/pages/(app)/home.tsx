/**
 * /home is where sign-in lands. Signed-in users go straight to their
 * experiments; signed-out visitors see a short pointer instead of a blank page.
 */

import { Link, Navigate } from 'react-router-dom'
import { useAuth } from 'deepspace'
import { LoadingPanel } from '@/components/StatusPanel'

export default function HomePage() {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) return <LoadingPanel label="Loading…" />
  if (isSignedIn) return <Navigate to="/experiments" replace />

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 py-16 text-center text-foreground">
      <h1 className="text-2xl font-semibold">Channel Lab</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Sign in to see your experiments and their tracked links.
      </p>
      <Link to="/experiments" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Sign in
      </Link>
    </div>
  )
}
