/**
 * TEMPORARY one-off migration (2026-11-26). Remove after it has run.
 *
 * Clicks recorded before 2026-11-26 05:53 UTC have no experimentId or ownerId,
 * so nobody can read them. Those columns are immutable, so the rows cannot be
 * changed. This action COPIES each old click into a new row that has both
 * filled in, keeping the original click time. Originals are never changed or
 * deleted: they stay as an audit trail. Spike-test rows are skipped.
 *
 * Owner-only. `dryRun` defaults to true. Re-running never duplicates: each copy's
 * id is derived from the original click's id, and existing copies are skipped.
 */
import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'

export const COPY_PREFIX = 'bf-'
const SPIKE_VARIANT = 'spike-test'

type Row = { recordId: string; data: Record<string, unknown> }
type Query = (collection: string, opts: Record<string, unknown>) => ReturnType<ActionTools['query']>

/** Reads every row of a collection, page by page (pages are capped at ~30 KB). */
async function readAll(tools: ActionTools, collection: string): Promise<Row[]> {
  const query = tools.query as unknown as Query
  const rows: Row[] = []
  let offset = 0
  for (let page = 0; page < 1000; page++) {
    const r = await query(collection, { orderBy: 'createdAt', orderDir: 'asc', limit: 200, offset })
    if (!r.success) throw new Error(`could not read ${collection}: ${r.error}`)
    const data = r.data as { records: Row[]; nextOffset?: number }
    rows.push(...data.records)
    if (data.nextOffset === undefined || data.records.length === 0) return rows
    offset = data.nextOffset
  }
  throw new Error(`too many pages in ${collection}`)
}

type ChannelReport = {
  variantId: string
  /** Only shown for the caller's own channels. */
  channelName?: string
  experimentTitle?: string
  toCopy: number
  alreadyCopied: number
}

export const backfillOldClicks: ActionHandler<Env> = async ({ params, tools, userId, env }) => {
  if (!env.OWNER_USER_ID || userId !== env.OWNER_USER_ID) return { success: false, error: 'Forbidden: owner only' }
  const dryRun = params.dryRun !== false

  let clicks: Row[]
  try {
    clicks = await readAll(tools, 'clicks')
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
  const existingIds = new Set(clicks.map((c) => c.recordId))

  const variants = new Map<string, Row | null>()
  const experiments = new Map<string, Row | null>()
  const load = async (cache: Map<string, Row | null>, collection: string, id: string) => {
    if (!cache.has(id)) {
      const r = await tools.get(collection, id)
      cache.set(id, r.success ? (r.data.record as Row) : null)
    }
    return cache.get(id) ?? null
  }

  const channels = new Map<string, ChannelReport>()
  const skipped = { spikeTest: 0, alreadyStamped: 0, copies: 0, channelGone: 0, experimentGone: 0, ownerMismatch: 0 }
  const plan: { copyId: string; data: Record<string, unknown> }[] = []

  for (const click of clicks) {
    const variantId = String(click.data.variant ?? '')
    if (click.recordId.startsWith(COPY_PREFIX)) { skipped.copies++; continue }
    if (click.data.ownerId) { skipped.alreadyStamped++; continue }
    if (variantId === SPIKE_VARIANT) { skipped.spikeTest++; continue }

    const variant = await load(variants, 'variants', variantId)
    if (!variant) { skipped.channelGone++; continue }
    const experimentId = String(variant.data.experimentId ?? '')
    const experiment = experimentId ? await load(experiments, 'experiments', experimentId) : null
    if (!experiment) { skipped.experimentGone++; continue }
    const ownerId = experiment.data.ownerId
    if (typeof ownerId !== 'string' || !ownerId || variant.data.ownerId !== ownerId) { skipped.ownerMismatch++; continue }

    const report = channels.get(variantId) ?? {
      variantId,
      ...(ownerId === userId
        ? { channelName: String(variant.data.channelName ?? ''), experimentTitle: String(experiment.data.title ?? '') }
        : {}),
      toCopy: 0,
      alreadyCopied: 0,
    }
    channels.set(variantId, report)

    const copyId = `${COPY_PREFIX}${click.recordId}`
    if (existingIds.has(copyId)) { report.alreadyCopied++; continue }
    report.toCopy++
    plan.push({ copyId, data: { variant: variantId, experimentId, ownerId, clickedAt: click.data.clickedAt } })
  }

  let copied = 0
  if (!dryRun) {
    for (const item of plan) {
      const r = await tools.create('clicks', item.data, item.copyId)
      if (!r.success) {
        return { success: false, error: `Stopped after ${copied} copies: ${r.error}. Re-running is safe.` }
      }
      copied++
    }
  }

  return {
    success: true,
    data: {
      dryRun,
      clicksRead: clicks.length,
      toCopy: plan.length,
      copied,
      channels: [...channels.values()].sort((a, b) => b.toCopy + b.alreadyCopied - (a.toCopy + a.alreadyCopied)),
      skipped,
    },
  }
}
