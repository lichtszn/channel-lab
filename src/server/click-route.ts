/**
 * Public click route: the ONLY public write route in this app (see CLAUDE.md).
 *
 * It validates the slug, applies the rate limits, writes one click row and
 * redirects. No paid calls, no secrets, no other writes. Over a limit, or if the
 * limiter or the write fails, the visitor is still redirected but not counted.
 */

import type { Hono } from 'hono'
import type { AppContext, Env } from '../../worker.js'

/** Spike only: one fixed test variant. Real variants will come from records. */
const TEST_VARIANTS = new Map([
  ['spike-test', { variant: 'spike-test', destination: 'https://example.com/' }],
])

type ClickEnv = Pick<
  Env,
  'CLICK_IP_LIMITER' | 'CLICK_SLUG_LIMITER' | 'DEEPSPACE_APP_ID' | 'OWNER_USER_ID' | 'RECORD_ROOMS'
>

/** Checks the IP first, so one noisy IP cannot use up the slug's allowance. */
async function underLimits(env: ClickEnv, slug: string, ip: string): Promise<boolean> {
  const app = env.DEEPSPACE_APP_ID
  const byIp = await env.CLICK_IP_LIMITER.limit({ key: `${app}:ip:${ip}` })
  if (!byIp.success) return false
  return (await env.CLICK_SLUG_LIMITER.limit({ key: `${app}:slug:${slug}` })).success
}

async function writeClick(env: ClickEnv, variant: string): Promise<void> {
  const stub = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))
  const res = await stub.fetch(
    new Request('https://internal/api/tools/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': env.OWNER_USER_ID,
        'X-App-Action': 'true',
      },
      body: JSON.stringify({
        tool: 'records.create',
        params: { collection: 'clicks', data: { variant, clickedAt: new Date().toISOString() } },
      }),
    }),
  )
  const result = (await res.json()) as { success?: boolean; error?: string }
  if (!result.success) throw new Error(result.error ?? `click write failed (${res.status})`)
}

export function registerClickRoute(app: Hono<AppContext>): void {
  app.get('/go/:slug', async (c) => {
    const slug = c.req.param('slug')
    const target = TEST_VARIANTS.get(slug)
    if (!target) return c.text('Link not found', 404)

    // Hono sends HEAD requests here too (link previews); they are not clicks.
    if (c.req.method === 'GET') {
      try {
        const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
        if (await underLimits(c.env, slug, ip)) await writeClick(c.env, target.variant)
      } catch (error) {
        console.error(
          `[click] not counted: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    c.header('Cache-Control', 'no-store')
    return c.redirect(target.destination, 302)
  })
}
