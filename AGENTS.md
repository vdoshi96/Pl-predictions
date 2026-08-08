<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# PL Predictions project guide

## Product and architecture

PL Predictions is a mobile-first friends game for the 2026/27 Premier League. It is one Next.js 16 App Router application deployed on Vercel, with Vercel Marketplace Neon PostgreSQL accessed through Drizzle and the Neon HTTP driver. Public pages, authenticated administrator pages, server actions, and the source-neutral standings import endpoint live in the same application.

There is no runtime football API client, production scraper, or Vercel Cron. Standings enter through the authenticated canonical importer or manual administrator form. Do not add automated FotMob extraction without written data-licence permission covering the intended use. Local monogram marks are the documented rights-safe fallback until real crest redistribution permission exists.

## Important paths

- `src/app/` — public, administrator, and API routes.
- `src/features/` — prediction, standings, scoring, season, and admin domain logic.
- `src/db/` and `drizzle/` — schema, database client, and committed migrations.
- `src/data/` — reviewed season and 20-club fixtures.
- `scripts/` — seed, standings import, test-database safety wrapper, and documentation generator.
- `tests/` — unit/component, isolated Neon integration, and Playwright browser suites.
- `docs/` — canonical architecture, research, QA, decisions, status, and generated HTML peers.
- `public/team-marks/` — project-owned fallback monograms; do not substitute unlicensed crests.

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
- Protect every administrator mutation with the signed session and same-origin checks.
- Validate all public, administrator, and import payloads on the server; retain matching PostgreSQL constraints.
- Never serialize unrevealed prediction IDs or items into public HTML, RSC, or route-handler payloads.
- Treat the database clock as authoritative for submission deadlines and standings freshness.
- Once predictions are revealed by deadline, lock, or early reveal, submissions remain closed permanently for fairness.
- Import only complete known-team standings permutations; failures must preserve the last accepted table.
- Finalization and undo operations must compare-and-swap the exact active/final snapshot.
- Collect only the participant's chosen display name. Receipt cookies are hashed at rest; admin cookies are HttpOnly, SameSite Strict, and Secure in production.

## Definition of done

A change is complete only when relevant unit/component tests, isolated Neon integration tests, TypeScript, ESLint, formatting, documentation parity, production build, and desktop/mobile browser checks pass. Mobile QA must cover 320–430px reflow, 56px touch handles, mouse/touch/keyboard reorder, safe-area actions, long-name wrapping, and no horizontal overflow. Preserve exact cleanup evidence for any QA data.

Keep canonical Markdown and generated HTML peers synchronized. Before finishing an iteration, correct stale status/QA documentation, push the feature branch, merge it to GitHub `main`, update local `main` to the same commit, and remove completed worktrees.
