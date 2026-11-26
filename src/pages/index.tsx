/**
 * Public landing page: a STATIC page with no auth call and no realtime
 * connection, prerendered to HTML at build so signed-out visitors and crawlers
 * always see real content.
 *
 * "Sign in" goes to /experiments, which is behind sign-in, so the sign-in
 * screen appears there.
 */

import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { seo } from '../seo'

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div
        data-testid="static-landing"
        className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      >
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Channel Lab
        </p>
        <h1 className="mb-5 max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Find out which channel actually works
        </h1>
        <p className="mb-8 max-w-lg text-muted-foreground">
          Channel Lab gives every go-to-market experiment a tracked link per channel and shows the
          clicks as they come in. Record what happened, get a readout, and decide whether to keep,
          change or stop each experiment.
        </p>
        <Link
          to="/experiments"
          data-testid="landing-sign-in"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    </>
  )
}
