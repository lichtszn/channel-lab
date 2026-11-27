import { test, expect } from '@playwright/test'

test.describe('API tests', () => {
  test('auth proxy forwards to auth worker', async ({ request }) => {
    const res = await request.get('/api/auth/ok')
    expect(res.ok()).toBeTruthy()
  })

  test('WebSocket endpoint exists', async ({ page }) => {
    // /home is a dynamic page (under src/pages/(app)/), so mounting it boots
    // the providers and auto-connects the records WebSocket. The static
    // landing at '/' deliberately does neither — see smoke.spec.ts.
    await page.goto('/home')
    // Wait for the app to connect its WebSocket (it auto-connects on mount)
    await page.waitForSelector('[data-testid="app-navigation"]', { timeout: 15000 })
    // If the app loaded and connected, the WS endpoint works
  })

  test('paid integration route is closed', async ({ request }) => {
    for (const method of ['GET', 'POST'] as const) {
      const res = await request.fetch('/api/integrations/openai/chat-completion', {
        method,
        ...(method === 'POST' ? { data: {} } : {}),
      })
      // 403 from our closed route; the template's route answered 401 here.
      expect(res.status()).toBe(403)
    }
  })

  test('file upload route is closed', async ({ request }) => {
    // The template answered 401 signed out and proxied to storage signed in.
    // Our closed route answers 404 before looking at who is calling.
    for (const method of ['GET', 'POST', 'PUT', 'DELETE'] as const) {
      const res = await request.fetch('/api/files/upload', {
        method,
        ...(method === 'GET' ? {} : { data: 'x' }),
      })
      expect(res.status()).toBe(404)
    }
  })

  test('in-app AI chat is off', async ({ request }) => {
    for (const path of ['/api/ai/chat', '/api/ai/chats']) {
      const res = await request.post(path, { data: {} })
      expect(res.status()).toBe(404)
    }
  })
})

test.describe('public click route', () => {
  // Redirects and click rows for real variants are covered in experiments.spec.ts.
  test('unknown slugs, the retired spike slug, and other methods get 404', async ({ request }) => {
    for (const path of ['/go/nope', '/go/zzzz9999', '/go/spike-test']) {
      expect((await request.get(path, { maxRedirects: 0 })).status()).toBe(404)
    }
    expect((await request.post('/go/zzzz9999', { data: {} })).status()).toBe(404)
  })
})
