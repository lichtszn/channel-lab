import { beforeEach, describe, expect, it } from 'vitest'
import type { ActionContext, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { backfillOldClicks } from './backfill-clicks'

type Row = { recordId: string; data: Record<string, unknown> }
let db: Record<string, Row[]>
let writes: string[]
const PAGE = 3 // small pages, to prove every page is read

const tools = {
  query: async (collection: string, opts: { offset?: number; limit?: number }) => {
    const all = db[collection] ?? []
    const offset = opts.offset ?? 0
    const records = all.slice(offset, offset + PAGE)
    const next = offset + records.length
    return { success: true, data: { records, count: records.length, ...(next < all.length ? { nextOffset: next } : {}) } }
  },
  get: async (collection: string, id: string) => {
    const record = db[collection]?.find((r) => r.recordId === id)
    return record ? { success: true, data: { record } } : { success: false, error: 'not found' }
  },
  create: async (collection: string, data: Record<string, unknown>, recordId: string) => {
    writes.push(`create ${collection} ${recordId}`)
    db[collection].push({ recordId, data })
    return { success: true, data: { recordId } }
  },
  update: async () => { writes.push('update'); return { success: true } },
  remove: async () => { writes.push('remove'); return { success: true } },
} as unknown as ActionTools

const run = (userId: string, params: Record<string, unknown>, owner = 'owner') =>
  backfillOldClicks({ userId, params, tools, env: { OWNER_USER_ID: owner } as Env, callerJwt: 'x' } as ActionContext<Env>)

const old = (id: string, variant: string, at = '2026-11-26T05:40:00.000Z') => ({ recordId: id, data: { variant, clickedAt: at } })

beforeEach(() => {
  writes = []
  db = {
    experiments: [
      { recordId: 'exp-o', data: { ownerId: 'owner', title: 'Owner experiment' } },
      { recordId: 'exp-t', data: { ownerId: 'tester', title: 'Tester experiment' } },
    ],
    variants: [
      { recordId: 'v-imsg', data: { ownerId: 'owner', experimentId: 'exp-o', channelName: 'iMessage' } },
      { recordId: 'v-li', data: { ownerId: 'owner', experimentId: 'exp-o', channelName: 'LinkedIn' } },
      { recordId: 'v-tester', data: { ownerId: 'tester', experimentId: 'exp-t', channelName: 'Secret' } },
      { recordId: 'v-planted', data: { ownerId: 'tester', experimentId: 'exp-o', channelName: 'Planted' } },
      { recordId: 'v-orphan', data: { ownerId: 'owner', experimentId: 'exp-gone', channelName: 'Orphan' } },
    ],
    clicks: [
      old('c1', 'v-imsg', '2026-11-26T05:33:33.126Z'),
      old('c2', 'v-imsg'),
      old('c3', 'v-li'),
      old('s1', 'spike-test'),
      old('s2', 'spike-test'),
      old('c4', 'v-tester'),
      old('c5', 'v-planted'),
      old('c6', 'v-deleted'),
      old('c7', 'v-orphan'),
      { recordId: 'new1', data: { variant: 'v-imsg', experimentId: 'exp-o', ownerId: 'owner', clickedAt: '2026-11-26T06:00:00Z' } },
    ],
  }
})

describe('backfillOldClicks', () => {
  it('is owner-only', async () => {
    expect(await run('tester', { dryRun: false })).toEqual({ success: false, error: 'Forbidden: owner only' })
    expect(await run('owner', {}, '')).toEqual({ success: false, error: 'Forbidden: owner only' })
    expect(writes).toEqual([])
  })

  it('dry run is the default and writes nothing', async () => {
    const r = await run('owner', {})
    expect(r.success).toBe(true)
    if (!r.success) return
    const d = r.data as any
    expect(d).toMatchObject({ dryRun: true, clicksRead: 10, toCopy: 4, copied: 0 })
    expect(d.skipped).toEqual({ spikeTest: 2, alreadyStamped: 1, copies: 0, channelGone: 1, experimentGone: 1, ownerMismatch: 1 })
    expect(d.channels).toEqual([
      { variantId: 'v-imsg', channelName: 'iMessage', experimentTitle: 'Owner experiment', toCopy: 2, alreadyCopied: 0 },
      { variantId: 'v-li', channelName: 'LinkedIn', experimentTitle: 'Owner experiment', toCopy: 1, alreadyCopied: 0 },
      { variantId: 'v-tester', toCopy: 1, alreadyCopied: 0 },
    ])
    expect(writes).toEqual([])
  })

  it('copies with derived ids, keeps the click time, and never changes or deletes originals', async () => {
    const before = JSON.stringify(db.clicks)
    const r = await run('owner', { dryRun: false })
    expect(r).toMatchObject({ success: true, data: { copied: 4 } })
    expect(writes).toEqual(['create clicks bf-c1', 'create clicks bf-c2', 'create clicks bf-c3', 'create clicks bf-c4'])
    expect(JSON.stringify(db.clicks.slice(0, 10))).toBe(before)
    expect(db.clicks.find((c) => c.recordId === 'bf-c1')?.data).toEqual({
      variant: 'v-imsg', experimentId: 'exp-o', ownerId: 'owner', clickedAt: '2026-11-26T05:33:33.126Z',
    })
    expect(db.clicks.find((c) => c.recordId === 'bf-c4')?.data.ownerId).toBe('tester')
    expect(db.clicks.some((c) => c.recordId.startsWith('bf-s'))).toBe(false)
  })

  it('re-running creates no duplicates', async () => {
    await run('owner', { dryRun: false })
    writes = []
    const again = await run('owner', { dryRun: false })
    expect(again).toMatchObject({ success: true, data: { toCopy: 0, copied: 0, clicksRead: 14 } })
    expect((again as any).data.skipped.copies).toBe(4)
    expect((again as any).data.channels[0]).toMatchObject({ variantId: 'v-imsg', toCopy: 0, alreadyCopied: 2 })
    expect(writes).toEqual([])
  })
})
