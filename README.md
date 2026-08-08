# Dranx Prediction League

Dranx Prediction League is an unofficial, mobile-first prediction game for a private invited group. Each participant orders the 20 verified 2026/27 Premier League clubs, reviews an immutable 1–20 table, and submits one display name. Once entries are revealed, every score is recalculated from the latest validated standings snapshot; scores are never accumulated between matchweeks.

Production: [https://pl-predictions-2026.vercel.app](https://pl-predictions-2026.vercel.app)

GitHub: [https://github.com/vdoshi96/Pl-predictions](https://github.com/vdoshi96/Pl-predictions)

Deployment status: production is public and Ready at the stable alias above. Vercel Authentication is set to `preview`, so retained preview deployments still require owner sign-in while production remains anonymously accessible. Final production browser and cleanup evidence is recorded in [docs/QA.md](docs/QA.md).

## Brand and club assets

The user-facing identity is Dranx Prediction League. Its Premier-League-inspired palette anchors on the league's official purple, `#37003c`, with cyan `#05f0ff`, green `#00ff87`, and pink `#ff2882` accents and an original Dranx mark. The original mark is used instead of the official Premier League logo.

FotMob crest downloads and the official Premier League logo were not added. Repository policy and the current official terms require appropriate authorization before those third-party marks can be copied or redistributed. The application therefore retains its 20 local text monograms. The shared `TeamMark` now uses contain sizing, a neutral backing, and a labelled initials fallback so authorized transparent files can replace the monograms later without changing the database model or public flows.

## Product behavior

- `/` presents an alphabetical 20-club sorter, name field, review dialog, and receipt confirmation.
- `/leaderboard` shows the participant roster before reveal and shared-rank scores afterward.
- `/entries/[id]` is private to the receipt browser or administrator before reveal, then becomes the public club-by-club comparison.
- `/admin` provides owner-only settings, submission deletion, manual standings, import history, and final-table controls.
- `/api/automation/standings` accepts a source-neutral, bearer-authenticated snapshot or failure record. It never fetches a football-data service itself.

Scoring is mutually exclusive per club: 5 points exact, otherwise 3 within three places, otherwise 1 in the same half, otherwise 0. An exact table scores 100.

## Mobile-first interaction

The prediction and manual-standings lists are single-column and have no horizontal overflow at narrow widths. Each row has a dedicated 56 by 56 pixel move handle; `touch-action: none` is limited to the handle so the rest of the page still scrolls naturally. The same handle supports pointer dragging and direct Arrow Up/Arrow Down reordering with live screen-reader announcements. Position numbers update immediately, the top/bottom-half boundary is visible, focus states are explicit, reduced-motion preferences are respected, and the review action remains reachable above the mobile safe area.

## Architecture

The application is one Next.js 16 App Router deployment on Vercel. Dynamic server components and server actions read and mutate a Vercel Marketplace Neon database through Drizzle and the Neon serverless HTTP driver. Zod validates every public, admin, and standings payload; PostgreSQL constraints repeat the important invariants.

Standings are deliberately decoupled from source acquisition:

```text
permitted export or owner-entered table
                 |
                 v
       canonical 20-team payload
                 |
                 v
authenticated import route / local script / admin form
                 |
                 v
 Zod + known-team + position + freshness validation
                 |
                 v
 atomic Neon snapshot activation and derived scoring
```

There is no runtime football API client, production scraper, or Vercel Cron. A future owner-run Codex automation can collect data only from a permitted or licensed source and submit the canonical payload. Manual entry at `/admin/standings` remains the independent fallback.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/RESEARCH.md](docs/RESEARCH.md), and [docs/QA.md](docs/QA.md) for the detailed design, source decisions, and current evidence.

## Stack

- Node.js 24.x
- Next.js 16.3.0 and React 19.2.8
- TypeScript strict mode and Tailwind CSS 4
- `@dnd-kit/react` and `@dnd-kit/helpers`
- Neon Serverless Postgres, Drizzle ORM, and committed migrations
- Zod, Vitest, Testing Library, and Playwright
- Vercel Hobby-compatible deployment

## Local setup

Prerequisites are Node.js 24, npm, a linked Vercel project, and access to the project's Neon integration.

```bash
npm ci
vercel link --project pl-predictions
vercel env pull .env.local
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Never commit `.env.local` or paste complete environment values into logs.

### Environment variables

| Variable                  | Required               | Purpose                                                                                                                                                                                       |
| ------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`            | Yes                    | Pooled production/development Neon connection used by the application, migrations, seed, and local import script. Never point the automated integration or browser journeys at this database. |
| `DATABASE_URL_UNPOOLED`   | Provisioned            | Direct Neon connection supplied by the Marketplace integration; retained for provider tooling even though this app currently uses `DATABASE_URL`.                                             |
| `TEST_DATABASE_URL`       | Tests                  | Preferred explicit connection to an isolated test database or branch. The safety wrapper rejects a target that resolves to `DATABASE_URL`.                                                    |
| `TEST_DATABASE_NAME`      | Local test alternative | Local-only database name used to derive an isolated target from `DATABASE_URL` when `TEST_DATABASE_URL` is not set.                                                                           |
| `ADMIN_SECRET`            | Yes                    | Owner login credential; server-only.                                                                                                                                                          |
| `ADMIN_SESSION_SECRET`    | Yes                    | HMAC key for the signed, eight-hour HttpOnly admin session.                                                                                                                                   |
| `STANDINGS_INGEST_SECRET` | For automated imports  | Bearer credential for `/api/automation/standings`; server-only.                                                                                                                               |
| `PREDICTION_DEADLINE_ISO` | Optional seed input    | Initial ISO deadline for a newly inserted season. Later changes are made in `/admin/settings`.                                                                                                |

There are no `NEXT_PUBLIC` secrets, football-provider token, or cron secret.

## Commands

```bash
npm run dev                 # local development server
npm run format              # write formatting
npm run format:check        # verify formatting
npm run lint                # ESLint with zero warnings
npm run typecheck           # strict TypeScript
npm test                    # unit and component suites
npm run test:integration    # isolated Neon integration suite; fails closed without a safe target
npm run test:coverage       # coverage report
npm run build               # normal Next.js production build
npm run build:verify        # Webpack build used in restricted local QA
npm run test:e2e            # desktop, 320/390/430px Chromium, and iPhone WebKit
npm run test:production-smoke       # read-only public deployment checks
npm run test:production-write-smoke # explicit opt-in, exact-ID submit/delete proof
npm run check               # complete local verification chain
npm run docs:generate       # regenerate every Markdown HTML peer
npm run docs:check          # prove generated HTML is current
```

Database commands:

```bash
npm run db:generate         # generate a migration after an intentional schema change
npm run db:migrate          # apply committed migrations
npm run db:seed             # idempotently seed the active season and 20 clubs
npm run db:test:migrate     # apply migrations only to the isolated test target
npm run db:test:seed        # seed only the isolated test target
```

The committed schema history starts with `drizzle/0000_oval_slyde.sql`. `drizzle/0001_left_iron_fist.sql` adds and backfills the season-level accepted-through standings watermark. Do not edit an already-applied migration; create a new forward migration.

## Standings operations

### Manual fallback

Sign in at `/admin/login`, open `/admin/standings`, order all 20 clubs, and optionally enter matchweek, games played, and league points. A save writes one complete provisional snapshot. Invalid, duplicate, stale, incomplete, or concurrent input cannot replace the last active good table.

A table becomes eligible for final confirmation only when all 20 clubs have 38 played games. Finalization is explicit. Its compare-and-swap database statement claims the exact active snapshot, marks it final, and writes the audit record together; a racing import cannot be accidentally finalized. New imports are blocked until the administrator explicitly undoes final status.

### Authenticated source-neutral import

Prepare a version-1 JSON envelope matching `src/features/standings/validation.ts`. A snapshot contains the season slug, source label, capture timestamp, optional source timestamp/reference and matchweek, plus exactly 20 unique known `teamSlug` rows with positions 1–20. Games played and league points may be null. A source failure can instead be recorded with `kind: "failure"`; it never changes the active table.

Import locally:

```bash
npm run standings:import -- /absolute/path/to/standings.json
```

Or post from an owner-controlled automation:

```bash
curl --request POST "https://pl-predictions-2026.vercel.app/api/automation/standings" \
  --header "Authorization: Bearer $STANDINGS_INGEST_SECRET" \
  --header "Content-Type: application/json" \
  --data-binary @/absolute/path/to/standings.json
```

The endpoint has a 64 KiB body limit, validates a complete known-team permutation, rejects stale, implausibly future, or post-final snapshots, records import outcomes, and preserves the last good snapshot on every failure. A database-time-anchored five-minute skew bound protects both capture timestamps. A season-level accepted-through watermark also advances for newer duplicate observations, so delayed changed data cannot regress the active table. The payload's `isFinal` field is advisory only; only an authenticated administrator can confirm final status.

### FotMob boundary

FotMob was used during one-time research to map factual team identifiers. Its current terms, checked 2026-08-08, prohibit automatic crawlers and systematic or regular extraction; a consumer subscription is not a written automation or redistribution licence. Do not configure Codex or this project to scrape FotMob automatically unless the owner first obtains explicit written permission covering the intended extraction and use. Use a permitted/licensed export or the manual admin table instead. The deployed application stores no source cookies, credentials, HTML, or live API dependency.

## Admin credential retrieval and rotation

The owner's current `ADMIN_SECRET` is stored in macOS Keychain under service `pl-predictions-admin` and account `vishal`. Retrieve it only in a private terminal:

```bash
security find-generic-password -a vishal -s pl-predictions-admin -w
```

To rotate it, first create a strong new value in a password manager. Store it without placing the value in shell history; keeping `-w` last makes Keychain prompt securely:

```bash
security add-generic-password -U -a vishal -s pl-predictions-admin -l "PL Predictions Admin Secret" -w
```

Then stream the Keychain value directly to each Vercel environment and redeploy:

```bash
security find-generic-password -a vishal -s pl-predictions-admin -w | vercel env add ADMIN_SECRET production --sensitive --force
security find-generic-password -a vishal -s pl-predictions-admin -w | vercel env add ADMIN_SECRET preview --sensitive --force
security find-generic-password -a vishal -s pl-predictions-admin -w | vercel env add ADMIN_SECRET development --force
vercel deploy --prod
```

Rotating `ADMIN_SESSION_SECRET` separately invalidates all existing admin sessions. Never rotate either secret by changing source code.

## Deployment

The Vercel project is `vdoshi96s-projects/pl-predictions`. Neon resource `neon-coffee-queen` was provisioned through Vercel Marketplace before migrations and seed data were applied.

For a new environment:

1. Authenticate with `vercel whoami` and link the project.
2. Provision or connect Neon through the current Vercel Marketplace integration.
3. Pull environment variables without printing their values.
4. Run `npm run db:migrate` and `npm run db:seed` against the linked database.
5. Run `npm run check`.
6. Create and inspect a preview with `vercel deploy` and `vercel inspect <preview-url>`.
7. Deploy production with `vercel deploy --prod` and inspect the production URL/logs.
8. Run the read-only production smoke. If a production write proof is required, run only the separately gated exact-ID submit/privacy/delete smoke and verify cleanup. Never run the full reveal/standings journey against production.

No Vercel Cron should be added. Recurring data acquisition belongs to the owner's separate Codex automation and must respect the source boundary above.

## Season rollover and club updates

The application intentionally has one code-selected active season.

1. Verify the new membership and display names against official Premier League sources.
2. Add the new season metadata in `src/data/season.ts` and a complete 20-club fixture in `src/data/teams.ts`. Give every club a stable slug, sort name, permitted asset path, and external mapping only when lawfully sourced.
3. Keep the old season rows; a new slug makes `npm run db:seed` insert a separate season. Do not recycle IDs.
4. Run fixture, scoring, importer, integration, and browser tests, then seed and verify exactly 20 teams.
5. If correcting membership after a season has already been seeded, create an explicit data migration. The idempotent seed updates known teams but deliberately does not delete referenced historical rows.
6. Set the new deadline in `/admin/settings`, verify reveal/lock defaults, and deploy.

## Current limitations

- Club marks remain the 20 project-owned text monograms, not official crests. Names and badges remain the clubs' property; replace assets only after redistribution permission is documented. `TeamMark` already supports transparent authorized crest files without requiring a schema change.
- Standings are manual or accepted through the authenticated canonical importer. There is no built-in provider fetch, sync-now source client, scheduled job, or live-data guarantee.
- Participants have no accounts and cannot edit an entry. The administrator can delete an erroneous entry so it can be resubmitted.
- The seed leaves a new season open when `PREDICTION_DEADLINE_ISO` is unset; the owner must set or lock it in `/admin/settings`.
- Season rollover currently requires a reviewed code and seed update.

## Data and rights attribution

Season membership and preferred club names were verified with the official Premier League 2026/27 table and AGM announcement. FotMob league/team pages supplied one-time factual external-ID mapping only. No FotMob crest file or official Premier League logo is included. Source and rights research is recorded with links and access date in [docs/RESEARCH.md](docs/RESEARCH.md).

This is an unofficial fan project and is not affiliated with the Premier League. Club names and crests belong to their respective owners.
