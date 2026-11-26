/**
 * Multi-user collaboration spec — verifies two users sign in into
 * separate browser contexts and the app distinguishes them.
 *
 * `users(2)` takes any two accounts from your pool, so this spec passes on a
 * fresh app with no setup beyond having two test accounts:
 *   npx deepspace test accounts list
 *   npx deepspace test accounts create --email a@deepspace.test --name "A" --password-stdin
 *
 * Ask for accounts *by name* (`users(['Alice', 'Bob'])`) only when the
 * behaviour under test depends on which identity acts — otherwise naming them
 * couples the spec to one machine's pool.
 *
 * The `users` fixture handles sign-in caching (per-account storageState
 * persisted to `~/.deepspace/playwright-states/`), context creation, and
 * cleanup. No need to manage browser contexts manually.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

// A machine that has never created test accounts is the normal state of a
// fresh checkout, and there `users()` throws — turning "you have no pool yet"
// into three red tests about the app, which it is not. Skip the file instead
// and say what creates the pool. The count is of accounts usable HERE: the
// pool is global per developer, but passwords live only on the machine that
// created the account.
const usableTestAccounts = loadAllTestAccounts().length
test.skip(
  usableTestAccounts < 2,
  `Needs 2 usable test accounts, found ${usableTestAccounts}. Create them with ` +
    '`npx deepspace test accounts create --email <name>@deepspace.test --name "<name>" ' +
    '--password-stdin`, or fetch existing pool accounts with `npx deepspace test accounts recover --all`.',
)

test('each browser renders its own signed-in account', async ({ users }) => {
  const [a, b] = await users(2)

  // /home is dynamic (under src/pages/(app)/), so it mounts the nav shell;
  // '/' is the static landing and has no navigation.
  await Promise.all([a.page.goto('/home'), b.page.goto('/home')])

  // Email, not name. The page renders the *session's* `name || email`, while
  // `user.name` here comes from the LOCAL account registry — and the two are
  // not the same fact: a display name is optional, and an account recovered on
  // another machine has none stored locally at all. The email is the credential
  // the context signed in with, so it is the one identity both sides agree on,
  // and asserting it proves the page is showing THIS browser's account.
  // The two accounts are distinct, so two exact matches is also the proof that
  // the contexts are not sharing one session.
  for (const user of [a, b]) {
    await expect(user.page.getByTestId('app-navigation')).toBeVisible({ timeout: 15_000 })

    // The identity chip shows `name || email`. Its text is not predictable, but
    // its presence is: something must be there once the profile has loaded.
    // (It is `hidden sm:inline` in some templates, so assert text, not
    // visibility.)
    await expect(user.page.getByTestId('nav-user-name')).toHaveText(/\S/, { timeout: 15_000 })

    await user.page.getByRole('button', { name: 'Account menu' }).click()
    await expect(user.page.getByTestId('nav-user-email')).toHaveText(user.email, {
      timeout: 15_000,
    })
  }
})

test('API status page renders loading success and error states', async ({ users }) => {
  const [user] = await users(1)
  let shouldFail = false
  let requestCount = 0

  await user.page.route('**/api/integrations', async (route) => {
    requestCount += 1
    if (shouldFail) {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Catalog unavailable' }),
      })
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { integrations: { openai: {}, wikipedia: {} } } }),
    })
  })

  await user.page.goto('/api-status')
  await expect(user.page.getByText('Loading integration catalog...')).toBeVisible()
  await expect(user.page.getByText('Integration catalog ready')).toBeVisible()
  await expect(user.page.getByText('2 integrations available.')).toBeVisible()

  shouldFail = true
  await user.page.getByRole('button', { name: 'Refresh' }).click()
  await expect(user.page.getByText('Catalog unavailable')).toBeVisible()
  await expect(user.page.getByText('Showing the last loaded catalog')).toBeVisible()
  await expect(user.page.getByText('Integration catalog ready')).toBeVisible()

  const urlAfterFailure = user.page.url()
  const requestsAfterFailure = requestCount
  await user.page.getByRole('button', { name: 'Refresh' }).click()
  await expect.poll(() => requestCount).toBeGreaterThan(requestsAfterFailure)
  expect(user.page.url()).toBe(urlAfterFailure)
})

test('API status page shows local retry after first-load API failure', async ({ users }) => {
  const [user] = await users(1)
  let requestCount = 0

  await user.page.route('**/api/integrations', async (route) => {
    requestCount += 1
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'Catalog unavailable' }),
    })
  })

  await user.page.goto('/api-status')
  await expect(user.page.getByText('Loading integration catalog...')).toBeVisible()
  await expect(user.page.getByText('Could not load API data')).toBeVisible()
  await expect(user.page.getByText('Retried 1 time automatically.')).toBeVisible()

  const retryButton = user.page.getByRole('button', { name: 'Retry' })
  await expect(retryButton).toBeVisible()

  const urlAfterFailure = user.page.url()
  const requestsAfterFailure = requestCount
  await retryButton.click()
  await expect.poll(() => requestCount).toBeGreaterThan(requestsAfterFailure)
  expect(user.page.url()).toBe(urlAfterFailure)
})

/** Opens a room socket as this signed-in user, sends one frame, returns the replies. */
async function sendToRoom(page: import('@playwright/test').Page, room: 'cron' | 'jobs', frame: object) {
  return page.evaluate(
    async ({ room, frame }) => {
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const { token } = (await res.json()) as { token: string }
      const { sub } = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      const url = new URL(`/ws/${room}/member-check`, location.href)
      url.protocol = url.protocol.replace('http', 'ws')
      url.searchParams.set('token', token)
      const frames: { type: string; payload?: Record<string, unknown> }[] = []
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(url)
        ws.onopen = () => ws.send(JSON.stringify(frame))
        ws.onmessage = (e) => frames.push(JSON.parse(e.data))
        ws.onerror = () => reject(new Error('socket failed'))
        setTimeout(() => (ws.close(), resolve()), 3000)
      })
      return { signedIn: Boolean(sub), frames }
    },
    { room, frame },
  )
}

test('a member cannot trigger cron tasks', async ({ users }) => {
  const [user] = await users(1)
  await user.page.goto('/home')
  await expect(user.page.getByTestId('nav-user-name')).toHaveText(/\S/, { timeout: 15_000 })
  const { signedIn, frames } = await sendToRoom(user.page, 'cron', {
    type: 'cron.trigger',
    payload: { taskName: 'no-such-task', requestId: 'r1' },
  })
  expect(signedIn).toBe(true)
  // A writer would get `unknown_task` here; `read_only` is the role refusal.
  expect(JSON.stringify(frames)).toContain('read_only')
  expect(JSON.stringify(frames)).not.toContain('unknown_task')
})

test('a member cannot queue background jobs', async ({ users }) => {
  const [user] = await users(1)
  await user.page.goto('/home')
  await expect(user.page.getByTestId('nav-user-name')).toHaveText(/\S/, { timeout: 15_000 })
  const { signedIn, frames } = await sendToRoom(user.page, 'jobs', {
    type: 'job.enqueue',
    payload: { type: 'member-check', payload: {}, requestId: 'r1' },
  })
  expect(signedIn).toBe(true)
  expect(JSON.stringify(frames)).toContain('Write access denied')
})

test('a member reads only clicks on their own experiments, and cannot create any', async ({ users }) => {
  const [user] = await users(1)
  await user.page.goto('/home')
  await expect(user.page.getByTestId('nav-user-name')).toHaveText(/\S/, { timeout: 15_000 })
  const call = (tool: string, input: object) =>
    user.page.evaluate(
      async ({ tool, input }) => {
        const auth = await fetch('/api/auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        const { token } = (await auth.json()) as { token: string }
        const res = await fetch(`/_deepspace/agent/browser/tools/${tool}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ input }),
        })
        return { status: res.status, body: await res.text() }
      },
      { tool, input },
    )
  const me = JSON.parse((await call('user_current', {})).body).result.data
  const myId = me?.user?.id ?? me?.id
  // Local click rows from other accounts and the old spike exist; none may show.
  const read = await call('records_query', { collection: 'clicks', limit: 500 })
  expect(read.status).toBe(200)
  const rows = JSON.parse(read.body).result.data.records as { data: { ownerId?: string } }[]
  for (const row of rows) expect(row.data.ownerId).toBe(myId)
  const create = await call('records_create', {
    collection: 'clicks',
    data: { variant: 'forged', clickedAt: '2026-01-01T00:00:00Z', ownerId: myId },
  })
  expect(create.status).toBe(422)
  expect(create.body).toContain('CREATE DENIED')
})
