# Channel Lab

A GTM experiment tracker for a small team, built on DeepSpace: log experiments, get a tracked link per channel, see live clicks, record outcomes by hand, get an AI readout that cites its numbers, and mark each experiment keep / change / stop.

Status: early. Live at https://channel-lab.app.space. Source: https://github.com/lichtszn/channel-lab.

## What works

- Public landing page, then sign-in with Google or GitHub.
- My experiments list and a create-experiment form.
- An experiment page with:
  - 2 to 4 channels, each with a copyable tracked link: `https://channel-lab.app.space/go/<slug>`;
  - live click counts per channel and clicks per day for the last 14 days (UTC). They update by themselves when someone clicks, with no polling;
  - hand-entered reach (people who could see it), outcome count and outcome label per channel;
  - rates per channel: clicks per reach, and outcomes per click. Both show "n/a" until reach is entered. They are simple ratios, not a significance test;
  - rename a channel, and delete a channel after confirming;
  - a decision (keep, change, stop or undecided) with a short reason;
  - a "Generate readout" button: a short AI memo naming the leading channel, quoting its numbers, with the numbers it was given shown beside it.
- The tracked link redirects to the experiment's destination and logs one click.

## Who can see what

- **Experiments and channels:** you see and change only your own. Other users cannot read, edit or delete them, and the app owner cannot see them in the app either.
- **Click counts:** you see clicks only on your own experiments. A click row records which channel and experiment, whose experiment it is, and when. It never records anything about the visitor, such as an IP address.
- **Owner field:** the server stamps each experiment and channel with its creator, and nobody can change it, so you cannot create rows in someone else's name.
- **Server-checked values:** new experiments, decisions and destinations go through server actions that accept only `http://` or `https://` destinations and only the decisions keep, change, stop or none. Title, hypothesis, audience and success metric are the only experiment fields you can edit directly, and no screen edits them yet.
- **Deleting:** nobody can delete experiments. Channels are deleted only through a server action that refuses any channel with clicks, so click data is never orphaned. Rename a channel instead.
- **Tracked links:** each slug is unique and never changes. A link only works if the same person owns the channel and the experiment.
- **Signed-out visitors** see only the landing page and can follow tracked links.

## AI readout

**It is switched OFF in production by default, to avoid cost.** The button is disabled and says: "AI readout is switched off to avoid cost. It is fully built and tested with a fake model." The server refuses too, before claiming a cap slot or calling anything.

- **Who:** only the signed-in owner of the experiment. The app owner pays (`billing: 'developer'`).
- **Caps:** 3 readouts per person and 10 for the whole app per UTC day. Each request claims a numbered slot (1 to 3 per person, 1 to 10 for the app) in a `readout_usage` table that refuses duplicates (`uniqueOn`), before any paid call. Tested with 8 simultaneous requests against the real local database: exactly 3 succeeded. A slot is used even when the AI fails or its memo is rejected, because the call was already paid for.
- **Model:** `claude-haiku-5-5`, the cheapest suitable model, through the platform's `anthropic/chat-completion` (temperature 0, at most 700 output tokens).
- **What the AI sees:** only, per channel, clicks, reach, outcome count and outcome label, plus the hypothesis and success metric.
- **Number check:** every number in the memo must appear in that data, and the memo must say click counts are approximate, name a channel, and not claim statistical significance. If not, you get an error and a "Try again" button instead of the memo. The check is strict, so a valid memo that writes a date or a computed percentage is rejected and uses a slot.
- **Not saved:** a readout is shown once; reloading the page clears it.
- **Testing:** tests never call the AI. A fake model is used, and only works where `ALLOW_DEBUG_ROUTES` is on (local development). No real readout has ever been generated, so the reply format of the live AI service is untested.

### Turning it on or off

The switch is a DeepSpace secret, not code. It takes effect at the next deploy:

```bash
npx deepspace secrets set READOUT_ENABLED=true   # on
npx deepspace deploy
```

```bash
npx deepspace secrets delete READOUT_ENABLED     # off (the default)
npx deepspace deploy
```

Only the exact value `true` turns it on.

### What it costs (checked 2026-11-26, without making any paid call)

- **Price per readout:** DeepSpace does not publish a fixed price. The catalog (`npx deepspace integrations info anthropic/chat-completion`) bills "the provider's actual cost plus a platform markup", varying with input size, and says free-tier pricing differs from paid-tier pricing except for `claude-haiku-5-5`, which gets standard pricing. Each readout sends one short prompt and gets up to 700 tokens back. The real cost would only be known from `npx deepspace app usage` after a first call.
- **Your balance:** free plan, 500 credits (100 credits = US$1, so US$5). `app usage` showed 499.985 remaining early on 2026-11-26 and 499.978 after that day's deploys: about 0.02 credits (roughly US$0.0002) used in total, not itemized and not from any integration. The source of that small usage was not found. No credits purchased, no renewal date shown, no integration usage in the last 30 days.
- **What else is billed:** the docs and the usage report list charges only for integration calls (AI, email and similar). No hosting, deploy or record charges appear. The free plan's limits are quotas, not charges: a cap on active apps and 128 MiB of file storage.
- **If credits run out:** paid calls fail with an `insufficient_credits` error until the account is topped up; the readout would show its error and retry message. With no card or purchased credits, nothing can be charged beyond the balance.

## Known limitations

**Click counts are approximate.** The public link `/go/:slug` uses Cloudflare's rate limiter as a coarse abuse filter (10 clicks per minute per IP, 120 per minute per slug). Clicks over a limit still redirect but are not counted. A click is not a signup.

- The per-IP limit is leaky on the live site. In tests on 2026-11-25 from one IP, it counted 40 of 40 clicks in a 2-second parallel burst, 11 of 40 on one reused connection, 50 of 50 over 41 seconds, and 130 of 200 in a 13-second burst. One visitor can inflate a count. (An earlier version of this note said 26 of 200 for the last burst; that read was cut off by a page-size limit.)
- The per-slug limit has only been tested locally, where it was exact. It was not reached in the live tests.

**Older clicks were copied once.** Clicks recorded before 2026-11-26 05:53 UTC did not say which experiment or owner they belonged to, so nobody could see them, and their columns cannot be changed. On 2026-11-26 at 06:06 UTC a one-off, owner-only migration copied each one into a new row with the experiment and owner filled in and the original click time kept: 33 copies (iMessage 19, Class Groupchat 7, LinkedIn 4, Instagram Story 3). The original rows are kept, unchanged, as an audit trail; they stay invisible in the app, so nothing is counted twice. The copies have ids starting `bf-`. Spike-test rows were not copied. Re-running copied nothing. The temporary action was removed in the next deploy.

**Test data.** The live `clicks` table holds 232 rows from the click tests (earlier notes said 128; that count was cut off by a page-size limit). They are on the test variant `spike-test` and are not real visitors. That slug is no longer a working link.

**Checks that run in the screens only.** The 2 to 4 channels per experiment is enforced in the screens; the server would accept more.

**Live click counts load every click row.** The experiment page subscribes to all of an experiment's click rows and counts them in the browser. That is fine for a small team, but would get slow with very many clicks.

**Template test fixed (2026-11-26).** The scaffold's test "API status page renders loading success and error states" (`tests/collab.spec.ts`) used to fail intermittently, then every time: its fake catalog answered after 100 ms, and on this machine the page had already left the loading state before the test looked. The fake answer now waits until the test has seen the loading state, so the same states are checked without the race.

## What I'd do next

- Add an exact per-slug counter to replace the approximate limit.
- Keep running per-day click totals on the server, so pages do not need every click row.
- Enforce the 2 to 4 channel limit on the server.
- Let users edit an experiment's title, hypothesis, audience, success metric and destination.
- Save readouts so they survive a reload, and show how many are left today.
- Measure the real cost of one readout (it is off until then) before deciding whether to turn it on.
- Build the weekly email digest.
