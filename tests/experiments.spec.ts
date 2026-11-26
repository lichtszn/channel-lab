/**
 * Experiments, channels and clicks: per-user privacy, server-side rules, the
 * experiment page (live click counts, rates, decision, rename and delete), and
 * the click route. Needs two usable test accounts (see collab.spec.ts).
 * Test experiments cannot be deleted (nobody can delete experiments), so they
 * stay in the local dev database, titled __test-…__.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { Page } from '@playwright/test'
import { countLocalClicks } from './helpers/local-clicks'

test.skip(loadAllTestAccounts().length < 2, 'Needs 2 usable test accounts')

type Reply = { status: number; ok?: boolean; success?: boolean; error?: string; data?: any; result?: { success: boolean; error?: string; data?: any } }

async function call(page: Page, path: string, body: object): Promise<Reply> {
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

/** A record tool AS the signed-in user, so normal permissions apply. */
const tool = (page: Page, name: string, input: object) => call(page, `/_deepspace/agent/browser/tools/${name}`, { input })
/** A server action AS the signed-in user. */
const action = (page: Page, name: string, params: object) => call(page, `/api/actions/${name}`, params)
const refused = (r: Reply) => r.ok === false || r.result?.success === false || r.success === false

async function signedInAt(page: Page, path: string) {
  await page.goto(path)
  await expect(page.getByTestId('nav-user-name')).toHaveText(/\S/, { timeout: 15_000 })
}

const tag = () => `__test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}__`
const randomSlug = () =>
  Array.from({ length: 8 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('')
const visitorIp = () => `198.18.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`

async function newExperiment(page: Page, destinationUrl = 'https://example.com/landing') {
  const r = await action(page, 'createExperiment', { title: `${tag()} experiment`, destinationUrl })
  expect(r.success, JSON.stringify(r)).toBe(true)
  return r.data.recordId as string
}

async function newChannel(page: Page, experimentId: string, channelName: string) {
  const slug = randomSlug()
  const r = await tool(page, 'records_create', { collection: 'variants', data: { experimentId, channelName, slug } })
  const id = r.result?.data?.recordId as string
  expect(id, JSON.stringify(r)).toBeTruthy()
  return { id, slug }
}

/** A signed-out visitor follows a tracked link. */
async function visit(page: Page, slug: string) {
  const res = await page.context().request.fetch(`/go/${slug}`, {
    maxRedirects: 0,
    headers: { Cookie: '', 'CF-Connecting-IP': visitorIp() },
  })
  return res
}

test('user B cannot read user A experiments, channels or click counts, or change them', async ({ users }) => {
  const [a, b] = await users(2)
  await Promise.all([signedInAt(a.page, '/experiments'), signedInAt(b.page, '/experiments')])
  const aId = ((await tool(a.page, 'user_current', {})).result?.data) as { id?: string; user?: { id: string } }
  const aUserId = aId.user?.id ?? aId.id
  expect(typeof aUserId).toBe('string')

  const expId = await newExperiment(a.page)
  const channel = await newChannel(a.page, expId, 'A channel')
  expect((await visit(a.page, channel.slug)).status()).toBe(302)
  await expect.poll(() => countLocalClicks(channel.id)).toBe(1)

  // A sees their own click.
  const aClicks = await tool(a.page, 'records_query', { collection: 'clicks', where: { experimentId: expId } })
  expect(aClicks.result?.data?.records).toHaveLength(1)

  // B sees none of A's experiment, channel or clicks.
  for (const [collection, where] of [
    ['experiments', { recordId: expId }],
    ['variants', { experimentId: expId }],
    ['clicks', { experimentId: expId }],
  ] as const) {
    const r = await tool(b.page, 'records_query', { collection, where })
    expect(r.result?.success, JSON.stringify(r)).toBe(true)
    expect(r.result?.data?.records, collection).toEqual([])
  }
  expect(refused(await tool(b.page, 'records_get', { collection: 'clicks', recordId: aClicks.result?.data?.records[0].recordId }))).toBe(true)
  await b.page.goto(`/experiments/${expId}`)
  await expect(b.page.getByText('Experiment not found')).toBeVisible({ timeout: 15_000 })

  // B cannot change A's channel or experiment, directly or through actions.
  expect(refused(await tool(b.page, 'records_update', { collection: 'variants', recordId: channel.id, data: { channelName: 'hijacked' } }))).toBe(true)
  expect(refused(await tool(b.page, 'records_update', { collection: 'variants', recordId: channel.id, data: { outcomeCount: 999 } }))).toBe(true)
  expect(refused(await tool(b.page, 'records_update', { collection: 'experiments', recordId: expId, data: { title: 'hijacked' } }))).toBe(true)
  expect(await action(b.page, 'deleteChannel', { variantId: channel.id })).toMatchObject({ success: false, error: 'Not found' })
  expect(await action(b.page, 'setDecision', { experimentId: expId, decision: 'stop' })).toMatchObject({ success: false, error: 'Not found' })

  // Nothing changed for A.
  const after = await tool(a.page, 'records_get', { collection: 'variants', recordId: channel.id })
  expect(after.result?.data?.record?.data).toMatchObject({ channelName: 'A channel', outcomeCount: 0 })

  // B cannot create rows in A's name: the server stamps the owner.
  const forged = await action(b.page, 'createExperiment', { title: `${tag()} forged`, destinationUrl: 'https://example.com/b', ownerId: aUserId })
  expect(forged.success).toBe(true)
  const aList = await tool(a.page, 'records_query', { collection: 'experiments' })
  expect(JSON.stringify(aList.result?.data?.records)).not.toContain(forged.data.recordId)
})

test('the server enforces decisions, http(s) destinations and no deletes', async ({ users }) => {
  const [a] = await users(1)
  await signedInAt(a.page, '/experiments')
  const expId = await newExperiment(a.page)
  const channel = await newChannel(a.page, expId, 'Quiet channel')

  expect(await action(a.page, 'createExperiment', { title: 'x', destinationUrl: 'javascript:alert(1)' })).toMatchObject({ success: false })
  expect(refused(await tool(a.page, 'records_create', { collection: 'experiments', data: { title: 'direct', destinationUrl: 'https://example.com' } }))).toBe(true)
  expect(refused(await tool(a.page, 'records_update', { collection: 'experiments', recordId: expId, data: { decision: 'maybe' } }))).toBe(true)
  expect(refused(await tool(a.page, 'records_update', { collection: 'experiments', recordId: expId, data: { destinationUrl: 'javascript:alert(1)' } }))).toBe(true)
  expect(await action(a.page, 'setDecision', { experimentId: expId, decision: 'maybe' })).toMatchObject({ success: false })
  expect(refused(await tool(a.page, 'records_delete', { collection: 'experiments', recordId: expId }))).toBe(true)
  expect(refused(await tool(a.page, 'records_delete', { collection: 'variants', recordId: channel.id }))).toBe(true)

  const exp = await tool(a.page, 'records_get', { collection: 'experiments', recordId: expId })
  expect(exp.result?.data?.record?.data).toMatchObject({ decision: 'none', destinationUrl: 'https://example.com/landing' })
})

test('a variant pointing at someone else experiment gets no working link', async ({ users }) => {
  const [a, b] = await users(2)
  await Promise.all([signedInAt(a.page, '/experiments'), signedInAt(b.page, '/experiments')])
  const expId = await newExperiment(a.page, 'https://example.com/a-only')
  // Permissions allow it (B owns the variant); the click route must still refuse it.
  const planted = await newChannel(b.page, expId, 'planted')
  expect((await visit(b.page, planted.slug)).status()).toBe(404)
  expect(countLocalClicks(planted.id)).toBe(0)
  await action(b.page, 'deleteChannel', { variantId: planted.id })
})

test('the experiment page shows live click counts and rates', async ({ users }) => {
  const [a] = await users(1)
  await signedInAt(a.page, '/experiments')
  const page = a.page
  const title = `${tag()} Founder posts vs ads`

  // Create through the form.
  await page.getByRole('button', { name: 'New experiment' }).first().click()
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Destination URL').fill('javascript:alert(1)')
  await page.getByRole('button', { name: 'Create experiment' }).click()
  await expect(page.getByText('The destination must be a full http:// or https:// link.')).toBeVisible()
  await page.getByLabel('Destination URL').fill('https://example.com/landing')
  await page.getByRole('button', { name: 'Create experiment' }).click()
  await expect(page.getByTestId('experiment-title')).toHaveText(title, { timeout: 15_000 })
  await expect(page.getByTestId('variants-empty')).toBeVisible()

  for (const channel of ['LinkedIn', 'Newsletter']) {
    await page.getByLabel('Channel name').fill(channel)
    await page.getByRole('button', { name: 'Add channel' }).click()
    await expect(page.locator(`[data-channel="${channel}"]`)).toBeVisible({ timeout: 15_000 })
  }
  await expect(page.getByTestId('clicks-caveat')).toContainText('approximate')
  await expect(page.getByTestId('clicks-caveat')).toContainText('not a signup')

  const card = page.locator('[data-channel="LinkedIn"]')
  await expect(card.getByTestId('click-count')).toHaveText('0')
  await expect(card.getByTestId('click-rate')).toHaveText('n/a')
  await expect(card.getByTestId('outcome-rate')).toHaveText('n/a')

  // A visitor clicks; the open page updates by itself (no reload, no polling).
  const link = await card.getByTestId('tracked-link').inputValue()
  const res = await visit(page, link.split('/go/')[1])
  expect(res.status()).toBe(302)
  expect(res.headers()['location']).toBe('https://example.com/landing')
  await expect(card.getByTestId('click-count')).toHaveText('1', { timeout: 10_000 })
  await expect(page.getByTestId('clicks-by-day')).toContainText(new Date().toISOString().slice(5, 10))

  // Rates appear only once reach is entered.
  await card.getByLabel('Reach').fill('ten')
  await card.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(card.getByText('Reach must be a whole number, or blank.')).toBeVisible()
  await card.getByLabel('Reach').fill('200')
  await card.getByLabel('Outcome count').fill('1')
  await card.getByLabel('Outcome label').fill('Signups')
  await card.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(card.getByTestId('click-rate')).toHaveText('0.5%')
  await expect(card.getByTestId('outcome-rate')).toHaveText('100%')
  await expect(page.locator('[data-channel="Newsletter"]').getByTestId('click-rate')).toHaveText('n/a')

  await page.reload()
  await expect(page.locator('[data-channel="LinkedIn"]').getByTestId('click-rate')).toHaveText('0.5%', { timeout: 15_000 })
})

test('the decision can be set with a reason and is saved', async ({ users }) => {
  const [a] = await users(1)
  await signedInAt(a.page, '/experiments')
  const expId = await newExperiment(a.page)
  await a.page.goto(`/experiments/${expId}`)
  await expect(a.page.getByTestId('experiment-title')).toBeVisible({ timeout: 15_000 })
  await expect(a.page.getByTestId('decision-badge')).toHaveCount(0)

  await a.page.getByText('Keep', { exact: true }).click()
  await a.page.getByLabel('Reason').fill('Signups per click doubled')
  await a.page.getByRole('button', { name: 'Save decision' }).click()
  await expect(a.page.getByText('Decision saved.')).toBeVisible()
  await expect(a.page.getByTestId('decision-badge')).toHaveText('keep')

  await a.page.reload()
  await expect(a.page.getByTestId('decision-badge')).toHaveText('keep', { timeout: 15_000 })
  await expect(a.page.getByLabel('Reason')).toHaveValue('Signups per click doubled')
  const saved = await tool(a.page, 'records_get', { collection: 'experiments', recordId: expId })
  expect(saved.result?.data?.record?.data).toMatchObject({ decision: 'keep', decisionReason: 'Signups per click doubled' })
})

test('channels can be renamed, and deleted only when they have no clicks', async ({ users }) => {
  const [a] = await users(1)
  await signedInAt(a.page, '/experiments')
  const page = a.page
  const expId = await newExperiment(page)
  const busy = await newChannel(page, expId, 'Busy')
  await newChannel(page, expId, 'Quiet')
  await newChannel(page, expId, 'Spare')
  expect((await visit(page, busy.slug)).status()).toBe(302)
  await page.goto(`/experiments/${expId}`)
  await expect(page.getByTestId('variant-row')).toHaveCount(3, { timeout: 15_000 })

  // Rename.
  const quiet = page.locator('[data-channel="Quiet"]')
  await quiet.getByRole('button', { name: 'Rename' }).click()
  await quiet.getByLabel('New channel name').fill('Quiet newsletter')
  await quiet.getByRole('button', { name: 'Save name' }).click()
  await expect(page.locator('[data-channel="Quiet newsletter"]').getByTestId('channel-name')).toHaveText('Quiet newsletter')

  // A channel with clicks cannot be deleted, in the screen or on the server.
  const busyCard = page.locator('[data-channel="Busy"]')
  await expect(busyCard.getByTestId('click-count')).toHaveText('1', { timeout: 10_000 })
  await expect(busyCard.getByRole('button', { name: 'Delete channel' })).toBeDisabled()
  expect(await action(page, 'deleteChannel', { variantId: busy.id })).toMatchObject({ success: false })

  // A channel without clicks is deleted after confirming.
  const spare = page.locator('[data-channel="Spare"]')
  await spare.getByRole('button', { name: 'Delete channel' }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByTestId('variant-row')).toHaveCount(3)
  await spare.getByRole('button', { name: 'Delete channel' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete channel' }).click()
  await expect(page.getByTestId('variant-row')).toHaveCount(2, { timeout: 10_000 })

  // At 2 channels the screen will not delete more.
  await expect(page.locator('[data-channel="Quiet newsletter"]').getByRole('button', { name: 'Delete channel' })).toBeDisabled()
})
