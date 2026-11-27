# Channel Lab

A go-to-market experiment tracker for a small team. You write down an experiment (hypothesis, audience, success metric, destination link), add 2 to 4 channels, and get one tracked link per channel. Clicks show up live. You type in reach and outcomes by hand, read simple per-channel rates, can ask for an AI readout that must cite its numbers, and mark the experiment keep, change or stop.

- **Live:** https://channel-lab.app.space (sign in with Google or GitHub; open to anyone so reviewers can test)
- **Source:** https://github.com/lichtszn/channel-lab
- **Built on:** DeepSpace only (SDK 0.44.2 starter template). No other backend.

## What works

- Public landing page, then sign-in with Google or GitHub.
- My experiments list, and a form to create one.
- An experiment page with:
  - 2 to 4 channels, each with a copyable tracked link `https://channel-lab.app.space/go/<slug>`;
  - live click counts per channel, and clicks per day for the last 14 days (UTC). They update by themselves, with no polling;
  - hand-entered reach, outcome count and outcome label per channel;
  - clicks per reach and outcomes per click, shown as "n/a" until reach is entered. They are plain ratios, not a significance test;
  - rename a channel; delete a channel after confirming (only if it has no clicks);
  - a decision (keep, change, stop or undecided) with a short reason;
  - a "Generate readout" button: a short AI memo naming the leading channel and quoting its numbers, with the numbers it was given shown beside it. **On in production since 2026-11-27** (see below).
- The tracked link redirects to the experiment's destination and logs one click.

## DeepSpace features used, and why

| Feature | How Channel Lab uses it | Why |
|---|---|---|
| **Auth** (Google and GitHub sign-in, `AuthGate`) | Every page except the landing page and `/go/:slug` needs sign-in. Signed-out visitors get a "Sign in to continue" panel, never a blank page. | Reviewers can sign in with an account they already have. No passwords to store. |
| **Records** (collections, live `useQuery` subscriptions) | `experiments`, `variants` (channels), `clicks`, `readout_usage`. The experiment page subscribes to its clicks, so counts update when someone clicks. | Live counts with no polling and no extra server. |
| **Permissions** (`ownerField`, `userBound`, `immutable`, `writableFields`, `uniqueOn`) | Each user reads and edits only their own experiments, channels and clicks. The owner field is stamped by the server and can't be changed. Clients may edit only 4 experiment fields. Slugs are unique and never change. | Privacy between users is enforced by the database, not by the screens. |
| **Server actions** | `createExperiment` (http(s) destinations only), `setDecision` (only none/keep/change/stop), `deleteChannel` (refuses channels with clicks), `generateReadout`, `readoutSettings`. Each loads the row and checks the caller owns it. | Rules that the record permissions can't express, and anything that costs money, run on the server. |
| **Public worker route + Cloudflare rate limiting** (`[[ratelimits]]`) | `/go/:slug` is the one public route: look up the channel, apply 10/min per IP and 120/min per slug, write one click row (no visitor data), redirect. | Visitors click without signing in, and the limiter is a coarse abuse filter. |
| **AI integration proxy** (`anthropic/chat-completion`, `billing: 'developer'`) | `generateReadout` (`claude-haiku-5-5`), **on in production since 2026-11-27**, capped at 3 per user and 10 per app per UTC day. | One short memo that must cite only the numbers it was given. The caps bound what the owner can spend. |
| **Secrets** (`npx deepspace secrets`) | `READOUT_ENABLED` is the on/off switch. Production holds only this secret, set to `true` by the user on 2026-11-27. | No keys or switches in the repo. |
| **Deploy, GitHub as source** | `npx deepspace deploy` from a clean tree; GitHub is locked in as the source. `deepspace push` is never used. | The code people review is the code that runs. |
| **Local dev and test tooling** (`deepspace dev`, test accounts) | Two DeepSpace test accounts run the two-user privacy tests against a real local record room. | Proves user B can't read or edit user A's data. |

## Left out on purpose

- **Weekly email digest.** Not built. It would add a second paid service and scheduled spending with no signed-in user; the AI readout is the only paid feature. The cron table is empty.
- **Cron and background jobs.** In the template, but empty, and locked to admins so a member can't trigger anything paid.
- **In-app AI chat** (template). Off: it has no per-user daily cap.
- **Template paid-integration route** `/api/integrations/:name/:endpoint`. Closed (403), so nobody can call paid services directly and skip the caps.
- **Template file uploads** `/api/files/*`. Closed (404) in the final security review: the app stores no files, and the route let any signed-in user upload files under the app's origin.
- **Payments.** No products; not needed.
- **An exact click counter.** The Cloudflare limiter is enough as an abuse filter for now (see the main tradeoff).

## Main tradeoff

The app deliberately chose **approximate click counts with no visitor data** over exact counts. The public link stores only which channel was clicked, whose experiment it is, and when: never an IP address or anything else about the visitor. Abuse is held back by Cloudflare's rate limiter, which is simple and free but leaky. In live tests from one IP it counted 40 of 40 clicks in a 2-second burst, 50 of 50 over 41 seconds, and 130 of 200 in a 13-second burst, so one visitor can inflate a count. Exact per-slug counting needs a dedicated counter, and that was postponed. To keep this honest, every screen says counts are approximate and that a click is not a signup, rates are plain ratios, and the AI readout must say the same and may not claim significance.

## AI readout (ON since 2026-11-27)

**It is ON in production.** The user set `READOUT_ENABLED=true` on 2026-11-27. Real readouts bill the owner's DeepSpace credits, within the caps below. If it is ever switched off, the button is disabled and says: "AI readout is switched off to avoid cost. It is fully built and tested with a fake model.", and the server refuses before claiming a cap slot or calling anything.

- **Who:** only the signed-in owner of the experiment. The app owner pays.
- **Caps:** 3 per person and 10 for the whole app per UTC day. Each request claims a numbered slot in `readout_usage` (`uniqueOn` scope, day, slot) before any paid call. Tested with 8 simultaneous requests on the real local database: exactly 3 succeeded. A slot is used even if the AI fails or its memo is rejected.
- **Model:** `claude-haiku-5-5`, the cheapest suitable model; temperature 0, at most 3000 output tokens. The model reasons before it answers and those reasoning tokens count against this limit, so it must leave room for the memo; the first limit, 700, did not (see below).
- **What the AI sees:** only, per channel, the name, clicks, reach, outcome count and outcome label, plus the hypothesis and success metric. No titles, ids, slugs, links or user data.
- **Number check:** every number in the memo must appear in that data, and the memo must say counts are approximate, name a channel, and not claim significance. Otherwise you get an error and "Try again", never the memo. The check is strict, so a memo with a date or a computed percentage is rejected (and uses a slot).
- **Not saved:** a readout is shown once; reloading clears it.
- **Tests never call the AI.** A fake model works only where `ALLOW_DEBUG_ROUTES` is on (local). The agent has never made a real call; only the user clicks.
- **First real readout (2026-11-27 01:13 UTC) failed.** The production log said the whole 700-token budget was used up by reasoning before any answer was written. The call was billed (US$0.00055302) and used a slot. The limit is now 3000.
- **Second real readout (2026-11-27 02:45 UTC, after the 3000-token fix) succeeded.** The real reply parsed (`memoText` read its text), the memo passed the number check, and it was shown. It cost US$0.00084396 and was the user's 2nd of 3 readouts that day.

**Turning it off** (a secret, not code; takes effect at the next deploy):

```bash
npx deepspace secrets delete READOUT_ENABLED     # off
npx deepspace deploy
```

To turn it back on: `npx deepspace secrets set READOUT_ENABLED=true`, then `npx deepspace deploy`.

Only the exact value `true` turns it on.

**Cost (checked 2026-11-26 without any paid call):** DeepSpace bills AI at the provider's actual cost plus a markup, with no fixed per-call price published. The account is on the free plan with 500 credits (US$5). About 0.02 credits (roughly US$0.0002) had been used, none of it by integrations; the source of that small usage wasn't found. Only integration calls are listed as charges. If credits run out, paid calls fail with `insufficient_credits`, which the readout shows as its error. Just before the readout went on (2026-11-27 01:10 UTC): 499.972 credits remaining, no integration usage. The first real call (the failed one, about 700 tokens of reasoning) cost US$0.00055302 (about 0.055 credits). The second (the first successful one) cost US$0.00084396 (about 0.084 credits). It was billed as a US$0.00204802 hold, then a refund of US$0.00120406 once the real usage was known. Total AI spend so far: US$0.00139698 over 2 calls, 499.828 credits remaining. At about US$0.00084 a readout, the 10-a-day app cap means roughly US$0.01 a day at most. That is based on one successful call, not a published price; `npx deepspace app usage` shows the real figures.

## Who can see what

- **Experiments and channels:** only your own. The app owner can't see other users' rows in the app either.
- **Clicks:** only clicks on your own experiments. A click row stores the channel, experiment, experiment owner and time, never visitor data.
- **Owner field:** stamped by the server and immutable, so nobody can create rows in someone else's name.
- **Tracked links:** a link only works if the same person owns the channel and the experiment, and only to http(s) destinations.
- **Deleting:** nobody can delete experiments. Channels with clicks can't be deleted, so click data is never orphaned.
- **Signed-out visitors** see only the landing page and can follow tracked links.

## Data notes

- **Older clicks were copied once.** Clicks from before 2026-11-26 05:53 UTC lacked an experiment and owner, so nobody could see them. A one-off, owner-only migration copied all 33 into new rows (ids start `bf-`) with the original time: iMessage 19, Class Groupchat 7, LinkedIn 4, Instagram Story 3. The originals stay untouched as an audit trail and invisible in the app, so nothing is counted twice. The temporary action has been removed; it returns 404.
- **Test data.** 232 click rows on the test variant `spike-test` come from the rate-limit tests, not real visitors. That slug no longer works.

## Known gaps

- Click counts are approximate (see the main tradeoff). The per-slug limit has only been tested locally.
- The 2 to 4 channels per experiment is enforced only in the screens; the server would accept more. There is also no server limit on how many experiments a user can create (no money at stake, only storage).
- Deleting a channel checks for clicks and then deletes. A click landing in that split second would be left without a channel.
- The experiment page loads every click row and counts them in the browser. Fine for a small team, slow with very many clicks.
- Experiment details (title, hypothesis, audience, metric, destination) can't be edited from a screen yet.
- One real readout has succeeded so far, after the first ran out of tokens while reasoning. If the model ever reasons past 3000 tokens, the same error returns. The strict number check can also reject a valid memo (for example one with a date or a percentage). Either way a slot is used.
- Readouts are not saved: reloading the page clears the memo.
- Every model failure shows the same "The AI service did not answer" message; the real reason is only in the production log.
- **Local runs can inherit the production switch.** `npx deepspace deploy` copies the production secrets into the local `.dev.vars` (under "App secrets · config prd"). On 2026-11-27 that put `READOUT_ENABLED=true` into local dev, so a local `generateReadout` without the fake model would have made a real, owner-billed call. The line was deleted by hand. **The next deploy may copy it back**, so check `.dev.vars` after every deploy while the readout is on, and delete that line before running tests. A code guard (refuse real calls wherever `ALLOW_DEBUG_ROUTES` is "true") was built and unit-tested, but not shipped: the full browser run didn't finish by the deadline, so the user's fallback applied.
- A GET request that carries a body (browsers never send one) to an app page such as `/home` gets a 500, because the template's page fallback re-reads the request body. Plain GETs are fine. Found in the final live check; not fixed.
- Template leftovers that stay on but are governed by permissions: the local-assistant tool routes (`/_deepspace/agent`) run with the caller's own permissions, and the records socket accepts any room id.

## What I'd do next

1. Build the exact per-slug click counter, so counts are exact and the limiter is only a backstop.
2. Keep running per-day click totals on the server, so pages don't need every click row.
3. Enforce the 2 to 4 channel limit, and a per-user experiment limit, on the server.
4. Screens to edit an experiment's details and destination.
5. Show a clearer error when the model runs out of tokens. Save readouts, and show how many are left today. Track the real cost per readout in `npx deepspace app usage`.
6. Build the weekly email digest (one per owner per week, counted against the app-wide cap).

## Development

```bash
npm install
npx deepspace dev start --host 127.0.0.1
npm run type-check && npm run lint && npm run test:unit
npx playwright test -c tests/playwright.config.ts --workers=1 tests/<file>.spec.ts   # one file at a time
```

Agent and decision history: [AGENT_LOG.md](AGENT_LOG.md).
