import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '../../worker.js'
import { registerClickRoute } from './click-route'

const IP = '203.0.113.7'
const SLUG = 'abcd2345'
let ipAllowed: boolean
let slugAllowed: boolean
let variants: { recordId: string; data: Record<string, unknown> }[]
let experiments: Record<string, Record<string, unknown>>
let created: Record<string, unknown>[]
let createResult: () => Record<string, unknown>
let lookupFails: boolean

type ToolCall = { tool: string; params: Record<string, unknown> }

function room(call: ToolCall): Record<string, unknown> {
  if (lookupFails) throw new Error('room down')
  if (call.tool === 'records.query') {
    const slug = (call.params.where as { slug: string }).slug
    return { success: true, data: { records: variants.filter((v) => v.data.slug === slug) } }
  }
  if (call.tool === 'records.get') {
    const data = experiments[call.params.recordId as string]
    return data
      ? { success: true, data: { record: { recordId: call.params.recordId, data } } }
      : { success: false, error: 'not found' }
  }
  if (call.tool === 'records.create') {
    created.push(call.params)
    return createResult()
  }
  throw new Error(`unexpected tool ${call.tool}`)
}

function setup() {
  const app = new Hono<AppContext>()
  registerClickRoute(app)
  const ipLimit = vi.fn(async (_options: { key: string }) => ({ success: ipAllowed }))
  const slugLimit = vi.fn(async (_options: { key: string }) => ({ success: slugAllowed }))
  const env = {
    CLICK_IP_LIMITER: { limit: ipLimit },
    CLICK_SLUG_LIMITER: { limit: slugLimit },
    DEEPSPACE_APP_ID: 'app_test',
    OWNER_USER_ID: 'app-owner',
    RECORD_ROOMS: {
      idFromName: (name: string) => name,
      get: () => ({
        fetch: async (req: Request) => {
          expect(req.headers.get('X-App-Action')).toBe('true')
          return Response.json(room((await req.json()) as ToolCall))
        },
      }),
    },
  }
  const go = (path: string, method = 'GET') =>
    app.request(path, { method, headers: { 'CF-Connecting-IP': IP } }, env)
  return { go, ipLimit, slugLimit }
}

describe('/go/:slug', () => {
  beforeEach(() => {
    ipAllowed = true
    slugAllowed = true
    lookupFails = false
    variants = [{ recordId: 'var-1', data: { slug: SLUG, experimentId: 'exp-1', ownerId: 'alice' } }]
    experiments = { 'exp-1': { destinationUrl: 'https://example.org/landing', ownerId: 'alice' } }
    created = []
    createResult = () => ({ success: true, data: { recordId: 'click-1' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it("writes one row and redirects to the experiment's destination", async () => {
    const res = await setup().go(`/go/${SLUG}`)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('https://example.org/landing')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(created).toHaveLength(1)
  })

  it('stores only the variant id and time, never the IP', async () => {
    await setup().go(`/go/${SLUG}`)
    const [row] = created
    expect(row.collection).toBe('clicks')
    const data = row.data as Record<string, unknown>
    expect(Object.keys(data).sort()).toEqual(['clickedAt', 'variant'])
    expect(data.variant).toBe('var-1')
    expect(JSON.stringify(row)).not.toContain(IP)
  })

  it.each(['/go/zzzz9999', '/go/constructor', '/go/__proto__', '/go/ABCD2345', '/go/spike-test'])(
    'answers 404 for %s without touching limits or rows',
    async (path) => {
      const { go, ipLimit } = setup()
      expect((await go(path)).status).toBe(404)
      expect(ipLimit).not.toHaveBeenCalled()
      expect(created).toHaveLength(0)
    },
  )

  it("answers 404 when the variant points at someone else's experiment", async () => {
    variants[0].data.ownerId = 'mallory'
    const { go, ipLimit } = setup()
    expect((await go(`/go/${SLUG}`)).status).toBe(404)
    expect(ipLimit).not.toHaveBeenCalled()
    expect(created).toHaveLength(0)
  })

  it('answers 404 when the experiment is gone', async () => {
    experiments = {}
    expect((await setup().go(`/go/${SLUG}`)).status).toBe(404)
  })

  it.each(['javascript:alert(1)', 'data:text/html,hi', 'not a url'])(
    'answers 404 for the unsafe destination %s',
    async (destinationUrl) => {
      experiments['exp-1'].destinationUrl = destinationUrl
      expect((await setup().go(`/go/${SLUG}`)).status).toBe(404)
      expect(created).toHaveLength(0)
    },
  )

  it('answers 503 when the lookup fails', async () => {
    lookupFails = true
    expect((await setup().go(`/go/${SLUG}`)).status).toBe(503)
  })

  it('over the IP limit: redirects, does not count, spares the slug limit', async () => {
    ipAllowed = false
    const { go, slugLimit } = setup()
    expect((await go(`/go/${SLUG}`)).status).toBe(302)
    expect(slugLimit).not.toHaveBeenCalled()
    expect(created).toHaveLength(0)
  })

  it('over the slug limit: redirects, does not count', async () => {
    slugAllowed = false
    const { go, ipLimit, slugLimit } = setup()
    expect((await go(`/go/${SLUG}`)).status).toBe(302)
    expect(ipLimit).toHaveBeenCalledWith({ key: `app_test:ip:${IP}` })
    expect(slugLimit).toHaveBeenCalledWith({ key: `app_test:slug:${SLUG}` })
    expect(created).toHaveLength(0)
  })

  it('redirects when the limiter fails, without counting', async () => {
    const { go, ipLimit } = setup()
    ipLimit.mockRejectedValueOnce(new Error('limiter down'))
    expect((await go(`/go/${SLUG}`)).status).toBe(302)
    expect(created).toHaveLength(0)
  })

  it('redirects when the write is refused', async () => {
    createResult = () => ({ success: false, error: 'nope' })
    expect((await setup().go(`/go/${SLUG}`)).status).toBe(302)
  })

  it('does not count HEAD, and refuses other methods', async () => {
    const { go } = setup()
    expect((await go(`/go/${SLUG}`, 'HEAD')).status).toBe(302)
    expect((await go(`/go/${SLUG}`, 'POST')).status).toBe(404)
    expect(created).toHaveLength(0)
  })
})
