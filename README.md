# Channel Lab

A GTM experiment tracker for a small team, built on DeepSpace: log experiments, get a tracked link per channel, see live clicks, record outcomes by hand, get an AI readout that cites its numbers, and mark each experiment keep / change / stop.

Status: early. Only the click-route spike is built so far. Live at https://channel-lab.app.space.

## Known limitations

**Click counts are approximate.** The public link `/go/:slug` uses Cloudflare's rate limiter as a coarse abuse filter (10 clicks per minute per IP, 120 per minute per slug). Clicks over a limit still redirect but are not counted.

- The per-IP limit is leaky on the live site. In tests on 2026-11-25 from one IP, it counted 40 of 40 clicks in a 2-second parallel burst, 11 of 40 on one reused connection, 50 of 50 over 41 seconds, and 26 of 200 in a 13-second burst. One visitor can inflate a count.
- The per-slug limit has only been tested locally, where it was exact. It was not reached in the live tests.

**Test data.** The live `clicks` table holds 128 rows from those tests. They are on the test variant `spike-test` and are not real visitors.

## What I'd do next

- Add an exact per-slug counter to replace the approximate limit.
