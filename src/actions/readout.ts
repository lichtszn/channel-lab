/**
 * generateReadout: the app's only paid call (owner-billed, see src/integrations.ts).
 *
 * Order matters: check ownership, gather the exact numbers, claim a cap slot,
 * THEN call the model, then check every number in the memo against the data.
 * A slot is used even if the model fails or the memo is rejected: a paid call
 * was made either way.
 *
 * OFF by default: the readout runs for real only when the DeepSpace secret
 * READOUT_ENABLED is "true" (see README). Off, nothing is claimed or called.
 */
import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import {
  buildUserMessage,
  checkMemo,
  memoText,
  READOUT_SYSTEM_PROMPT,
  utcDay,
  type ReadoutData,
} from '../lib/readout'

export const USER_DAILY_READOUTS = 3
export const APP_DAILY_READOUTS = 10
/** The cheapest suitable model in the catalog. */
export const READOUT_MODEL = 'claude-haiku-5-5'
export const READOUT_OFF_MESSAGE =
  'AI readout is switched off to avoid cost. It is fully built and tested with a fake model.'

/** True only when the owner has set the READOUT_ENABLED secret to "true". */
export function readoutEnabled(env: Pick<Env, 'READOUT_ENABLED'>): boolean {
  return env.READOUT_ENABLED === 'true'
}

/** Local tests only: fake model, honoured only when debug routes are on. */
function isTestMode(env: Pick<Env, 'ALLOW_DEBUG_ROUTES'>, params: Record<string, unknown>): boolean {
  return env.ALLOW_DEBUG_ROUTES === 'true' && params.fakeModel === true
}
export const READOUT_ENDPOINT = 'anthropic/chat-completion'

type Row = { recordId: string; data: Record<string, unknown> }
export type ModelCall = (system: string, user: string) => Promise<{ ok: true; response: unknown } | { ok: false; error: string }>

/** Reads every matching row, page by page (pages are capped at ~30 KB). */
async function readAll(tools: ActionTools, collection: string, where: Record<string, unknown>): Promise<Row[]> {
  const query = tools.query as unknown as (c: string, o: Record<string, unknown>) => ReturnType<ActionTools['query']>
  const rows: Row[] = []
  let offset = 0
  for (let page = 0; page < 500; page++) {
    const r = await query(collection, { where, orderBy: 'createdAt', orderDir: 'asc', limit: 200, offset })
    if (!r.success) throw new Error(`could not read ${collection}`)
    const data = r.data as { records: Row[]; nextOffset?: number }
    rows.push(...data.records)
    if (data.nextOffset === undefined || data.records.length === 0) return rows
    offset = data.nextOffset
  }
  throw new Error(`too many pages in ${collection}`)
}

/**
 * Claims the lowest free slot (1..max) for a scope and day. The record room
 * refuses a duplicate (scope, day, slot), so two requests racing for the same
 * slot cannot both win: the loser moves on to the next free slot.
 */
export async function claimSlot(tools: ActionTools, scope: string, day: string, max: number, userId: string) {
  const taken = new Set((await readAll(tools, 'readout_usage', { scope, day })).map((r) => Number(r.data.slot)))
  for (let slot = 1; slot <= max; slot++) {
    if (taken.has(slot)) continue
    const r = await tools.create('readout_usage', { scope, day, slot, userId })
    if (r.success) return { recordId: r.data.recordId, slot }
    if (!String(r.error).startsWith('Duplicate')) throw new Error(`could not record usage: ${r.error}`)
  }
  return null
}

export async function gatherReadoutData(tools: ActionTools, experiment: Row, userId: string): Promise<ReadoutData> {
  const experimentId = experiment.recordId
  const variants = (await readAll(tools, 'variants', { experimentId })).filter((v) => v.data.ownerId === userId)
  const clicks = (await readAll(tools, 'clicks', { experimentId })).filter((c) => c.data.ownerId === userId)
  const counts = new Map<string, number>()
  for (const c of clicks) counts.set(String(c.data.variant), (counts.get(String(c.data.variant)) ?? 0) + 1)
  return {
    hypothesis: String(experiment.data.hypothesis ?? ''),
    successMetric: String(experiment.data.successMetric ?? ''),
    channels: variants.map((v) => ({
      channel: String(v.data.channelName ?? ''),
      clicks: counts.get(v.recordId) ?? 0,
      reach: typeof v.data.reach === 'number' ? v.data.reach : null,
      outcomeCount: typeof v.data.outcomeCount === 'number' ? v.data.outcomeCount : 0,
      outcomeLabel: String(v.data.outcomeLabel ?? ''),
    })),
  }
}

/** The real model call, through the platform proxy, billed to the app owner. */
export const anthropicCall =
  (tools: ActionTools): ModelCall =>
  async (system, user) => {
    const r = await tools.integration(READOUT_ENDPOINT, {
      model: READOUT_MODEL,
      max_tokens: 700,
      temperature: 0,
      system,
      messages: [{ role: 'user', content: user }],
    })
    return r.success ? { ok: true, response: r.data } : { ok: false, error: r.error }
  }

/**
 * LOCAL TESTS ONLY: a canned memo instead of a paid call. Honoured only when
 * ALLOW_DEBUG_ROUTES is "true" (set by `deepspace dev` / `test run`, never in
 * this app's production config) AND the request asks for it.
 */
function fakeCall(data: ReadoutData, memo?: string): ModelCall {
  const lead = [...data.channels].sort((a, b) => b.clicks - a.clicks)[0]
  const text =
    memo ??
    `${lead.channel} is leading with ${lead.clicks} clicks and ${lead.outcomeCount} outcomes. ` +
      'Click counts are approximate and the sample is small, so this is not statistically significant. ' +
      `Next, run ${lead.channel} again with reach entered for every channel.`
  return async () => ({ ok: true, response: { content: [{ type: 'text', text }] } })
}

export function makeGenerateReadout(realCall: (tools: ActionTools) => ModelCall): ActionHandler<Env> {
  return async ({ params, tools, userId, env }) => {
    const testMode = isTestMode(env, params)
    // The production switch: off means no slot is claimed and nothing is called.
    if (!readoutEnabled(env) && !testMode) return { success: false, error: READOUT_OFF_MESSAGE, code: 'readout_off' }

    const experimentId = params.experimentId
    if (typeof experimentId !== 'string' || !experimentId) return { success: false, error: 'Not found' }
    const found = await tools.get('experiments', experimentId)
    if (!found.success || found.data.record.data.ownerId !== userId) return { success: false, error: 'Not found' }
    const experiment = found.data.record as Row

    let data: ReadoutData
    try {
      data = await gatherReadoutData(tools, experiment, userId)
    } catch {
      return { success: false, error: 'Could not read your experiment data. Try again.' }
    }
    if (data.channels.length === 0) return { success: false, error: 'Add at least one channel first.' }

    const day = testMode && typeof params.testDay === 'string' ? params.testDay : utcDay()

    // Claim the caps before spending anything. Release the user slot if the app is full.
    let userSlot: Awaited<ReturnType<typeof claimSlot>>
    try {
      userSlot = await claimSlot(tools, `user:${userId}`, day, USER_DAILY_READOUTS, userId)
      if (!userSlot) {
        return { success: false, error: `You have used all ${USER_DAILY_READOUTS} readouts for today (UTC). Try again tomorrow.`, code: 'user_cap' }
      }
      const appSlot = await claimSlot(tools, 'app', day, APP_DAILY_READOUTS, userId)
      if (!appSlot) {
        await tools.remove('readout_usage', userSlot.recordId)
        return { success: false, error: 'The app has reached its readout limit for today (UTC). Try again tomorrow.', code: 'app_cap' }
      }
    } catch {
      return { success: false, error: 'Could not check the daily readout limit. Try again.' }
    }

    const call = testMode ? fakeCall(data, typeof params.fakeMemo === 'string' ? params.fakeMemo : undefined) : realCall(tools)
    const answer = await call(READOUT_SYSTEM_PROMPT, buildUserMessage(data))
    if (!answer.ok) {
      console.error(`[readout] model call failed: ${answer.error}`)
      return { success: false, error: 'The AI service did not answer. Try again in a moment.', code: 'model_failed' }
    }
    const memo = memoText(answer.response)
    const check = checkMemo(memo, data)
    if (!check.ok) {
      // Never show a memo we could not verify.
      return {
        success: false,
        error: `The readout was rejected because ${check.problems.join('; ')}. Try again.`,
        code: 'memo_rejected',
      }
    }
    return { success: true, data: { memo, data, model: testMode ? 'fake' : READOUT_MODEL, used: userSlot.slot, limit: USER_DAILY_READOUTS } }
  }
}

export const generateReadout = makeGenerateReadout(anthropicCall)

/** Tells the screen whether the readout is on, and the caps. Free: no model call. */
export const readoutSettings: ActionHandler<Env> = async ({ params, env }) => ({
  success: true,
  data: {
    enabled: readoutEnabled(env) || isTestMode(env, params),
    userLimit: USER_DAILY_READOUTS,
    appLimit: APP_DAILY_READOUTS,
    offMessage: READOUT_OFF_MESSAGE,
  },
})
