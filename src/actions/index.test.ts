import { beforeEach, describe, expect, it } from 'vitest'
import type { ActionContext, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { createExperiment, deleteChannel, setDecision } from './index'

type Row = { recordId: string; data: Record<string, unknown> }
let rows: Record<string, Row[]>
let calls: string[]

const tools = {
  get: async (collection: string, recordId: string) => {
    const record = rows[collection]?.find((r) => r.recordId === recordId)
    return record ? { success: true, data: { record } } : { success: false, error: 'not found' }
  },
  query: async (collection: string, opts?: { where?: Record<string, unknown> }) => {
    const match = (rows[collection] ?? []).filter((r) =>
      Object.entries(opts?.where ?? {}).every(([k, v]) => r.data[k] === v),
    )
    return { success: true, data: { records: match, count: match.length } }
  },
  create: async (collection: string, data: Record<string, unknown>) => {
    calls.push(`create ${collection} ${JSON.stringify(data)}`)
    return { success: true, data: { recordId: 'new' } }
  },
  update: async (collection: string, id: string, data: Record<string, unknown>) => {
    calls.push(`update ${collection} ${id} ${JSON.stringify(data)}`)
    return { success: true, data: { recordId: id } }
  },
  remove: async (collection: string, id: string) => {
    calls.push(`remove ${collection} ${id}`)
    return { success: true, data: { recordId: id } }
  },
} as unknown as ActionTools

const ctx = (userId: string, params: Record<string, unknown>) =>
  ({ userId, params, tools, env: {} as Env, callerJwt: 'x' }) as ActionContext<Env>

beforeEach(() => {
  calls = []
  rows = {
    experiments: [{ recordId: 'exp-a', data: { ownerId: 'alice', decision: 'none' } }],
    variants: [
      { recordId: 'var-quiet', data: { ownerId: 'alice', experimentId: 'exp-a' } },
      { recordId: 'var-busy', data: { ownerId: 'alice', experimentId: 'exp-a' } },
    ],
    clicks: [{ recordId: 'c1', data: { variant: 'var-busy' } }],
  }
})

describe('createExperiment', () => {
  it('saves a valid experiment with decision none', async () => {
    const r = await createExperiment(ctx('alice', { title: ' T ', destinationUrl: 'https://x.y/z' }))
    expect(r.success).toBe(true)
    expect(calls[0]).toContain('"title":"T"')
    expect(calls[0]).toContain('"decision":"none"')
    expect(calls[0]).not.toContain('ownerId')
  })

  it.each(['javascript:alert(1)', 'data:text/html,x', 'x.y', ''])('refuses destination %j', async (destinationUrl) => {
    const r = await createExperiment(ctx('alice', { title: 'T', destinationUrl }))
    expect(r.success).toBe(false)
    expect(calls).toEqual([])
  })

  it('refuses a missing title and non-text fields', async () => {
    expect((await createExperiment(ctx('alice', { destinationUrl: 'https://x.y' }))).success).toBe(false)
    expect((await createExperiment(ctx('alice', { title: 'T', destinationUrl: 'https://x.y', audience: 5 }))).success).toBe(false)
    expect(calls).toEqual([])
  })
})

describe('setDecision', () => {
  it('saves a valid decision on your own experiment', async () => {
    const r = await setDecision(ctx('alice', { experimentId: 'exp-a', decision: 'keep', reason: ' works ' }))
    expect(r.success).toBe(true)
    expect(calls).toEqual(['update experiments exp-a {"decision":"keep","decisionReason":"works"}'])
  })

  it.each(['maybe', '', null, 'KEEP'])('refuses decision %j', async (decision) => {
    expect((await setDecision(ctx('alice', { experimentId: 'exp-a', decision }))).success).toBe(false)
    expect(calls).toEqual([])
  })

  it("refuses someone else's or an unknown experiment", async () => {
    expect(await setDecision(ctx('bob', { experimentId: 'exp-a', decision: 'stop' }))).toEqual({ success: false, error: 'Not found' })
    expect(await setDecision(ctx('alice', { experimentId: 'nope', decision: 'stop' }))).toEqual({ success: false, error: 'Not found' })
    expect(calls).toEqual([])
  })
})

describe('deleteChannel', () => {
  it('deletes your own channel when it has no clicks', async () => {
    expect((await deleteChannel(ctx('alice', { variantId: 'var-quiet' }))).success).toBe(true)
    expect(calls).toEqual(['remove variants var-quiet'])
  })

  it('refuses a channel with clicks', async () => {
    const r = await deleteChannel(ctx('alice', { variantId: 'var-busy' }))
    expect(r).toMatchObject({ success: false })
    expect(calls).toEqual([])
  })

  it("refuses someone else's channel", async () => {
    expect(await deleteChannel(ctx('bob', { variantId: 'var-quiet' }))).toEqual({ success: false, error: 'Not found' })
    expect(calls).toEqual([])
  })
})
