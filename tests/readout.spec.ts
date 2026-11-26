/**
 * AI readout against the real local record room. NO PAID CALLS: every request
 * sets `fakeModel: true`, which the action honours only when ALLOW_DEBUG_ROUTES
 * is "true" (local dev and tests). `testDay` gives each run its own cap window.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { Page } from '@playwright/test'

test.skip(loadAllTestAccounts().length < 2, 'Needs 2 usable test accounts')

async function call(page: Page, path: string, body: object) {
  return page.evaluate(
    async ({ path, body }) => {
      const auth = await fetch('/api/auth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      const { token } = (await auth.json()) as { token: string }
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      return { status: res.status, ...(await res.json()) }
    },
    { path, body },
  )
}

const randomSlug = () => Array.from({ length: 8 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('')
const testDay = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

async function setup(page: Page) {
  await page.goto('/experiments')
  await expect(page.getByTestId('nav-user-name')).toHaveText(/\S/, { timeout: 15_000 })
  const exp = await call(page, '/api/actions/createExperiment', {
    title: `__test-${Date.now()}__ readout`,
    hypothesis: 'DMs beat posts',
    successMetric: 'Signups',
    destinationUrl: 'https://example.com/r',
  })
  const expId = exp.data.recordId as string
  for (const [channelName, reach, outcomeCount] of [['iMessage', 40, 6], ['LinkedIn', null, 0]] as const) {
    const r = await call(page, '/_deepspace/agent/browser/tools/records_create', {
      input: { collection: 'variants', data: { experimentId: expId, channelName, slug: randomSlug(), reach, outcomeCount, outcomeLabel: 'Signups' } },
    })
    expect(r.result?.success, JSON.stringify(r)).toBe(true)
  }
  return expId
}

test('only the owner can generate a readout', async ({ users }) => {
  const [a, b] = await users(2)
  const expId = await setup(a.page)
  await b.page.goto('/experiments')
  await expect(b.page.getByTestId('nav-user-name')).toHaveText(/\S/, { timeout: 15_000 })
  const day = testDay()
  expect(await call(b.page, '/api/actions/generateReadout', { experimentId: expId, fakeModel: true, testDay: day })).toMatchObject({ success: false, error: 'Not found' })
  const own = await call(a.page, '/api/actions/generateReadout', { experimentId: expId, fakeModel: true, testDay: day })
  expect(own).toMatchObject({ success: true, data: { model: 'fake', used: 1 } })
  expect(own.data.data.channels).toEqual([
    { channel: 'iMessage', clicks: 0, reach: 40, outcomeCount: 6, outcomeLabel: 'Signups' },
    { channel: 'LinkedIn', clicks: 0, reach: null, outcomeCount: 0, outcomeLabel: 'Signups' },
  ])
})

test('the real record room allows exactly 5 of 8 simultaneous readouts', async ({ users }) => {
  const [a] = await users(1)
  const expId = await setup(a.page)
  const day = testDay()
  const results = await Promise.all(
    Array.from({ length: 8 }, () => call(a.page, '/api/actions/generateReadout', { experimentId: expId, fakeModel: true, testDay: day })),
  )
  expect(results.filter((r) => r.success)).toHaveLength(5)
  expect(results.filter((r) => r.code === 'user_cap')).toHaveLength(3)
  expect(results.filter((r) => r.success).map((r) => r.data.used).sort()).toEqual([1, 2, 3, 4, 5])
})

test('the button shows loading, then the memo beside its numbers; a bad memo shows an error and retry', async ({ users }) => {
  const [a] = await users(1)
  const page = a.page
  const expId = await setup(page)
  const day = testDay()
  let fakeMemo: string | undefined = 'iMessage leads with 19 clicks, approximate counts, small sample, not significant. Next test LinkedIn.'
  // Test-only: steer the real action to the fake model, and slow it so the loading state is visible.
  await page.route('**/api/actions/generateReadout', async (route) => {
    const body = { ...JSON.parse(route.request().postData() ?? '{}'), fakeModel: true, testDay: day, ...(fakeMemo ? { fakeMemo } : {}) }
    await new Promise((r) => setTimeout(r, 400))
    await route.continue({ postData: JSON.stringify(body) })
  })
  await page.goto(`/experiments/${expId}`)
  const panel = page.getByTestId('readout-panel')
  await expect(panel.getByRole('button', { name: 'Generate readout' })).toBeEnabled({ timeout: 15_000 })

  // 19 is not in this experiment's data: the memo must be refused.
  await panel.getByRole('button', { name: 'Generate readout' }).click()
  await expect(panel.getByRole('button', { name: 'Generating…' })).toBeDisabled()
  await expect(page.getByTestId('readout-error')).toContainText('19')
  await expect(page.getByTestId('readout-memo')).toHaveCount(0)

  fakeMemo = undefined
  await page.getByTestId('readout-error').getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByTestId('readout-memo')).toContainText('iMessage is leading', { timeout: 15_000 })
  await expect(page.getByTestId('readout-memo')).toContainText('approximate')
  await expect(page.getByTestId('readout-numbers')).toContainText('iMessage')
  await expect(page.getByTestId('readout-numbers')).toContainText('40')
  await expect(page.getByTestId('readout-error')).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Generate again' })).toBeEnabled()
})
