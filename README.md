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
  - a decision (keep, change, stop or undecided) with a short reason.
- The tracked link redirects to the experiment's destination and logs one click.

## Who can see what

- **Experiments and channels:** you see and change only your own. Other users cannot read, edit or delete them, and the app owner cannot see them in the app either.
- **Click counts:** you see clicks only on your own experiments. A click row records which channel and experiment, whose experiment it is, and when. It never records anything about the visitor, such as an IP address.
- **Owner field:** the server stamps each experiment and channel with its creator, and nobody can change it, so you cannot create rows in someone else's name.
- **Server-checked values:** new experiments, decisions and destinations go through server actions that accept only `http://` or `https://` destinations and only the decisions keep, change, stop or none. Title, hypothesis, audience and success metric are the only experiment fields you can edit directly, and no screen edits them yet.
- **Deleting:** nobody can delete experiments. Channels are deleted only through a server action that refuses any channel with clicks, so click data is never orphaned. Rename a channel instead.
- **Tracked links:** each slug is unique and never changes. A link only works if the same person owns the channel and the experiment.
- **Signed-out visitors** see only the landing page and can follow tracked links.

## Known limitations

**Click counts are approximate.** The public link `/go/:slug` uses Cloudflare's rate limiter as a coarse abuse filter (10 clicks per minute per IP, 120 per minute per slug). Clicks over a limit still redirect but are not counted. A click is not a signup.

- The per-IP limit is leaky on the live site. In tests on 2026-11-25 from one IP, it counted 40 of 40 clicks in a 2-second parallel burst, 11 of 40 on one reused connection, 50 of 50 over 41 seconds, and 26 of 200 in a 13-second burst. One visitor can inflate a count.
- The per-slug limit has only been tested locally, where it was exact. It was not reached in the live tests.

**Older clicks are not counted.** Clicks recorded before this version do not say which experiment or owner they belong to, so they do not appear in anyone's counts. That includes any click from manual testing on the earlier version.

**Test data.** The live `clicks` table holds 128 rows from the click tests. They are on the test variant `spike-test` and are not real visitors. That slug is no longer a working link.

**Checks that run in the screens only.** The 2 to 4 channels per experiment is enforced in the screens; the server would accept more.

**Live click counts load every click row.** The experiment page subscribes to all of an experiment's click rows and counts them in the browser. That is fine for a small team, but would get slow with very many clicks.

**Flaky template test.** The scaffold's test "API status page renders loading success and error states" (`tests/collab.spec.ts`) fails intermittently: run alone on 2026-11-25 it passed 1 of 3 times, and it failed the same way before any Channel Lab code existed. It waits for a loading message that is shown for only 100 ms. It is left unchanged.

## What I'd do next

- Add an exact per-slug counter to replace the approximate limit.
- Keep running per-day click totals on the server, so pages do not need every click row.
- Enforce the 2 to 4 channel limit on the server.
- Let users edit an experiment's title, hypothesis, audience, success metric and destination.
- Build the AI readout (5 per user per day, 50 per app per day) and the weekly email digest.
