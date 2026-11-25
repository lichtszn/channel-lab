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
