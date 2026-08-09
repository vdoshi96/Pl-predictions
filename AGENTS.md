<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Dranx Prediction League project guide

## Product and architecture

Dranx Prediction League is a mobile-first friends game for the 2026/27 Premier League. A participant completes one immutable three-stage entry: order all 20 clubs and enter a display name, choose seven spotlight predictions, then review and submit. It is one Next.js 16 App Router application deployed on Vercel, with Vercel Marketplace Neon PostgreSQL accessed through Drizzle and the Neon HTTP driver. Public pages, authenticated administrator pages, server actions, and the source-neutral standings import endpoint live in the same application.

The seven spotlight categories are top scorer, top assister, most clean sheets, underdog team, overrated team, underdog player, and overrated player. Player categories use a searchable season catalogue plus an Other-player text fallback; most clean sheets and both team-opinion categories select clubs. There is no runtime football API client, production scraper, or Vercel Cron. Standings enter through the authenticated canonical importer or manual administrator form. A future owner-run Codex automation will enter the five non-table-derived spotlight outcome rankings manually. Do not add automated FotMob extraction without written data-licence permission covering the intended use.

The 20 owner-provided club badge PNGs are the canonical local team marks; the original monograms remain rollback-only fallbacks for the first badge release. The owner-provided `premier-league-players-2026-08-08/` snapshot is the reviewed selector source: 587 players across the 20 clubs, with 580 supplied portrait PNGs and seven intentional `PlayerMark` silhouette fallbacks. Keep Other player available for unavailable or newly added players. This roster import is not an outcome feed; do not infer the five pending result rankings from it or add runtime acquisition.

## Important paths

- `src/app/` — public, administrator, and API routes.
- `src/features/` — prediction, standings, scoring, season, and admin domain logic.
- `src/db/` and `drizzle/` — schema, database client, and committed migrations.
- `src/data/` — reviewed season and 20-club fixtures.
- `src/features/predictions/categories.ts` and `src/features/scoring/categories.ts` — canonical spotlight taxonomy, accuracy curve, and team expectation formulas.
- `scripts/` — seed, standings import, test-database safety wrapper, and documentation generator.
- `tests/` — unit/component, isolated Neon integration, and Playwright browser suites.
- `docs/` — canonical architecture, research, QA, decisions, status, and generated HTML peers.
- `public/team-marks/` — owner-provided club badge PNGs plus rollback-only monograms; do not add the separate Premier League logo/lion/ball assets or unapproved replacements.
- `premier-league-players-2026-08-08/` — owner-provided raw roster and portrait handoff; never execute its acquisition scripts in the deployed app.
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
- Treat the database clock as authoritative for submission deadlines and standings freshness.
- Once predictions are revealed by deadline, lock, or early reveal, submissions remain closed permanently for fairness.
- Import only complete known-team standings permutations; failures must preserve the last accepted table.
- Finalization and undo operations must compare-and-swap the exact active/final snapshot.
- Derive totals rather than persisting editable scores. The main leaderboard uses table points only and is capped at 100. Spotlight accuracy is separate and never changes table points. Let `N` be the current number of active, nondeleted season brackets. Accuracy points are `max(0, N + 1 - occupied outcome rank)`. Overall accuracy sums only resolved categories. A resolved zero-point result still counts as available. Pending outcomes remain unavailable. Equal overall scores share a competition rank.
- Team expectation indexes are `average predicted position - actual position` for underdog and the exact inverse for overrated; rank each list largest first using full precision.
- Deleting a prediction must cascade through all 20 table items and seven spotlight picks, then allow the normalized display name to submit again. Preserve the deletion audit record.
- Collect only the participant's chosen display name. Receipt cookies are hashed at rest; admin cookies are HttpOnly, SameSite Strict, and Secure in production.

## Definition of done

A change is complete only when relevant unit/component tests, isolated Neon integration tests, TypeScript, ESLint, formatting, documentation parity, production build, and desktop/mobile browser checks pass. Mobile QA must cover the three-stage flow, the table leaderboard, the separate spotlight-accuracy page, 320–430px reflow, 56px touch handles, mouse/touch/keyboard reorder, searchable keyboard-accessible category selectors, the Other-player text path, safe-area actions, long-name wrapping, and no horizontal overflow. Preserve exact cleanup evidence for any QA data.

Keep canonical Markdown and generated HTML peers synchronized. Before finishing an iteration, correct stale status/QA documentation, push the feature branch, merge it to GitHub `main`, update local `main` to the same commit, and remove completed worktrees.
