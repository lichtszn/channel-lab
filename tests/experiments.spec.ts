/**
 * Experiments and variants: per-user privacy, the screens, and the click route
 * for a real variant. Needs two usable test accounts (see collab.spec.ts).
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { Page } from '@playwright/test'
import { countLocalClicks } from './helpers/local-clicks'

test.skip(loadAllTestAccounts().length < 2, 'Needs 2 usable test accounts')

type ToolReply = { status: number; ok: boolean; result?: { success: boolean; error?: string; data?: any }; error?: string }

/** Calls a record tool AS the signed-in user, so normal permissions apply. */
async function asUser(page: Page, tool: string, input: object): Promise<ToolReply> {
  return page.evaluate(
    async ({ tool, input }) => {
      const auth = await fetch('/api/auth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      const { token } = (await auth.json()) as { token: string }
      const res = await fetch(`/_deepspace/agent/browser/tools/${tool}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ input }),
      })
      return { status: res.status, ...(await res.json()) }
    },
    { tool, input },
  )
}

async function signedInAt(page: Page, path: string) {
  await page.goto(path)
  await expect(page.getByTestId('nav-user-name')).toHaveText(/\S/, { timeout: 15_000 })
}

/** A tool call that the server refused, whatever the exact refusal shape. */
function refused(reply: ToolReply): boolean {
  return reply.ok === false || reply.result?.success === false
}

const randomSlug = () =>
  Array.from({ length: 8 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('')

const tag = () => `__test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}__`

test('user B cannot read or change user A experiments or variants', async ({ users }) => {
  const [a, b] = await users(2)
  await Promise.all([signedInAt(a.page, '/experiments'), signedInAt(b.page, '/experiments')])
  const me = (await asUser(a.page, 'user_current', {})).result?.data
  const aId = me?.user?.id ?? me?.id
  expect(typeof aId).toBe('string')

  const exp = await asUser(a.page, 'records_create', {
    collection: 'experiments',
    data: { title: `${tag()} A private`, destinationUrl: 'https://example.com/a' },
  })
  const expId = exp.result?.data?.recordId as string
  expect(expId).toBeTruthy()
  const variant = await asUser(a.page, 'records_create', {
    collection: 'variants',
    data: { experimentId: expId, channelName: 'A channel', slug: randomSlug() },
  })
  const variantId = variant.result?.data?.recordId as string
  expect(variantId).toBeTruthy()

  try {
    for (const [collection, id] of [['experiments', expId], ['variants', variantId]] as const) {
      const list = await asUser(b.page, 'records_query', { collection })
      expect(JSON.stringify(list.result?.data?.records ?? [])).not.toContain(id)
      expect(refused(await asUser(b.page, 'records_get', { collection, recordId: id }))).toBe(true)
      expect(refused(await asUser(b.page, 'records_update', { collection, recordId: id, data: collection === 'experiments' ? { title: 'hijacked' } : { channelName: 'hijacked' } }))).toBe(true)
      expect(refused(await asUser(b.page, 'records_delete', { collection, recordId: id }))).toBe(true)
    }
    // A still sees the untouched rows.
    const mine = await asUser(a.page, 'records_get', { collection: 'experiments', recordId: expId })
    expect(mine.result?.data?.record?.data?.title).toContain('A private')

    // B cannot plant a row in A's name: the owner column is set by the server.
    const forged = await asUser(b.page, 'records_create', {
      collection: 'experiments',
      data: { title: `${tag()} forged`, destinationUrl: 'https://example.com/b', ownerId: aId },
    })
    const forgedId = forged.result?.data?.recordId as string
    expect(forgedId).toBeTruthy()
    const aList = await asUser(a.page, 'records_query', { collection: 'experiments' })
    expect(JSON.stringify(aList.result?.data?.records ?? [])).not.toContain(forgedId)
    const forgedRow = await asUser(b.page, 'records_get', { collection: 'experiments', recordId: forgedId })
    expect(forgedRow.result?.data?.record?.data?.ownerId).not.toBe(aId)
    await asUser(b.page, 'records_delete', { collection: 'experiments', recordId: forgedId })

    // B's screen for A's experiment says not found.
    await b.page.goto(`/experiments/${expId}`)
    await expect(b.page.getByText('Experiment not found')).toBeVisible({ timeout: 15_000 })
  } finally {
    await asUser(a.page, 'records_delete', { collection: 'variants', recordId: variantId })
    await asUser(a.page, 'records_delete', { collection: 'experiments', recordId: expId })
  }
})

test('a variant pointing at someone else experiment gets no working link', async ({ users }) => {
  const [a, b] = await users(2)
  await Promise.all([signedInAt(a.page, '/experiments'), signedInAt(b.page, '/experiments')])
  const exp = await asUser(a.page, 'records_create', {
    collection: 'experiments',
    data: { title: `${tag()} A target`, destinationUrl: 'https://example.com/a-only' },
  })
  const expId = exp.result?.data?.recordId as string
  const slug = randomSlug()
  const planted = await asUser(b.page, 'records_create', {
    collection: 'variants',
    data: { experimentId: expId, channelName: 'planted', slug },
  })
  const plantedId = planted.result?.data?.recordId as string
  // Permissions allow it (B owns the variant); the click route must still refuse it.
  expect(plantedId).toBeTruthy()
  try {
    const res = await b.page.request.get(`/go/${slug}`, { maxRedirects: 0 })
    expect(res.status()).toBe(404)
    expect(countLocalClicks(plantedId)).toBe(0)
  } finally {
    await asUser(b.page, 'records_delete', { collection: 'variants', recordId: plantedId })
    await asUser(a.page, 'records_delete', { collection: 'experiments', recordId: expId })
  }
})

test('create an experiment, add channels, and a tracked link logs a click', async ({ users }) => {
  const [a] = await users(1)
  const page = a.page
  const title = `${tag()} Founder posts vs ads`

  await signedInAt(page, '/experiments')
  await page.getByRole('button', { name: 'New experiment' }).first().click()
  await expect(page).toHaveURL(/\/experiments\/new$/)

  // Validation keeps bad destinations out.
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Destination URL').fill('javascript:alert(1)')
  await page.getByRole('button', { name: 'Create experiment' }).click()
  await expect(page.getByText('The destination must be a full http:// or https:// link.')).toBeVisible()

  await page.getByLabel('Destination URL').fill('https://example.com/landing')
  await page.getByLabel('Hypothesis').fill('Founder posts convert better')
  await page.getByRole('button', { name: 'Create experiment' }).click()
  await expect(page.getByTestId('experiment-title')).toHaveText(title, { timeout: 15_000 })
  const expId = page.url().split('/').pop() as string
  await expect(page.getByTestId('variants-empty')).toBeVisible()

  for (const channel of ['LinkedIn', 'Newsletter']) {
    await page.getByLabel('Channel name').fill(channel)
    await page.getByRole('button', { name: 'Add channel' }).click()
    await expect(page.getByTestId('variant-row').filter({ hasText: channel })).toBeVisible({ timeout: 15_000 })
  }
  await expect(page.getByTestId('variant-row')).toHaveCount(2)
  const links = await page.getByTestId('tracked-link').evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))
  for (const link of links) expect(link).toMatch(/\/go\/[a-z0-9]{8}$/)

  // The list shows it.
  await page.goto('/experiments')
  await expect(page.getByTestId('experiments-list')).toContainText(title)

  // A signed-out visitor clicks the first tracked link.
  const slug = links[0].split('/go/')[1]
  const variants = await asUser(page, 'records_query', { collection: 'variants', where: { experimentId: expId } })
  const variant = (variants.result?.data?.records as { recordId: string; data: { slug: string } }[]).find((v) => v.data.slug === slug)!
  const before = countLocalClicks(variant.recordId)
  const res = await page.context().request.fetch(`/go/${slug}`, {
    maxRedirects: 0,
    headers: { Cookie: '', 'CF-Connecting-IP': `198.18.${Date.now() % 250}.${Math.floor(Math.random() * 250)}` },
  })
  expect(res.status()).toBe(302)
  expect(res.headers()['location']).toBe('https://example.com/landing')
  await expect.poll(() => countLocalClicks(variant.recordId)).toBe(before + 1)

  // Clean up the experiment and its channels (click rows stay, as designed).
  const all = variants.result?.data?.records as { recordId: string }[]
  for (const v of all) await asUser(page, 'records_delete', { collection: 'variants', recordId: v.recordId })
  await asUser(page, 'records_delete', { collection: 'experiments', recordId: expId })
})
