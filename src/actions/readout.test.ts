import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionContext, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { APP_DAILY_READOUTS, makeGenerateReadout, USER_DAILY_READOUTS, type ModelCall } from './readout'

type Row = { recordId: string; data: Record<string, unknown> }
let db: Record<string, Row[]>
let nextId: number
const tick = () => new Promise((r) => setTimeout(r, Math.random() * 3))

/** A fake record room: reads and writes interleave like real requests, but each
 *  write is atomic and refuses a duplicate (scope, day, slot), as uniqueOn does. */
const tools = {
  query: async (collection: string, opts: { where?: Record<string, unknown>; offset?: number }) => {
    await tick()
    const all = (db[collection] ?? []).filter((r) => Object.entries(opts.where ?? {}).every(([k, v]) => r.data[k] === v))
    const offset = opts.offset ?? 0
    const records = all.slice(offset, offset + 2)
    return { success: true, data: { records, ...(offset + 2 < all.length ? { nextOffset: offset + 2 } : {}) } }
  },
  get: async (collection: string, id: string) => {
    await tick()
    const record = db[collection]?.find((r) => r.recordId === id)
    return record ? { success: true, data: { record } } : { success: false, error: 'not found' }
  },
  create: async (collection: string, data: Record<string, unknown>) => {
    await tick()
    if (collection === 'readout_usage') {
      const dup = db.readout_usage.some((r) => r.data.scope === data.scope && r.data.day === data.day && r.data.slot === data.slot)
      if (dup) return { success: false, error: `Duplicate: a record with scope=${data.scope} already exists in readout_usage` }
    }
    const recordId = `r${nextId++}`
    db[collection].push({ recordId, data })
    return { success: true, data: { recordId } }
  },
  remove: async (collection: string, id: string) => {
    db[collection] = db[collection].filter((r) => r.recordId !== id)
    return { success: true, data: { recordId: id } }
  },
} as unknown as ActionTools

const goodMemo =
  'iMessage is leading with 19 clicks from a reach of 40 and 6 signups. LinkedIn has 4 clicks. ' +
  'Click counts are approximate and the sample is small, so this is not statistically significant. ' +
  'Next, test iMessage against LinkedIn with reach entered for both.'

let modelCalls: { system: string; user: string }[]
let reply: Awaited<ReturnType<ModelCall>>
const realCall = () => (async (system: string, user: string) => {
  modelCalls.push({ system, user })
  return reply
}) as ModelCall
const generate = makeGenerateReadout(realCall)
const run = (userId: string, params: Record<string, unknown> = { experimentId: `exp-${userId}` }, env: Partial<Env> = {}) =>
  generate({ userId, params, tools, env: env as Env, callerJwt: 'x' } as ActionContext<Env>)

function seedUser(userId: string) {
  db.experiments.push({ recordId: `exp-${userId}`, data: { ownerId: userId, title: 'Secret title', hypothesis: 'DMs beat posts', successMetric: 'Signups', destinationUrl: 'https://x.y' } })
  db.variants.push(
    { recordId: `v1-${userId}`, data: { ownerId: userId, experimentId: `exp-${userId}`, channelName: 'iMessage', reach: 40, outcomeCount: 6, outcomeLabel: 'Signups', slug: 'aaaaaaaa' } },
    { recordId: `v2-${userId}`, data: { ownerId: userId, experimentId: `exp-${userId}`, channelName: 'LinkedIn', outcomeCount: 0, outcomeLabel: '', slug: 'bbbbbbbb' } },
  )
  for (let i = 0; i < 19; i++) db.clicks.push({ recordId: `c${userId}${i}`, data: { variant: `v1-${userId}`, experimentId: `exp-${userId}`, ownerId: userId } })
  for (let i = 0; i < 4; i++) db.clicks.push({ recordId: `d${userId}${i}`, data: { variant: `v2-${userId}`, experimentId: `exp-${userId}`, ownerId: userId } })
}

beforeEach(() => {
  nextId = 1
  modelCalls = []
  reply = { ok: true, response: { content: [{ type: 'text', text: goodMemo }] } }
  db = { experiments: [], variants: [], clicks: [], readout_usage: [] }
  seedUser('alice')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('generateReadout', () => {
  it('returns a checked memo with exactly the numbers it sent', async () => {
    const r = await run('alice')
    expect(r).toMatchObject({ success: true, data: { memo: goodMemo, used: 1, limit: USER_DAILY_READOUTS } })
    expect((r as any).data.data).toEqual({
      hypothesis: 'DMs beat posts',
      successMetric: 'Signups',
      channels: [
        { channel: 'iMessage', clicks: 19, reach: 40, outcomeCount: 6, outcomeLabel: 'Signups' },
        { channel: 'LinkedIn', clicks: 4, reach: null, outcomeCount: 0, outcomeLabel: '' },
      ],
    })
    // Only those fields reach the model: no title, ids, slugs, URLs or owner.
    expect(modelCalls).toHaveLength(1)
    for (const leak of ['Secret title', 'aaaaaaaa', 'https://x.y', 'alice', 'v1-']) expect(modelCalls[0].user).not.toContain(leak)
  })

  it("refuses someone else's experiment before spending anything", async () => {
    seedUser('bob')
    expect(await run('bob', { experimentId: 'exp-alice' })).toEqual({ success: false, error: 'Not found' })
    expect(await run('bob', { experimentId: 'nope' })).toEqual({ success: false, error: 'Not found' })
    expect(await run('bob', {})).toEqual({ success: false, error: 'Not found' })
    expect(modelCalls).toHaveLength(0)
    expect(db.readout_usage).toHaveLength(0)
  })

  it("never counts another user's channels or clicks", async () => {
    seedUser('bob')
    db.variants.push({ recordId: 'planted', data: { ownerId: 'bob', experimentId: 'exp-alice', channelName: 'Planted' } })
    db.clicks.push({ recordId: 'x', data: { variant: 'v1-alice', experimentId: 'exp-alice', ownerId: 'bob' } })
    const r = await run('alice')
    expect((r as any).data.data.channels.map((c: any) => [c.channel, c.clicks])).toEqual([['iMessage', 19], ['LinkedIn', 4]])
  })

  it('caps each user at 5 per day', async () => {
    for (let i = 1; i <= 5; i++) expect(await run('alice')).toMatchObject({ success: true, data: { used: i } })
    expect(await run('alice')).toMatchObject({ success: false, code: 'user_cap' })
    expect(modelCalls).toHaveLength(5)
  })

  it('allows exactly 5 out of 20 simultaneous requests from one user', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => run('alice')))
    expect(results.filter((r) => r.success)).toHaveLength(5)
    expect(results.filter((r) => !r.success && (r as any).code === 'user_cap')).toHaveLength(15)
    expect(modelCalls).toHaveLength(5)
    expect(db.readout_usage.filter((r) => r.data.scope === 'user:alice').map((r) => r.data.slot).sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('caps the app at 50 per day across users, even when they race, and frees the user slot', async () => {
    const users = Array.from({ length: 12 }, (_, i) => `u${i}`)
    users.forEach(seedUser)
    const results = await Promise.all(users.flatMap((u) => Array.from({ length: 5 }, () => run(u))))
    expect(results.filter((r) => r.success)).toHaveLength(APP_DAILY_READOUTS)
    expect(results.filter((r) => !r.success && (r as any).code === 'app_cap')).toHaveLength(60 - APP_DAILY_READOUTS)
    expect(modelCalls).toHaveLength(APP_DAILY_READOUTS)
    // Refused requests gave their user slot back.
    expect(db.readout_usage.filter((r) => r.data.scope !== 'app')).toHaveLength(APP_DAILY_READOUTS)
  })

  it('a new UTC day starts fresh', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-26T23:59:00Z'))
    for (let i = 0; i < 5; i++) await run('alice')
    expect(await run('alice')).toMatchObject({ code: 'user_cap' })
    vi.setSystemTime(new Date('2026-11-27T00:00:30Z'))
    expect(await run('alice')).toMatchObject({ success: true, data: { used: 1 } })
    vi.useRealTimers()
  })

  it('shows an error instead of a memo that uses numbers we did not send', async () => {
    reply = { ok: true, response: { content: [{ type: 'text', text: goodMemo.replace('6 signups', '6 signups (15%)') }] } }
    const r = await run('alice')
    expect(r).toMatchObject({ success: false, code: 'memo_rejected' })
    expect((r as any).error).toContain('15')
    expect(JSON.stringify(r)).not.toContain('iMessage is leading')
  })

  it('reports a model failure, and the slot still counts', async () => {
    reply = { ok: false, error: 'upstream 529' }
    expect(await run('alice')).toMatchObject({ success: false, code: 'model_failed' })
    expect(db.readout_usage.filter((r) => r.data.scope === 'user:alice')).toHaveLength(1)
  })

  it('uses the fake model only when debug routes are on AND the request asks', async () => {
    expect(await run('alice', { experimentId: 'exp-alice', fakeModel: true })).toMatchObject({ success: true, data: { model: 'claude-opus-5-5' } })
    expect(modelCalls).toHaveLength(1)
    const fake = await run('alice', { experimentId: 'exp-alice', fakeModel: true }, { ALLOW_DEBUG_ROUTES: 'true' })
    expect(fake).toMatchObject({ success: true, data: { model: 'fake' } })
    expect(modelCalls).toHaveLength(1)
  })

  it('refuses an experiment with no channels without spending', async () => {
    db.variants = []
    expect(await run('alice')).toMatchObject({ success: false, error: 'Add at least one channel first.' })
    expect(db.readout_usage).toHaveLength(0)
  })
})
