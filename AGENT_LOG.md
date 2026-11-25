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
