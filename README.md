# Channel Lab

A GTM experiment tracker for a small team, built on DeepSpace: log experiments, get a tracked link per channel, see live clicks, record outcomes by hand, get an AI readout that cites its numbers, and mark each experiment keep / change / stop.

Status: early. Live at https://channel-lab.app.space.

## What works

- Public landing page, then sign-in with Google or GitHub.
- My experiments list, create-experiment form, and an experiment page where you add 2 to 4 channels. Each channel gets a tracked link: `https://channel-lab.app.space/go/<slug>`.
- The tracked link redirects to the experiment's destination and logs one click.

Not built yet: editing outcomes and decisions, live click counts, the AI readout, email digests.

## Who can see what

- **Experiments and channels:** you see and change only your own. Other users cannot read, edit or delete them, and the app owner cannot see them in the app either.
- **Owner field:** the server stamps each row with its creator and nobody can change it, so you cannot create rows in someone else's name.
- **Tracked links:** each slug is unique and never changes. A link only works if the same person owns the channel and the experiment.
- **Clicks:** only the click link writes them, and only the app owner can read them for now. A click stores which channel and when, never an IP address.
- **Signed-out visitors** see only the landing page and can follow tracked links.

The 2 to 4 channel limit is enforced in the screens only.

## Known limitations

**Click counts are approximate.** The public link `/go/:slug` uses Cloudflare's rate limiter as a coarse abuse filter (10 clicks per minute per IP, 120 per minute per slug). Clicks over a limit still redirect but are not counted.

- The per-IP limit is leaky on the live site. In tests on 2026-11-25 from one IP, it counted 40 of 40 clicks in a 2-second parallel burst, 11 of 40 on one reused connection, 50 of 50 over 41 seconds, and 26 of 200 in a 13-second burst. One visitor can inflate a count.
- The per-slug limit has only been tested locally, where it was exact. It was not reached in the live tests.

**Test data.** The live `clicks` table holds 128 rows from those tests. They are on the test variant `spike-test` and are not real visitors. That slug is no longer a working link.

## What I'd do next

- Add an exact per-slug counter to replace the approximate limit.
