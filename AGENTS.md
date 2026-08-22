<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Dranx Prediction League project guide

## Product and architecture

Dranx Prediction League is a mobile-first friends game for the 2026/27 Premier League. A participant completes one immutable three-stage entry: enter a display name and order all 20 clubs, choose seven spotlight predictions, then review and submit. Before submission, a validated season-keyed browser draft preserves progress; an untouched deterministic A–Z table requires explicit acknowledgement. It is one Next.js 16 App Router application deployed on Vercel, with Vercel Marketplace Neon PostgreSQL accessed through Drizzle and the Neon HTTP driver. Public pages, authenticated administrator pages, server actions, the source-neutral standings import endpoint, and the manual results desk live in the same application.

The seven spotlight categories are top scorer, top assister, most clean sheets, underdog team, overrated team, underdog player, and overrated player. Player categories use a searchable season catalogue plus an Other-player text fallback; most clean sheets and both team-opinion categories select clubs. The initial homepage HTML and RSC must not contain the player catalogue or portrait paths. Load the catalogue lazily on Stage 2 through the dynamic same-origin `/api/player-catalogue` route, SQL-filter active players for the current season, require at least two normalized search characters, display at most 20 matching rows, announce the total match count, enforce one open popup, and keep Other player available during loading, empty, and error states. There is no runtime football API client, production scraper, image hotlink, or Vercel Cron. Standings enter through the authenticated canonical importer or manual administrator form. Reviewed factual spotlight outcomes enter manually at `/admin/results` as `goals`, `assists`, `clean_sheets`, and shared `player_ratings` versions. The owner confirmed on 2026-08-14 that the required permissions for this player-catalogue workflow have been obtained, including acquisition, storage, redistribution, and production use. Owner-run acquisition may occur offline but must not run inside the deployed application.

The 20 owner-provided club badge PNGs are the canonical local team marks; the original monograms remain rollback-only fallbacks for the first badge release. The owner-provided `premier-league-players-2026-08-20/` snapshot is the current reviewed selector source: 580 players across the 20 clubs, with 578 supplied portrait PNGs and two intentional silhouette fallbacks for Ryan McAidoo and Luc De Fougerolles. Keep Other player available for unavailable or newly added players. This roster import is not an outcome feed; do not infer the five pending result rankings from it or add runtime acquisition.

## Important paths

- `src/app/` — public, administrator, and API routes.
- `src/features/` — prediction, standings, result snapshots, scoring, season, and admin domain logic.
- `src/db/` and `drizzle/` — schema, database client, and committed migrations.
- `src/data/` — reviewed season and 20-club fixtures.
- `src/features/predictions/categories.ts` and `src/features/scoring/categories.ts` — canonical spotlight taxonomy, accuracy curve, and team expectation formulas.
- `scripts/` — seed, standings import, test-database safety wrapper, and documentation generator.
- `tests/` — unit/component, isolated Neon integration, and Playwright browser suites.
- `docs/` — canonical architecture, research, QA, decisions, status, and generated HTML peers.
- `public/team-marks/` — owner-provided club badge PNGs plus rollback-only monograms; do not add the separate Premier League logo/lion/ball assets or unapproved replacements.
- `premier-league-players-2026-08-20/` — owner-provided current raw roster and portrait handoff; never execute its acquisition scripts in the deployed app. The August 18 handoff is the direct comparison baseline, and earlier folders remain provenance only.
- `public/player-faces/` — imported local portraits; `PlayerMark` must fall back to the generic silhouette when an asset path is absent or an image fails.

## Commands

```bash
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run test:e2e
npm run build:verify
npm run check
npm run db:migrate
npm run db:seed
npm run db:test:migrate
npm run db:test:seed
npm run docs:generate
npm run docs:check
```

Integration and full browser journeys must use an isolated database. Set `TEST_DATABASE_URL`, or set the local-only `TEST_DATABASE_NAME` so `scripts/run-with-test-database.mjs` derives it. The wrapper must fail closed when the test target resolves to production. Production smoke tests are separate, bounded commands and must never run the reveal/standings journey against live data.

## Security and data constraints

- Keep `ADMIN_SECRET`, `ADMIN_SESSION_SECRET`, `STANDINGS_INGEST_SECRET`, database URLs, and provider credentials server-only and out of logs and commits.
- Prefer `ADMIN_USERNAME` plus `ADMIN_PASSWORD_HASH` for owner login. The password hash is salted PBKDF2-SHA-256; `ADMIN_SECRET` is a legacy fallback only when no hash is configured. Never commit or document the raw owner password.
- Protect every administrator mutation with the signed session and same-origin checks.
- Validate all public, administrator, and import payloads on the server; retain matching PostgreSQL constraints.
- Accept a prediction only when the guarded write can persist the parent, all 20 ordered club rows, and exactly seven category rows together; otherwise persist none of them.
- Never serialize unrevealed prediction IDs, positions 2–20, or spotlight picks into public HTML, RSC, or route-handler payloads.
- Treat the persisted opening kickoff and the database clock sampled after the season-row lock as the sole timed submission cutoff. The legacy `submission_deadline` column remains for schema and migration compatibility only; runtime, seed, environment, and administrator paths must not read or write it.
- Earlier closure is available only through irreversible manual lock or early reveal. Both actions reveal predictions and permanently close submissions for fairness. Require exact typed `LOCK` and `REVEAL` phrases in both browser and server validation; a concurrent, naturally closed, or already-closed attempt is a truthful no-op and writes no success audit.
- Import only complete known-team standings permutations; failures must preserve the last accepted table.
- Finalization and undo operations must compare-and-swap the exact active/final snapshot.
- Result facts and pinned aliases are inserted only during snapshot construction. Seal the snapshot before any working/active/final pointer may reference it; sealed snapshots, items, and pinned aliases must reject update, delete, and append. Saving, pointer transition, and audit writes stay atomic and stale attempts preserve the last good active version.
- Publish a manual result only after permanent closure/reveal, at least one active bracket, exact current-`N` coverage including boundary ties, relevant pinned Other aliases, and explicit owner attestation. `player_ratings` must cover both high and low directions. Missing/unresolved datasets stay pending; after attested coverage, omitted canonical subjects are outside-range zero and still count as available.
- Goals, assists, and club clean sheets are nonnegative whole numbers. The shared player-rating facts are numeric values from 0 through 10 with at most three decimal places; rank the exact stored values without pre-ranking rounding and render enough precision to explain distinct ranks.
- Derive totals rather than persisting editable scores. The main leaderboard uses table points only and is capped at 100. Spotlight accuracy is separate and never changes table points. Let `N` be the current number of active, nondeleted season brackets. Accuracy points are `max(0, N + 1 - occupied outcome rank)`. Overall accuracy sums only resolved categories. A resolved zero-point result still counts as available. Pending outcomes remain unavailable. Equal overall scores share a competition rank.
- Team expectation indexes are `average predicted position - actual position` for underdog and the exact inverse for overrated; rank each list largest first using full precision.
- Deleting a prediction must cascade through all 20 table items and seven spotlight picks, then allow the normalized display name to submit again. Preserve the deletion audit record.
- Collect only the participant's chosen display name. Receipt cookies are hashed at rest; admin cookies are HttpOnly, SameSite Strict, and Secure in production.

## Definition of done

A change is complete only when relevant unit/component tests, isolated Neon integration tests, TypeScript, ESLint, formatting, documentation parity, production build, and desktop/mobile browser checks pass. Mobile QA must cover the three-stage flow, draft reload, intentional A–Z and reorder, the table leaderboard, the separate spotlight-accuracy page, 320–430px reflow, 56px touch handles, mouse/touch/keyboard reorder, searchable keyboard-accessible category selectors, the Other-player text path, manual results editing, fixed-deadline time-zone display, safe-area actions, long-name wrapping, and no horizontal overflow. Preserve exact cleanup evidence for any QA data.

Keep canonical Markdown and generated HTML peers synchronized. Before finishing an iteration, correct stale status/QA documentation, push the feature branch, merge it to GitHub `main`, update local `main` to the same commit, and remove completed worktrees.

## Cursor Cloud specific instructions

This environment runs the app fully offline with **no Neon/Vercel secrets**. A local PostgreSQL 16 instance stands in for Neon, fronted by a small local Neon-protocol proxy so the unmodified app, scripts, and tests all connect exactly as they would to real Neon. Standard commands are unchanged — see `README.md` / `package.json` `scripts` (`npm run dev`, `npm test`, `npm run test:integration`, `npm run test:e2e`, `npm run build:verify`, `db:migrate`, `db:seed`, etc.). The notes below are only the non-obvious local specifics.

### Services to start after boot (not run by the update script)

The update script only runs `npm ci`. Postgres and the proxy do not auto-start. Run once per boot:

```bash
bash ~/neon-http-proxy/start-services.sh   # idempotent: starts PostgreSQL 16 + the TLS proxy on :443
```

Prefer a tmux-backed session for the dev server so logs persist: `npm run dev` (Turbopack) serves on `http://localhost:3000`.

### How the local Neon shim works (why the app "just works")

- PostgreSQL 16 runs on `127.0.0.1:5432` (role `dranx` / password `dranx`, superuser). Databases: `main` (dev) and `main_test` (isolated tests). Data persists in the VM snapshot, already migrated + seeded (20 teams, 580 players).
- `~/neon-http-proxy/server.mjs` is a TLS server on `:443` implementing the Neon protocol: `POST /sql` (HTTP driver) and `wss /v2` (Pool driver), forwarding to local Postgres.
- The app **bundles** `@neondatabase/serverless`, so its `neonConfig` cannot be patched at runtime. Instead the driver's *default* endpoints are pointed at the proxy without code changes: `/etc/hosts` maps `api.db.local` and `pg.db.local` to `127.0.0.1`, and `NODE_EXTRA_CA_CERTS` (set in `~/.bashrc` → `~/neon-http-proxy/tls/cert.pem`) trusts the proxy cert. `DATABASE_URL` in `/workspace/.env.local` therefore uses host `pg.db.local` (the port is ignored by the driver; the transport is always HTTPS/WSS on 443).
- Non-bundled processes (drizzle-kit, seed script, `vitest` integration) use the Pool/WebSocket transport. A tiny `NODE_OPTIONS` preload (`~/neon-http-proxy/preload.mjs`, wired in `~/.bashrc`) sets `neonConfig.pipelineConnect=false` for local `*.db.local` databases only, which is required for SCRAM auth to succeed against generic Postgres. It is a guarded no-op for real `*.neon.tech` databases.
- To use a real Neon database instead, just set `DATABASE_URL`/`TEST_DATABASE_URL` to the `*.neon.tech` URL (via a secret) — the hosts/cert/preload shims are all inert for non-local hosts, and no service needs to run.

### Local dev caveats (non-obvious)

- **Admin login uses `ADMIN_SECRET`, not `ADMIN_PASSWORD_HASH`, in `.env.local`.** The PBKDF2 hash format contains `$` characters, and both Next.js's env loader and `dotenv-cli` (used by the `test:*`/`db:*` scripts) perform `$`-variable expansion, which corrupts the hash inconsistently between the two loaders. The `$`-free `ADMIN_SECRET` (≥16 bytes) avoids this. Local owner login: username `admin`, password `dev-admin-password-1234` (also exposed as `PLAYWRIGHT_ADMIN_PASSWORD` for e2e). This is a local-only convenience; production still uses `ADMIN_PASSWORD_HASH`.
- **Submissions cutoff:** the real season opening kickoff (`2026-08-21`) has passed, so submissions are closed by default. The local `main` DB's `seasons.opening_kickoff` is set to a future date so the three-stage submission flow is open in `npm run dev`. e2e suites instead pin time with `PL_PREDICTIONS_TEST_NOW_ISO` against `main_test`.
- **Only one `next dev` at a time:** Next 16 refuses a second dev server even on a different port. Stop the port-3000 dev server (kill its tmux session) before running `npm run test:e2e` (its Playwright web server binds 3100).
- The admin login rate limiter is persistent (5 attempts / 15 min per source) in `security_rate_limits`. Repeated e2e runs can trip it; clear with `psql ... -c "DELETE FROM security_rate_limits;"` against `main_test` if admin steps start failing with a stuck login.

### Test status in this environment

`npm test` (346), `npm run test:integration` (22, both HTTP and WebSocket transports), `npm run build:verify`, `npm run lint`, and `npm run typecheck` all pass. In `npm run test:e2e`, the desktop `chromium` project passes fully; a few **mobile-viewport** projects (mobile-chromium/webkit app-journey, 320/430 reflow) can fail on touch-drag / combobox-tap timing under headless mobile emulation — a browser-interaction sensitivity, not a database/environment problem.
