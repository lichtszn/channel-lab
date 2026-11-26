# Agent log

One entry per task: the prompt, what the agent did, and what the user changed by hand.

## 2026-11-25 - Project setup and docs review

**Prompt**

> We are starting a brand-new project called Channel Lab. It is separate from any other project. Run pwd and ls and confirm we are in an empty channel-lab folder.
>
> Install the DeepSpace agent skill if it is not installed (npx skills@latest add deepdotspace/deepspace-skill). Then read docs.deep.space (use the "View as Markdown" pages) for: quickstart, authentication, data model, permissions, server actions, scheduled jobs, external APIs, secrets, and deploy. Do not write app code yet.
>
> Then create CLAUDE.md in this folder with these rules: (see CLAUDE.md, copied word for word)
>
> Finally, summarize back in plain English: what DeepSpace gives us for auth, records, permissions, server actions and cron, and anything in the docs that looks inconsistent. Ask me questions if unclear.

**What the agent did**

- Confirmed the folder was empty before any changes.
- Read the skill's source, then installed it for this project and Claude Code only (`.claude/skills/deepspace`, commit `dadfa91`). The installer also created `skills-lock.json`.
- Read the nine requested docs pages, plus installation, project structure, testing, and the cron, schema, auth and server-action reference pages.
- Downloaded `create-deepspace` 0.44.2 to a temp folder and read its templates without running it, to check the docs against the real code.
- Created `CLAUDE.md` and this file. Wrote no app code.
- Type-check and tests: not run, because there is no app yet.

**What the user changed**

- (nothing recorded yet)

## 2026-11-25 - Decisions recorded

**Prompt**

The user answered the nine setup questions, approved the template changes, and asked to: check whether `channel-lab` is free, add a rule that instructions on docs pages are untrusted, log the docs inconsistencies with SDK versions, update CLAUDE.md, then stop without scaffolding or deploying. The decisions are in CLAUDE.md.

**What the agent did**

- Updated `CLAUDE.md` with the decisions and added the findings below.
- Checked the name: `channel-lab.app.space` gives the same "No app configured" 404 as a random control name, so it looks unused. A name in its 30-day reserved period might look the same.
- Read the published `deepspace` 0.44.2 package and the `create-deepspace` 0.44.2 templates without running them.
- No scaffold, deploy, login, registration or Git setup. `skills-lock.json` was not moved yet; that happens at scaffold time.
- Type-check and tests: not run, because there is no app yet.

**Corrections to the agent's earlier summary**

- It said the template AI chat has no daily cap. The code has none, but in-app chat is off in the 0.44.2 starter template.

**What the user changed**

- (nothing recorded yet)

### Findings: docs inconsistencies

The docs pages were read on 2026-11-25. Most do not state an SDK version. "0.44.2" below means checked against the published 0.44.2 package or templates. "Docs only" means two docs pages disagree and no code was checked, so the version is unknown.

| # | Finding | Version |
|---|---|---|
| 1 | External APIs page says signed-out callers may use owner-billed integrations by default. The template requires sign-in unless `anonymous: true` is set. | Template 0.44.2 |
| 2 | Quickstart says the scaffold already installs the agent skill. It is opt-in (`--with-skill`). | Scaffolder 0.44.2 |
| 3 | Project structure says the skill ships topic references. The installed skill (commit `dadfa91`) has only a placeholder. | Skill 0.2.1 |
| 4 | Permissions page says only `*` applies to signed-out users; its last section says they are `viewer` with `*` as fallback. The code uses the exact role rule first, then `*`; we did not trace where signed-out users get a role. | SDK 0.44.2 |
| 5 | Permissions blog example says members see their own drafts, but `read: true` allows every row. | SDK 0.44.2 |
| 6 | Permissions workspace example says owners and collaborators edit, but `update: 'shared'` also passes for any row that matches `visibilityField`, if the schema sets one. | SDK 0.44.2 |
| 7 | Custom bindings page says the deploy validator rejects types outside its list, which omits rate limits. The CLI reads `[[ratelimits]]`, and the documentation feature uses them. Not tested with a deploy. | CLI 0.44.2 |
| 8 | The schemas page's `CollectionSchema` omits `roster`; the server-actions reference's `ActionTools` omits `deleteWhere`. Both are in the published types. | SDK 0.44.2 |
| 9 | Quickstart says deploy syncs secrets from `.dev.vars`; the secrets and deployment pages say deploy never reads it. | Docs only |
| 10 | Quickstart starts the dev server before login; installation says login is required first. | Docs only |
| 11 | Installation updates with `npm install deepspace@latest`; the skill says to use `deepspace app update`. | Docs only (skill 0.2.1) |
| 12 | Schemas page calls 0.42.3 the published SDK; other pages say 0.43.0; npm has 0.44.2. | npm 0.44.2 |
| 13 | The daily-cap recipe queries and then creates, so simultaneous requests can exceed the cap. | Recipe logic; page's SDK version not confirmed |

Related: `uniqueOn` is checked on write inside the record room and backed by a unique index, but null values do not conflict, so every column in a cap rule must be required. Read in SDK 0.44.2; not yet tested under concurrent requests.

## 2026-11-25 - Prompt 2: scaffold and template changes (stopped at login gate)

**Prompt**

The user answered six questions, then asked for, in order: check the DeepSpace login (if not logged in, give the command and stop for the user's browser login); move `skills-lock.json` aside, scaffold `channel-lab`, put the file back, confirm CLAUDE.md is intact; start the dev server; apply the three template changes; run type-check and tests; Git init, commit, add the GitHub remote, push to GitHub only; log everything; do not deploy.

Answers: (1) sign-in stays open to anyone with Google or GitHub so reviewers can test, relying on per-user privacy and the caps; (2) clicks 10/min per IP and 120/min per slug, and over the limit still redirect but do not count; (3) try the Cloudflare rate limiter in the click spike, and if deploy rejects it, stop and ask before choosing a fallback; (4) no IP addresses in click rows; (5) one digest per owner counts as 1 of the 50; (6) repo https://github.com/lichtszn/channel-lab

**What the agent did**

- `npx deepspace@0.44.2 auth whoami`: not logged in (production). Stopped here.
- Checked Git, read-only: the GitHub repo is reachable and shows no branches, Git's credential manager is configured, and no global Git user name or email came back. The `gh` CLI is not installed.
- The privacy hook refused one check that combined a Git email lookup with web requests. It was rerun without the email part.
- Nothing scaffolded, moved, committed or pushed. Type-check and tests not run.

**What the user changed**

- (nothing recorded yet)

## 2026-11-25 - Prompt 2, continued: scaffold and template changes

**Prompt**

"logged in" (continue Prompt 2 above).

**What the agent did**

- `whoami`: logged in as `lichtszn`. Git name and email are set for this repo only.
- Moved `skills-lock.json` to a temp folder, scaffolded in place with `create-deepspace` 0.44.2, put it back. Checksums of `CLAUDE.md` and `skills-lock.json` matched before and after. The template's version is in `CLAUDE.deepspace.md`.
- Started the dev server: it registered app `app_01M88SWGKF0S1V8S18GJDS42MR` and `/`, `/home` and `/api/auth/ok` returned 200. It also listened on the network by default. `TaskStop` left its Vite process running, so the agent confirmed it was this project's and stopped it.
- Baseline on the untouched template: type-check clean, 3 of 3 unit tests, 8 of 8 smoke and API tests.
- Closed the paid-integration route (`src/server/http-routes.ts`): it now always answers 403. Server actions do not use it. The free catalog, status and disconnect routes are unchanged.
- Turned in-app AI chat off in `worker.ts` (`inApp: false`). In the template it switches on when the chat collections exist.
- Made cron triggering admin-only (`src/server/cron-role.ts`, used in `src/server/realtime-routes.ts`).
- Added tests for all three. Results: type-check clean, lint clean, 8 of 8 unit tests, 10 of 10 smoke and API tests.
- Updated `CLAUDE.md` with the six answers.

**Not tested**

- `tests/collab.spec.ts` was skipped because there are no DeepSpace test accounts. The cron rule is unit-tested only; no signed-in member was tried against the live socket.

**Noticed, not changed**

- The template lets any member add background jobs (`/ws/jobs`). There are no job handlers yet, but paid jobs would need the same admin-only rule.

**What the user changed**

- Logged in to DeepSpace, ran `git init`, and set the Git name and email for this repo.

**Git and GitHub (added after the push)**

- Scanned the staged files for secrets and personal email addresses: none found. `.dev.vars` is ignored and not committed.
- Committed `561b9da`, added the GitHub remote, and pushed branch `master` to https://github.com/lichtszn/channel-lab. `deepspace push` was not run. Nothing was deployed.

## 2026-11-25 - Prompt 3: click-route spike (one approved deploy)

**Prompt**

Answers: create two DeepSpace test accounts and run the two-user tests and the cron-member check; make background jobs admin-only; do the click spike with ONE deploy, GitHub as the source, no `deepspace push`. Spike: public `/go/:slug` that validates a test slug, limits 10/min per IP and 120/min per slug, writes one click row (variant and time, no IP), redirects, and over the limit redirects without counting. Try the Cloudflare rate limiter; if deploy rejects it, stop and ask. Add tests, deploy, test live signed out, report plainly, log, push, STOP.

**What the agent did**

- Created two test accounts (Tester One, Tester Two) with random passwords that were never displayed. They are stored in `~/.deepspace`, outside the repo.
- Jobs are admin-only (`worker.ts`). The job socket now also hides job history from members.
- Click route: `src/server/click-route.ts`, table `src/schemas/clicks-schema.ts` (nobody can write from the client; only admins can read), two rate limiters in `wrangler.toml`. Test slug `spike-test` goes to https://example.com/. HEAD requests redirect but are not counted.
- Created the empty `prd` secrets config, which deploy requires.
- Deployed once from commit `4605063`: release `rel_01M88VFR8K1V9WR8KSCGB1824X`, https://channel-lab.app.space. The name is claimed, GitHub is locked as the source, and deploy accepted the rate limiters.

**Local results**

- Type-check, lint and production build clean. Unit tests 19 of 19.
- All 18 browser and API tests pass one at a time (`npx playwright test -c tests/playwright.config.ts --workers=1`), including the two-user tests. Members cannot trigger cron, queue jobs, or read or create click rows. With those protections removed, the cron and job tests failed and the member could see click rows, so the checks are real. That click-row test only printed its result at the time; its assertions were added afterwards.
- `npx deepspace test run all` (parallel) is flaky on this machine: 3 of 18 failed, then 18 of 18, then 3 of 18. The commit before the spike failed 6 of 13 the same way, so the spike did not cause it. Low free memory (2.4 of 15.8 GB) is a likely cause, not proven.
- Limits were exact locally, by row count: 15 clicks from one IP stored 10; 140 more from 140 IPs stored 110 (120 for the slug). Every click redirected.

**Live results (signed out)**

| Check | Result |
|---|---|
| One click in a clean browser | 302 to example.com, 1 row stored, no cookies set |
| Row contents | variant and time; DeepSpace adds an id, its own times, and the app owner's id as creator. No IP |
| Unknown slugs, POST | 404, no row |
| HEAD | 302, no row |
| Forged `CF-Connecting-IP` | 403 before reaching the app, no row |
| Paid-integration route / AI chat / actions / tool route signed out | 403 / 404 / 401 / 401 |
| A: 40 clicks in parallel, 2 s | 40 redirected, **40 counted** |
| B: 40 clicks on one reused connection, 2 s | 40 redirected, 11 counted |
| C: 50 clicks, a new connection each, 41 s | **50 counted** (redirect codes were not recorded) |
| D: 200 clicks, a new connection each, 13 s | 200 redirected, 26 counted |

- The redirect behaved as asked. The per-IP limit did not hold at 10 per minute: it is approximate, and bursts or steady clicking on new connections can get well past it. All calls came from one IP and one Cloudflare location (DFW). Counting per connection or machine would fit the results; the cause was not proven.
- The per-slug limit was not reached live, because all traffic came from one IP. It is tested locally only.
- 128 test rows remain in the live `clicks` table. Nothing can delete click rows yet.

**Findings**

- Finding 7 above is settled: deploy accepts `[[ratelimits]]` (CLI 0.44.2), so the custom bindings page is out of date.
- 14: the architecture page still lists `/api/ai/*` as a main route; the 0.44.2 starter keeps it off.

**What the user changed**

- (nothing recorded yet)

## 2026-11-25 - Decisions after the click spike

**Prompt**

(1) Keep the Cloudflare limiter as a coarse abuse filter (option B) and do not build the exact counter yet. Record in the README and CLAUDE.md that click counts are approximate, with the exact per-slug counter as the "what I'd do next" item. The AI readout must say click counts are approximate. (2) Deploys to channel-lab are approved from now on, with GitHub as the source and never `deepspace push`; before each deploy, tell the user what changed and re-run type-check, lint and tests one file at a time. (3) Keep the 128 test clicks and note them in the README as test data on a test variant. Update CLAUDE.md and AGENT_LOG.md, commit, push, stop; do not start Prompt 4.

**What the agent did**

- Created `README.md` (there was none) and updated `CLAUDE.md` with these decisions.
- No code changes and no deploy. Type-check and tests were not re-run, because only documentation changed.

**What the user changed**

- Rejected the agent's recommended fix (an exact in-memory counter) for now, in favour of keeping the approximate limiter and documenting it.

## 2026-11-25 - Prompt 4+5: experiments, channels, real links, screens

**Prompt**

Collections `experiments` (title, hypothesis, audience, success metric, destination URL, decision keep/change/stop/none, decision reason) and `variants` (experiment, channel name, unique slug, manual outcome count, outcome label); keep `clicks`. Users see and edit only their own; clicks stay server-written; `ownerField` with `userBound` as the docs say. `/go/:slug` looks up a real variant and redirects to its experiment's destination, keeping all rules. Signed-in screens: list, create form, experiment page with 2 to 4 channels and copyable links, with loading, empty and error states. Public landing page. Tests: two accounts proving B cannot read or edit A's data, and a real-variant click logs a row. Run checks, explain each permission in one sentence, update docs, commit and push, then wait for OK before deploying.

**What the agent did**

- Read the records, data model, permissions and realtime docs, and the 0.44.2 code for `userBound`, `immutable`, `required`, `uniqueOn` and permission checks.
- Added `src/schemas/experiments-schema.ts` and `src/schemas/variants-schema.ts`, registered in `src/schemas.ts`.
- Rewrote `src/server/click-route.ts`: looks up the variant by slug, requires the variant's owner to own the experiment, redirects only to http(s) destinations, and answers 503 if the lookup fails. Limits, no-IP and HEAD rules are unchanged. The hard-coded `spike-test` variant is gone.
- Screens: `src/pages/(app)/(protected)/experiments/` (`index.tsx`, `new.tsx`, `[id].tsx`), `src/components/StatusPanel.tsx`, new landing page text, `/home` now forwards signed-in users to their experiments, nav and SEO text.
- Tests: `tests/experiments.spec.ts` (3 tests), `tests/helpers/local-clicks.ts` (reads the local dev database, because members cannot read clicks), `src/schemas/schemas.test.ts`, rewritten unit tests for the click route. Old `spike-test` tests changed to expect 404.

**Results**

- Type-check and lint clean. Unit tests 33 of 33.
- Browser and API tests one file at a time: 19 of 20. The failure is the template test "API status page renders loading success and error states". Run alone it passed 1 of 3 times. It failed the same way during Prompt 3, before this work.
- With permissions loosened, the privacy test failed; with the click route's owner check removed, the cross-account link test failed. Restored, all 3 pass.
- Looked at screenshots of the landing page and the signed-out experiments page: both show content.

**Limits to know**

- The 2 to 4 channel limit and the form's http(s) check are UI-only. The SDK does not check `select` values, so `decision` is not validated on the server either.
- Admins (including the app owner) also see only their own experiments.
- Editing outcomes and decisions has no screen yet.
- Not deployed.

**What the user changed**

- (nothing recorded yet)

## 2026-11-25 - Deploy of Prompt 4+5

**Prompt**

OK to deploy. Re-run type-check, lint and tests first, deploy with GitHub as the source (never `deepspace push`), check the live site signed out (landing page, sign-in screen, an unknown `/go/` slug returning 404), add three notes to the README (the flaky template test, the screen-only 2 to 4 channel limit, the form checks the server does not enforce), commit and push, then stop.

**What the agent did**

- Added the README notes and committed them (`fa35aec`) so the deploy shipped a clean tree.
- Pre-deploy checks: type-check and lint clean, unit tests 33 of 33, browser and API tests one file at a time 20 of 20 (the flaky template test passed this run).
- Deployed release `rel_01M8B3ZV8E2954R40HANF0JKA7` from `fa35aec`: GitHub source, clean tree, edge and data plane confirmed. `deepspace push` was not run.
- Live checks in a clean signed-out browser: landing page 200 with its heading and Sign in link; Sign in opened the "Sign in to continue" screen at `/experiments`; `/go/zzzz9999`, `/go/spike-test` and `/go/nope` returned 404; no cookies set; no console errors.
- Not checked by the agent: anything signed in on the live site. That is the user's manual check.

**What the user changed**

- (nothing recorded yet)

## 2026-11-26 - Prompt 6: experiment page (live clicks, manual fields, rates, decision, rename and delete)

**Prompt**

On the experiment page: (1) live click counts per channel and per day without polling, through a safe path that shows only the user's own counts, labelled approximate and "not signups"; (2) hand-edited reach, outcome count and outcome label; (3) a keep/change/stop decision with a reason; (4) clicks per reach and outcomes per click, only when reach is entered, otherwise "n/a", with no significance claims; (5) rename a channel and delete one with a confirm step, without silently orphaning clicks, keeping the 2 to 4 limit in the screens; (6) if cheap, enforce valid decisions and http(s) destinations on the server. Tests: B cannot read A's click counts or edit A's channels; the decision edit; rename and delete. Run checks one file at a time, update docs, commit and push, then wait for OK before deploying.

**What the agent did**

- Read the realtime sync, records and server-action docs, and checked the 0.44.2 code: live subscriptions have no row cap; `writableFields` limits which fields a role may write.
- (1) Live counts: chose "another safe path" instead of a server action, because a server action cannot push updates without polling. Click rows now also store the experiment id and the experiment owner's id, and `clicks` uses `ownerField` with read `'own'`. Each user subscribes live to their own clicks, and the server filters out everyone else's. Nothing about the visitor is stored. This changes the earlier "variant and time only" click row; the user can reverse it.
- (2) `reach` column added to `variants`; reach, outcome count and outcome label save from each channel card.
- (3) Decision panel saves through a new `setDecision` action.
- (4) Rates in `src/lib/stats.ts`, unit-tested.
- (5) Rename is a normal edit. Delete: chose blocking channels that have clicks (simpler and safer: no data is ever deleted). Clients can no longer delete channels directly; the new `deleteChannel` action checks ownership and clicks. The screen also keeps at least 2 channels.
- (6) Done: experiments are created only through `createExperiment` (http(s) only) and decisions set only through `setDecision`. Clients may only edit title, hypothesis, audience and success metric. Nobody can delete experiments.
- Fixed a bug found by the decision test: the panel reset itself when the saved value came back, hiding "Decision saved."
- Tests: `tests/experiments.spec.ts` rewritten (6 tests), the member click test in `tests/collab.spec.ts` updated, new unit tests for the actions and the rate maths.

**Results**

- Type-check and lint clean. Unit tests 53 of 53. Browser and API tests one file at a time 23 of 23 (the flaky template test passed this run).
- With click privacy, the delete-with-clicks rule and the experiment field lock each broken, the matching test failed at the expected line; restored, all pass.
- Looked at a screenshot of the signed-in experiment page.
- Not deployed.

**Known gaps**

- Clicks recorded before this version have no owner or experiment, so they appear in nobody's counts. That includes any manual test clicks on the live site.
- The 2 to 4 channel limit is screen-only. Experiment details cannot be edited in a screen yet.

**What the user changed**

- (nothing recorded yet)

## 2026-11-26 - Deploy of Prompt 6, and counting old clicks

**Prompt**

OK to deploy after re-running checks; GitHub as the source, never `deepspace push`; check the live site signed out. The user may have posted links before this deploy: from the owner account, count clicks recorded before this version per real channel, and propose (not run) a safe one-off way to stamp the experiment and owner on those rows. Don't touch the spike-test rows. Update README and AGENT_LOG, commit, push, stop.

**What the agent did**

- Pre-deploy checks: type-check and lint clean, unit tests 53 of 53, browser and API tests one file at a time 23 of 23.
- Counted clicks BEFORE deploying, not after as asked: the new version lets each user read only clicks stamped with their own id, so after the deploy no account can read the old rows in the app. Read as the owner, paging through all rows. The count finished at 05:53:03 UTC and the deploy at 05:53:34 UTC.
- Old clicks on the owner's experiment "Which channel gets people to try a DeepSpace-built app?": iMessage 19, Class Groupchat 7, LinkedIn 4, Instagram Story 3 (33 in total, 05:33 to 05:50 UTC). No clicks on any other user's channels. A click in the 31 seconds between the count and the deploy would be missing from these numbers.
- Deployed release `rel_01M8B6N1R2SN6RA484A0VF1DFE` (GitHub source, clean tree, confirmed).
- Live signed-out check: landing page 200, Sign in leads to the sign-in screen, unknown slugs (`/go/zzzz9999`, `/go/spike-test`, `/go/nope`) 404, HEAD 404, the three new actions 401 when signed out, no cookies, no console errors. After the deploy the owner reads 0 clicks, as expected.
- Checked the SDK: `immutable` columns refuse changes even from server code, so the old rows cannot be stamped in place. The proposal was sent to the user; nothing was run.

**Correction to Prompt 3**

- There are 232 `spike-test` rows, not 128. The live reads in Prompt 3 used one page of results; the server caps a page at about 30 KB and flags it `truncated`, which the agent did not check. Counted again by timestamp: single click 1, burst A 40 of 40, B 11 of 40, C 50 of 50, D **130 of 200** (reported as 26). README and CLAUDE.md are corrected. The per-IP limit is leakier than first reported.

**What the user changed**

- Posted real tracked links before this deploy (the 33 clicks above).

## 2026-11-26 - One-off copy of old clicks (in progress: dry run done, waiting for OK)

**Prompt**

Build and run the re-create migration, but COPY only: keep the originals as an audit trail. Temporary owner-only action; dry run first, showing the copies per channel (expected iMessage 19, Class Groupchat 7, LinkedIn 4, Instagram Story 3, 33 total); wait for OK; run for real; re-running must not duplicate (ids derived from the original click); skip spike-test rows; afterwards confirm the live counts are 33 plus new clicks, as the owner and on the page; then remove the action in a second deploy and confirm it is gone. Unit-test the logic with fake rows. Log the pre-deploy snapshot and the reason. Deploys approved.

**Why**

Clicks recorded before 2026-11-26 05:53 UTC have no experiment or owner, so after the Prompt 6 deploy nobody can read them. Their columns are immutable, so they cannot be stamped in place. Pre-deploy snapshot (owner account, 05:53:03 UTC, all pages read): iMessage 19, Class Groupchat 7, LinkedIn 4, Instagram Story 3; 232 spike-test rows.

**What the agent did so far**

- Added `src/actions/backfill-clicks.ts` (temporary, owner-only, dry run by default) and registered it in `src/actions/index.ts`. Each copy has id `bf-<original id>` and keeps the original click time. Originals are never changed or deleted. Spike-test rows, already-stamped rows, copies, and clicks whose channel or experiment is gone or has a different owner are skipped. All pages are read before anything is written.
- Unit tests with fake rows and 3-row pages (`src/actions/backfill-clicks.test.ts`): owner-only, dry run writes nothing, copies keep the time and leave originals untouched, re-running writes nothing. 57 of 57 unit tests pass; type-check and lint clean.
- Local dry run against the dev database: read 308 rows over several pages, nothing to copy (290 spike-test, 12 already stamped, 6 from deleted test channels); refused a signed-out call.
- Browser tests before the deploy: 22 of 23. The failure was the known flaky template test; the deploy command did not stop on it, so the agent deployed before re-checking. Rerun alone afterwards it passed twice.
- Deploy #1: release `rel_01M8B76AFVV128DRCYAGHE9W1A` from `22931cc` (GitHub source).
- Live dry run (06:04 UTC, called with the CLI's own token, never printed): 267 rows read; would copy iMessage 19, Class Groupchat 7, LinkedIn 4, Instagram Story 3 = 33, matching the snapshot, so no click was lost in the 31 seconds before the earlier deploy. Skipped 232 spike-test and 2 already-stamped rows (clicks since the Prompt 6 deploy). Nothing written.

**What the user changed**

- (nothing recorded yet)

## 2026-11-26 - One-off copy of old clicks: run, verified, action removed

**Prompt**

Run the copy for real, re-run to prove it writes 0, confirm the per-channel counts as owner. Remove the temporary action and deploy only after type-check, lint, unit tests and all browser tests pass in a single clean run (if the flaky test fails, rerun it alone and report; stop on any other failure). Confirm the action returns 404. Update AGENT_LOG and README, commit, push, stop.

**What the agent did**

- Real run at 06:06:34 UTC: read 267 rows, copied 33 (iMessage 19, Class Groupchat 7, LinkedIn 4, Instagram Story 3). Skipped 232 spike-test rows and 2 already-stamped rows.
- Re-run at 06:06:36 UTC: read 300 rows (267 + 33 copies), copied 0; it still found all 33 originals and reported them as already copied, so the originals were kept.
- Owner counts right after: 35 visible clicks, of which 33 are copies (`bf-` ids) and 2 are new clicks, all ids unique. Per channel: iMessage 19, Class Groupchat 9 (7 copied + 2 new), LinkedIn 4, Instagram Story 3. At 06:13 UTC, after one more new click: 36 (Class Groupchat 10).
- Not done: checking a count on the live page itself. The agent cannot sign in to the live app as the owner. The owner check reads the same rows, with the same permissions, as the page's live subscription.
- Removed `src/actions/backfill-clicks.ts`, its tests, and its registration (`438a6d2`).
- Checks before deploy #2: the first full run had 1 failure, the known flaky template test; rerun alone it failed again. A second full run was fully clean (type-check, lint, unit tests 53 of 53, browser tests 23 of 23), so the agent deployed.
- Deploy #2: release `rel_01M8B7RZ754SKNZS1BPNXNAHCY` from `438a6d2` (GitHub source, clean tree).
- Confirmed gone: as the owner, `POST /api/actions/backfillOldClicks` returned 200 before deploy #2 and 404 "Action not found" after it. Signed out it returns 401, like every action, because sign-in is checked first. The other actions are still there.

**What the user changed**

- Chose copy-only (originals kept as an audit trail) instead of the agent's proposal to delete originals after copying.

## 2026-11-26 - Prompt 7: AI readout

**Prompt**

Read the AI chat and external-API docs and check integration names. Add a "Generate readout" button backed by a server action: owner of the experiment only; 5 per user and 50 per app per UTC day, using `uniqueOn` if it holds under concurrency (tested), otherwise the docs recipe with the limitation noted; developer billing; disabled while loading; error and retry states. Send ONLY exact numbers (per channel clicks, reach, outcome count and label, the success metric and hypothesis). The memo names the leading channel, quotes its numbers, says counts are approximate and the sample is small, makes no significance claim, and suggests one next test. Check in code that every number in the memo appears in the data sent; otherwise show an error. Show the numbers beside the memo. Tests: mocked AI, ownership, caps, number check. Run checks, update docs, commit, push, wait for OK to deploy.

**What the agent did**

- Read the AI chat guide and the worker AI reference. Listed the catalog (free): the endpoint is `anthropic/chat-completion` (input `model`, `system`, `messages`, `max_tokens`, `temperature`; metered at provider cost; no output schema). No paid test call was made.
- `src/lib/readout.ts`: prompt, exact data shape, number extraction, `checkMemo` (numbers, "approximate", a channel name, no significance claim), and reading the Anthropic response.
- `src/actions/readout.ts` (`generateReadout`): checks ownership; reads the owner's channels and clicks (all pages); claims a per-user then an app slot in the new `readout_usage` collection (`uniqueOn` scope, day, slot; all columns required; no client access), giving the user slot back if the app is full; calls the model (`claude-opus-5-5`, temperature 0, 700 tokens); checks the memo. `anthropic: { billing: 'developer' }` added to `src/integrations.ts`.
- Test hook: `fakeModel` (plus `testDay`, `fakeMemo`) only when `ALLOW_DEBUG_ROUTES` is "true". It is on locally and not set in production (the `prd` secrets config is empty).
- UI: `src/components/experiment/ReadoutPanel.tsx` on the experiment page.
- Tests: `src/lib/readout.test.ts` (10), `src/actions/readout.test.ts` (11: ownership, the data sent, 5 per user, 20 simultaneous from one user (exactly 5), 60 racing across 12 users (exactly 50, user slots given back), UTC day rollover, rejected memo, model failure, fake-model gating, no channels), `tests/readout.spec.ts` (3, real local record room, fake model only).

**Results**

- Type-check and lint clean. Unit tests 75 of 75.
- Browser and API tests one file at a time: 25 of 26. The failure was the known flaky template test; rerun alone it failed again.
- `tests/readout.spec.ts` first run: one test failed with `ERR_NETWORK_IO_SUSPENDED` on its first page load (the browser's network was suspended, not an assertion); the rerun passed 3 of 3.
- Real record room: 8 simultaneous readouts gave exactly 5 successes (slots 1 to 5) and 3 cap refusals.
- Removing `uniqueOn` made that test fail, but for a mixed reason: the local SQLite table kept its unique index, so duplicate claims errored instead of succeeding. This shows the test catches broken behaviour, not what happens with no uniqueness at all; the unit race tests cover that logic.
- Not deployed. No paid AI call has been made yet.

**What the user changed**

- (nothing recorded yet)

## 2026-11-26 - Cost rule: readout off by default, cheaper model, lower caps

**Prompt**

The user cannot spend real money. No live paid call and no test call. Without calling anything, report the cheapest suitable model's per-call price, the credit balance, what in the app is billed, and what happens when credits run out. Add a production switch, default OFF and not in code, that disables Generate readout with the message "AI readout is switched off to avoid cost. It is fully built and tested with a fake model." Switch to the cheapest suitable model; caps 3 per user and 10 per app. Keep tests on the fake model. Update README with the tradeoff, cost facts and how to turn it on. Then one fully clean test run, deploy, check the live site signed out, commit, push, stop.

**Cost facts (read-only; no paid call)**

- `npx deepspace integrations info anthropic/chat-completion --json`: billing `per_actual_cost` (provider cost plus platform markup), `baseCost: null`, varies with input, free-tier price differs except that `claude-haiku-5-5` gets standard pricing. No fixed per-call price is published.
- `npx deepspace app usage --json`: plan free, allocation 500 credits (US$5), 499.985 remaining (about 0.015 credits used, not itemized), purchased 0, renews never shown, no integration usage.
- Docs: charges are listed only for integration calls; the free plan has quotas (active apps, 128 MiB files), not hosting or record charges. When credits run out, paid calls fail with `insufficient_credits` until topped up.

**What the agent did**

- Switch: DeepSpace secret `READOUT_ENABLED`; only the exact value "true" turns the readout on. Off (the default), `generateReadout` refuses before claiming a slot or calling anything, and a free `readoutSettings` action tells the screen, which disables the button and shows the user's message. Local tests still use the fake model (`ALLOW_DEBUG_ROUTES` plus `fakeModel`), which works with the switch off.
- Model `claude-haiku-5-5`; caps 3 per user and 10 per app per UTC day.
- Tests: unit tests for the switch (unset, "false", "TRUE", "1" all off, nothing claimed or called) and the settings action; caps updated (20 racing from one user give exactly 3; 18 racing across 6 users give exactly 10); a browser test that the default-off screen shows the message and the server refuses; 8 simultaneous readouts on the real local database give exactly 3.
- First tries at one clean run failed: twice only on the template "API status page" test, which by then failed every time, even alone; once because the dev server did not start within 60 seconds. Its failure snapshot showed the page had already finished loading: the test's fake catalog answered after a fixed 100 ms, and the test missed that loading window. Fixed in `tests/collab.spec.ts`: the fake answer now waits until the test has seen the loading state. It then passed 3 of 3 alone.
- One fully clean run: type-check, lint, unit tests 78 of 78, browser tests 27 of 27.
- README and CLAUDE.md updated (switch, cost facts, how to turn it on, the no-spend rule).

**What the user changed**

- Rejected the agent's choice of `claude-opus-5-5` and live readouts: no spending, readout off by default, cheapest model, lower caps.
