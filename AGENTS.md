<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Dranx Prediction League project guide

## Product and architecture

Dranx Prediction League is a mobile-first friends game for the 2026/27 Premier League. A participant completes one immutable three-stage entry: enter a display name and order all 20 clubs, choose seven spotlight predictions, then review and submit. Before submission, a validated season-keyed browser draft preserves progress; an untouched deterministic A–Z table requires explicit acknowledgement. It is one Next.js 16 App Router application deployed on Vercel, with Vercel Marketplace Neon PostgreSQL accessed through Drizzle and the Neon HTTP driver. Public pages, authenticated administrator pages, server actions, the source-neutral standings import endpoint, and the manual results desk live in the same application.

Win Streak is a separate Matchweek 2–38 game in the same application. `/win-streak` keeps its leaderboard public before profile creation and publishes each participant's best streak, current streak, and current-round pick. Playing uses a 2–40-character display name and a replaceable random browser receipt; there is no login. Re-entering the same normalized display name rotates the receipt and resumes that profile from another browser or after cookie loss. Each round locks at its earliest persisted fixture kickoff. Picks are immutable. Wins extend the streak and restrict winning clubs; draws and losses reset and unlock; missed and void rounds preserve. `/admin/win-streak` resolves the earliest completed round through one reviewed, atomic, immutable set of ten outcomes.

The seven spotlight categories are top scorer, top assister, most clean sheets, underdog team, overrated team, underdog player, and overrated player. Player categories use a searchable season catalogue plus an Other-player text fallback; most clean sheets and both team-opinion categories select clubs. Each opinion category ranks only the distinct subjects picked for that category. The initial homepage HTML and RSC must not contain the player catalogue or portrait paths. Load the catalogue lazily on Stage 2 through the dynamic same-origin `/api/player-catalogue` route, SQL-filter active players for the current season, require at least two normalized search characters, display at most 20 matching rows, announce the total match count, enforce one open popup, and keep Other player available during loading, empty, and error states. There is no runtime football API client, production scraper, image hotlink, or Vercel Cron. Standings enter through the authenticated canonical importer or manual administrator form. Reviewed factual spotlight outcomes enter manually at `/admin/results` as `goals`, `assists`, `clean_sheets`, and shared `player_ratings` versions. The owner confirmed on 2026-08-14 that the required permissions for this player-catalogue workflow have been obtained, including acquisition, storage, redistribution, and production use. Owner-run acquisition may occur offline but must not run inside the deployed application.

The 20 owner-provided club badge PNGs are the canonical local team marks; the original monograms remain rollback-only fallbacks for the first badge release. The owner-provided `premier-league-players-2026-08-20/` snapshot is the current reviewed selector source: 580 players across the 20 clubs, with 578 supplied portrait PNGs and two intentional silhouette fallbacks for Ryan McAidoo and Luc De Fougerolles. Keep Other player available for unavailable or newly added players. This roster import is not an outcome feed; do not infer the five pending result rankings from it or add runtime acquisition.

## Important paths

- `src/app/` — public, administrator, and API routes.
- `src/features/` — prediction, standings, result snapshots, scoring, season, and admin domain logic.
- `src/db/` and `drizzle/` — schema, database client, and committed migrations.
- `src/data/` — reviewed season and 20-club fixtures.
- `src/features/predictions/categories.ts` and `src/features/scoring/categories.ts` — canonical spotlight taxonomy, accuracy curve, and team expectation formulas.
- `src/features/win-streak/`, `src/app/win-streak/`, and `src/app/admin/win-streak/` — receipt profiles, picks, derived scoring, public leaderboard, and reviewed results desk.
- `src/data/win-streak-fixtures.json` and `scripts/refresh-win-streak-fixtures.ts` — official Matchweek 2–38 snapshot and offline drift checker.
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
npm run db:seed:win-streak
npm run db:test:seed:win-streak
npm run win-streak:fixtures:check
npm run win-streak:fixtures:apply
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
- Publish a manual result only after permanent closure/reveal, at least one active bracket, relevant pinned Other aliases, and explicit owner attestation. Goals, assists, and clean sheets require exact current-`N` coverage including boundary ties. `player_ratings` may contain the nonempty reviewed subset of distinct players picked for either opinion-player category and must reject unpicked rows. A picked opinion player without a reviewed rating displays as N/A, stays unavailable, and contributes no accuracy points. After attested coverage, omitted canonical subjects in the other factual datasets are outside-range zero and still count as available.
- Goals, assists, and club clean sheets are nonnegative whole numbers. The shared player-rating facts are numeric values from 0 through 10 with at most three decimal places; rank the exact stored values without pre-ranking rounding and render enough precision to explain distinct ranks.
- Derive totals rather than persisting editable scores. The main leaderboard uses table points only and is capped at 100. Spotlight accuracy is separate and never changes table points. Let `N` be the current number of active, nondeleted season brackets. Accuracy points are `max(0, N + 1 - occupied outcome rank)`. Overall accuracy sums only resolved categories. A resolved zero-point result still counts as available. Pending outcomes remain unavailable. Equal overall scores share a competition rank.
- Team expectation indexes are `average predicted position - actual position` for underdog and the exact inverse for overrated. Calculate each index from every complete bracket, then rank only the distinct clubs picked for that opinion category, largest first using full precision.
- Deleting a prediction must cascade through all 20 table items and seven spotlight picks, then allow the normalized display name to submit again. Preserve the deletion audit record.
- Collect only the participant's chosen display name. Receipt cookies are hashed at rest; admin cookies are HttpOnly, SameSite Strict, and Secure in production.
- Keep Win Streak receipt tokens and row identifiers out of public projections. The public leaderboard deliberately includes the display name and current-matchweek pick. A missing receipt is anonymous until the participant re-enters the same normalized display name, which rotates the receipt and resumes the profile.
- Keep Win Streak at one immutable pick per profile and round. Enforce the earliest-kickoff round deadline with PostgreSQL time, active-round order, fixture membership, winning-club restrictions, a 500-profile cap, and persistent creation/pick limits.
- Resolve only the earliest unresolved Win Streak round, only after all ten fixture kickoffs, and only with exactly ten reviewed outcomes plus provenance in one atomic audit-bearing transition. Resolved facts cannot change.
- Check the official fixture source before recurring results work. A no-drift check writes nothing. The targeted seed may change only a future, unpicked, unresolved kickoff for the same fixture, teams, and matchweek; every structural or protected-round change fails closed. Never use the general seed for fixture drift.

## Definition of done

A change is complete only when relevant unit/component tests, isolated Neon integration tests, TypeScript, ESLint, formatting, documentation parity, production build, and desktop/mobile browser checks pass. Mobile QA must cover the three-stage flow, draft reload, intentional A–Z and reorder, the table leaderboard, the separate spotlight-accuracy page, Win Streak anonymous access and public picks, 320–430px reflow, 56px touch handles, mouse/touch/keyboard operation, searchable keyboard-accessible category selectors, the Other-player text path, both manual result desks, fixed-deadline time-zone display, safe-area actions, long-name wrapping, and no horizontal overflow. Win Streak QA must also cover fixture coverage and drift, display-name resumption after cookie loss, immutable picks, every outcome transition, club unlocking, shared ranking, reload persistence, result atomicity, and no runtime football requests. Preserve exact cleanup evidence for any QA data.

Keep canonical Markdown and generated HTML peers synchronized. Before finishing an iteration, correct stale status/QA documentation, push the feature branch, merge it to GitHub `main`, update local `main` to the same commit, and remove completed worktrees.
