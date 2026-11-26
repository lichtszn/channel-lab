/**
 * Public click route: the ONLY public write route in this app (see CLAUDE.md).
 *
 * It looks up the variant by slug, applies the rate limits, writes one click
 * row (variant, experiment, the experiment owner's id, time) and redirects to the experiment's destination. No paid calls, no
 * secrets, no other writes. Over a limit, or if the limiter or the write
 * fails, the visitor is still redirected but not counted.
 */

import type { Hono } from 'hono'
import { isHttpUrl } from '../schemas/experiments-schema.js'
import { SLUG_PATTERN } from '../schemas/variants-schema.js'
import type { AppContext, Env } from '../../worker.js'

type ClickEnv = Pick<
  Env,
  'CLICK_IP_LIMITER' | 'CLICK_SLUG_LIMITER' | 'DEEPSPACE_APP_ID' | 'OWNER_USER_ID' | 'RECORD_ROOMS'
>

type Row = { recordId: string; data: Record<string, unknown> }
type ToolResult = { success?: boolean; error?: string; data?: { records?: Row[]; record?: Row } }

/** Runs one record tool as the app's own server code (permissions do not apply). */
async function tool(env: ClickEnv, name: string, params: Record<string, unknown>) {
  const stub = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))
  const res = await stub.fetch(
    new Request('https://internal/api/tools/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': env.OWNER_USER_ID,
        'X-App-Action': 'true',
      },
      body: JSON.stringify({ tool: name, params }),
    }),
  )
  return (await res.json()) as ToolResult
}

/**
 * The variant's id and its experiment's destination, or null for an unknown
 * link. A variant only counts when its owner also owns the experiment, so no
 * one can point a link at someone else's experiment.
 */
async function findLink(env: ClickEnv, slug: string) {
  const found = await tool(env, 'records.query', {
    collection: 'variants',
    where: { slug },
    limit: 1,
  })
  if (!found.success) throw new Error(found.error ?? 'variant lookup failed')
  const variant = found.data?.records?.[0]
  if (!variant || typeof variant.data.experimentId !== 'string') return null

  const exp = await tool(env, 'records.get', {
    collection: 'experiments',
    recordId: variant.data.experimentId,
  })
  const experiment = exp.success ? exp.data?.record : undefined
  if (!experiment || experiment.data.ownerId !== variant.data.ownerId) return null
  const destination = experiment.data.destinationUrl
  if (typeof destination !== 'string' || !isHttpUrl(destination)) return null
  return {
    variantId: variant.recordId,
    experimentId: variant.data.experimentId,
    ownerId: experiment.data.ownerId as string,
    destination,
  }
}

/** Checks the IP first, so one noisy IP cannot use up the slug's allowance. */
async function underLimits(env: ClickEnv, slug: string, ip: string): Promise<boolean> {
  const app = env.DEEPSPACE_APP_ID
  const byIp = await env.CLICK_IP_LIMITER.limit({ key: `${app}:ip:${ip}` })
  if (!byIp.success) return false
  return (await env.CLICK_SLUG_LIMITER.limit({ key: `${app}:slug:${slug}` })).success
}

type Link = NonNullable<Awaited<ReturnType<typeof findLink>>>

/** The row says which variant and experiment, whose experiment it is, and when. Nothing about the visitor. */
async function writeClick(env: ClickEnv, link: Link): Promise<void> {
  const result = await tool(env, 'records.create', {
    collection: 'clicks',
    data: {
      variant: link.variantId,
      experimentId: link.experimentId,
      ownerId: link.ownerId,
      clickedAt: new Date().toISOString(),
    },
  })
  if (!result.success) throw new Error(result.error ?? 'click write failed')
}

export function registerClickRoute(app: Hono<AppContext>): void {
  app.get('/go/:slug', async (c) => {
    const slug = c.req.param('slug')
    if (!SLUG_PATTERN.test(slug)) return c.text('Link not found', 404)

    let link: Link | null
    try {
      link = await findLink(c.env, slug)
    } catch (error) {
      console.error(`[click] lookup failed: ${error instanceof Error ? error.message : String(error)}`)
      return c.text('Link temporarily unavailable', 503)
    }
    if (!link) return c.text('Link not found', 404)

    // Hono sends HEAD requests here too (link previews); they are not clicks.
    if (c.req.method === 'GET') {
      try {
        const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
        if (await underLimits(c.env, slug, ip)) await writeClick(c.env, link)
      } catch (error) {
        console.error(`[click] not counted: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    c.header('Cache-Control', 'no-store')
    return c.redirect(link.destination, 302)
  })
}
