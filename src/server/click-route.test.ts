import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '../../worker.js'
import { registerClickRoute } from './click-route'

const IP = '203.0.113.7'
let ipAllowed: boolean
let slugAllowed: boolean
let writes: Request[]
let writeResult: () => Response

function setup() {
  const app = new Hono<AppContext>()
  registerClickRoute(app)
  const ipLimit = vi.fn(async (_options: { key: string }) => ({ success: ipAllowed }))
  const slugLimit = vi.fn(async (_options: { key: string }) => ({ success: slugAllowed }))
  const env = {
    CLICK_IP_LIMITER: { limit: ipLimit },
    CLICK_SLUG_LIMITER: { limit: slugLimit },
    DEEPSPACE_APP_ID: 'app_test',
    OWNER_USER_ID: 'owner',
    RECORD_ROOMS: {
      idFromName: (name: string) => name,
      get: () => ({
        fetch: async (req: Request) => {
          writes.push(req)
          return writeResult()
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
    writes = []
    writeResult = () => Response.json({ success: true, data: { recordId: 'r1' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('writes one row and redirects', async () => {
    const res = await setup().go('/go/spike-test')
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('https://example.com/')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(writes).toHaveLength(1)
  })

  it('stores only the variant and time, never the IP', async () => {
    await setup().go('/go/spike-test')
    const text = await writes[0].text()
    const body = JSON.parse(text)
    expect(body.tool).toBe('records.create')
    expect(body.params.collection).toBe('clicks')
    expect(Object.keys(body.params.data).sort()).toEqual(['clickedAt', 'variant'])
    expect(body.params.data.variant).toBe('spike-test')
    expect(text).not.toContain(IP)
  })

  it.each(['/go/nope', '/go/constructor', '/go/__proto__', '/go/Spike-Test'])(
    'rejects %s without touching limits or rows',
    async (path) => {
      const { go, ipLimit } = setup()
      expect((await go(path)).status).toBe(404)
      expect(ipLimit).not.toHaveBeenCalled()
      expect(writes).toHaveLength(0)
    },
  )

  it('over the IP limit: redirects, does not count, spares the slug limit', async () => {
    ipAllowed = false
    const { go, slugLimit } = setup()
    expect((await go('/go/spike-test')).status).toBe(302)
    expect(slugLimit).not.toHaveBeenCalled()
    expect(writes).toHaveLength(0)
  })

  it('over the slug limit: redirects, does not count', async () => {
    slugAllowed = false
    const { go, ipLimit, slugLimit } = setup()
    expect((await go('/go/spike-test')).status).toBe(302)
    expect(ipLimit).toHaveBeenCalledWith({ key: `app_test:ip:${IP}` })
    expect(slugLimit).toHaveBeenCalledWith({ key: 'app_test:slug:spike-test' })
    expect(writes).toHaveLength(0)
  })

  it('redirects when the limiter fails, without counting', async () => {
    const { go, ipLimit } = setup()
    ipLimit.mockRejectedValueOnce(new Error('limiter down'))
    expect((await go('/go/spike-test')).status).toBe(302)
    expect(writes).toHaveLength(0)
  })

  it('redirects when the write is refused', async () => {
    writeResult = () => Response.json({ success: false, error: 'nope' })
    expect((await setup().go('/go/spike-test')).status).toBe(302)
  })

  it('does not count HEAD, and refuses other methods', async () => {
    const { go } = setup()
    expect((await go('/go/spike-test', 'HEAD')).status).toBe(302)
    expect((await go('/go/spike-test', 'POST')).status).toBe(404)
    expect(writes).toHaveLength(0)
  })
})
