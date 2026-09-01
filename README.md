# Dranx Prediction League

Dranx Prediction League is an unofficial, mobile-first prediction game for a private invited group. The original season game uses one immutable three-stage table and Spotlight entry. The separate Win Streak mini game runs from Matchweek 2 through Matchweek 38: choose one club to win, build a personal best, and continue after a failed pick. Its leaderboard is public before profile creation and shows the current-matchweek pick.

Production: [https://pl-predictions-2026.vercel.app](https://pl-predictions-2026.vercel.app)

GitHub: [https://github.com/vdoshi96/Pl-predictions](https://github.com/vdoshi96/Pl-predictions)

Deployment status: production is public and Ready at the stable alias above. Win Streak [PR #39](https://github.com/vdoshi96/Pl-predictions/pull/39) merged as `19bf11b4df43f8c3410f704fb278d1d4bdd845b5`; exact deployment `dpl_BTncZC77GmA3EXtaUjAKvfWZvRzP` is Ready and owns the stable alias. Additive migration `0010` and the targeted 37-round/370-fixture seed are applied and verified. Vercel Authentication remains enabled for previews while production remains anonymously accessible. Current and historical evidence is recorded in [docs/QA.md](docs/QA.md).

## Brand and local assets

The user-facing identity is Dranx Prediction League. Its Premier-League-inspired palette anchors on the league's official purple, `#37003c`, with cyan `#05f0ff`, green `#00ff87`, and pink `#ff2882` accents and an original Dranx mark. The original mark is used instead of the official Premier League logo.

The project owner supplied one transparent PNG badge for each of the 20 clubs and explicitly directed their use in this application. Those local files are now the canonical team marks; the shared `TeamMark` uses contain sizing, a neutral backing, and a labelled initials fallback. The original SVG monograms remain only as rollback-safe files during the first PNG release. The owner-provided handoff does not imply affiliation, transfer ownership of the club marks, or authorize the separate Premier League logo/lion/ball files, none of which are used.

The owner also supplied the dated `premier-league-players-2026-08-20/` roster snapshot and selected it for the player selectors. It contains 580 players across the app's 20 clubs and 578 portrait PNGs. Ryan McAidoo and Luc De Fougerolles intentionally use the generic silhouette because the handoff has no verified portrait for them. The handoff and application fixture are reconciled internally; this update does not claim independent verification against official club or Premier League roster pages. The app imports the snapshot into its season catalogue and serves copied local portraits; it does not run the handoff's acquisition scripts or fetch player data or images at runtime.

On 2026-08-14 the owner confirmed that the required permissions for this player-catalogue workflow have been obtained, including acquisition, storage, redistribution, and production use. Owner-run FotMob or Transfermarkt acquisition may therefore run offline and produce a reviewed snapshot. This permission disposition removes the former source-specific licence gate; it does not change the deployed application's no-runtime-fetch, no-scrape, no-hotlink, no-football-API, and no-Cron boundary.

The August 20 fixture is the current production catalogue. After the exact application deployment became Ready, the owner-approved supported seed ran once and printed `Seeded 20 teams and 580 players for 2026/27 Premier League.` Read-only verification found 613 total player rows: 580 active, 33 preserved inactive, 578 active local portrait paths, and the two expected silhouette fallbacks. All 578 portrait URLs returned valid PNG responses, and the live catalogue returned all 580 names.

Evidence-only closeout [PR #16](https://github.com/vdoshi96/Pl-predictions/pull/16) merged on 2026-08-14 at 13:58:28 UTC as `98210965bfa6d586ef595c33038761e80f45b765`. Local `main` was fast-forwarded to and exactly matched `origin/main` at that commit before cleanup. The completed feature worktree and branches were removed, leaving one primary worktree. Primary private handoffs and the newest QA evidence remain; verified duplicate worktree handoffs and superseded QA evidence were moved recoverably to Trash. The unrelated untracked `Premier League 2026-27 PNG Assets/` folder remains intentionally retained and out of scope.

### Player snapshot source card

| Field                | Value                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Local handoff        | `premier-league-players-2026-08-20/` (owner-provided raw snapshot)                                                    |
| Snapshot date        | 2026-08-20                                                                                                            |
| Coverage             | 580 players across all 20 application clubs                                                                           |
| Portrait coverage    | 578 supplied PNGs; Ryan McAidoo and Luc De Fougerolles use the silhouette fallback                                    |
| Roster authority     | Owner-selected snapshot; internally reconciled, not independently official-site verified                              |
| Application boundary | Reviewed roster import and local portrait serving only; no runtime fetch, scrape, or hotlink                          |
| Result-data boundary | This snapshot supplies selector identities and portraits, not goals, assists, clean sheets, or season-rating outcomes |
| Production state     | Released and seeded once; 580 active players, 578 portraits, and two silhouette fallbacks                             |

## Product behavior

- `/` presents the three-stage table, spotlight-pick, and final-review journey, followed by receipt confirmation.
- `/leaderboard` shows table points only, with a maximum of 100. Before reveal, totals remain 0 and spotlight picks stay private. After scoring starts, each card shows the table score and the champion's current position.
- `/spotlight` tracks the seven predictions for fun. Users can sort by overall available accuracy or one category. Before reveal it publishes only the complete-bracket count; real picks and accuracy ordering stay private.
- `/win-streak` is the separate Matchweek 2–38 mini game. Its leaderboard is visible without a profile and publishes best streak, current streak, and the current-round pick. Playing uses a 2–40-character display name plus a secure browser receipt; there is no login. Enter the same display name to resume after cookie loss.
- `/entries/[id]` is private to the receipt browser or administrator before reveal, then becomes the public club-by-club comparison.
- `/rules` opens with a three-step how-to-play walkthrough using annotated 390 × 844 screenshots captured from the current mobile flow, then explains the table tiers, seven spotlight categories, ranking formulas, privacy boundary, and current data status.
- `/admin` provides owner-only fixed-kickoff visibility, irreversible closure controls, submission deletion, manual standings, import history, final-table controls, the five-table manual results desk at `/admin/results`, and complete-round Win Streak results at `/admin/win-streak`.
- `/api/player-catalogue` dynamically returns the minimal active-season player display/search shape when Stage 2 first needs it.
- `/api/automation/standings` accepts a source-neutral, bearer-authenticated snapshot or failure record. It never fetches a football-data service itself.

### Seven spotlight picks

Every category uses its own searchable selector:

- **Top scorer** and **top assister** choose a player and use the chosen player's occupied rank in the reviewed goals or assists list.
- **Most clean sheets** chooses a club, not a player, and uses the club's occupied rank in the reviewed clean-sheets list.
- **Underdog team** ranks only underdog-team picks by `average predicted position - actual position`, largest first.
- **Overrated team** ranks only overrated-team picks by `actual position - average predicted position`, largest first.
- **Underdog player** ranks only underdog-player picks by reviewed average season rating from highest to lowest.
- **Overrated player** ranks only overrated-player picks by reviewed average season rating from lowest to highest.

The initial `/` render does not query or serialize the 580-player catalogue in HTML or RSC. On first entry to Stage 2, the client lazily requests `GET /api/player-catalogue` from the same origin. The dynamic, no-store route SQL-filters active players for the current season and returns only `id`, `firstName`, `lastName`, `displayName`, and local `assetPath` values. A failed request exposes Retry and never removes **Other player**.

Player options are searchable by first, last, or full name across the 2026-08-20 snapshot. A selector requires at least two normalized characters before catalogue matches appear, announces the total match count, and renders at most 20 matching rows. **Other player** remains available at every query length, including loading, empty, and error states, and shows a required name field for an unavailable or new player. The sticky review action is hidden while the one active selector popup is open. Club categories use the existing local crests. Each custom name must map to a canonical season player before its reviewed dataset can be published and scored.

The display name appears before the club sorter. Until submission, the browser stores a versioned, season-keyed local draft containing the name, exact 20-club order, stage, partial picks, and selected-player display metadata. Reload restores a valid compatible draft; malformed or stale data is discarded safely. A draft survives validation, network, and server failures and is cleared only after a successful atomic submission or server-verified permanent closure. The table starts in deterministic A–Z order as an explicit blank slate. Continuing without reordering requires an accessible **Yes, use A–Z** confirmation; Reset and restored A–Z drafts require a fresh acknowledgement.

Table scoring is mutually exclusive for each club: 5 points exact, 3 within three places, 1 in the same half, or 0. An exact table scores 100. The predicted champion is position 1 and has no separate bonus. Spotlight accuracy never changes this score. Let `N` be the current number of active, nondeleted season brackets. Accuracy points are `max(0, N + 1 - outcome rank)`. Overall accuracy sums only resolved categories. A resolved zero-point result still counts as available. Pending categories remain unavailable. Equal overall scores share a competition rank. Category sorts use outcome rank from low to high, put pending entries last, and use participant name for deterministic ties.

Underdog-team and overrated-team rankings use submitted tables and the active standings. For example, an average prediction of 2.4 and actual position 10 gives an underdog index of `-7.6`. The overrated index is `+7.6`. Full precision determines rank, but each category ranks only the clubs picked for that category. The owner enters the five factual outcomes through `/admin/results`: goals, assists, club clean sheets, and one shared player-ratings dataset shown in synchronized high/low views. Each ratings view contains its category's picked players, while overlapping players share one editable rating. A picked player without a rating remains pending. Missing datasets remain pending; a published goals, assists, or clean-sheets list makes an omitted canonical subject explicitly outside scoring range with zero points. No table receives points before the verified Gameweek 1 opener. A table snapshot from before kickoff remains inactive afterward.

### Results operations

- **Save draft** validates the row shapes, computes competition ranks without pre-rounding, pins the relevant current Other-player aliases, inserts the facts, seals the new immutable version, atomically advances the exact working pointer, and writes its audit. It does not change public scoring.
- **Publish provisional** requires permanently closed/revealed submissions, at least one current bracket, explicit owner attestation, every relevant submitted Other spelling mapped to a canonical season player, and complete goals, assists, or clean-sheets coverage through rank `N` with every boundary tie. A player-ratings version instead requires one rating for every distinct player picked in either opinion-player category and rejects unpicked rows. A stale or already-active working version is a no-op conflict and writes no success audit.
- **Finalize** pins the exact active snapshot. Owner-only final-status undo clears that exact final pointer while leaving the version provisionally active; it never reopens submissions or reverses reveal.
- Goals, assists, and clean sheets are nonnegative integers. Shared player ratings are values from 0 through 10 with at most three decimal places; the high and low tables project the same exact rows. New factual players are inactive result-only rows, and an existing normalized player name must be reused rather than duplicated.
- Missing snapshots, unresolved aliases, and missing picked-player ratings remain pending and do not increase anyone's available-category count. After a complete goals, assists, or clean-sheets snapshot publishes, listed subjects use their competition rank while an omitted canonical subject is explicitly outside the scoring range with zero points.

Submissions close at Arsenal v Coventry City's opening kickoff at `2026-08-21T19:00:00.000Z` (20:00 BST on Friday 21 August 2026). The season-scoped `opening_kickoff` is persisted in PostgreSQL and is the sole timed submission cutoff. The nullable `submission_deadline` column remains only for schema and migration compatibility and is ignored by runtime policy, seed, environment configuration, and the guarded insert. Admin settings show the same instant in Central Time plus a selectable Eastern, Central, Mountain, Pacific, or UTC rendering with DST-aware abbreviations. The owner can close earlier only through **Lock submissions now** or **Reveal predictions early**, whose accessible dialogs and server actions require exact `LOCK` or `REVEAL`; both reveal predictions and permanently close submissions. A compact calendar-flip countdown beside the open-submissions status begins from the server's database-time reading and is presentation only. The guarded insert acquires the season-row lock before rechecking PostgreSQL's live wall clock, so a stale page or request blocked across kickoff cannot submit late.

## Mobile-first interaction

The prediction and manual-standings lists are single-column and have no horizontal overflow at narrow widths. Each row has a dedicated 56 by 56 pixel move handle; `touch-action: none` is limited to the handle so the rest of the page still scrolls naturally. The same handle supports pointer dragging, one-place Arrow movement, five-place Page Up/Page Down movement, and Home/End jumps with polite live screen-reader announcements. Position numbers update immediately, the top/bottom-half boundary is visible, focus states are explicit, reduced-motion preferences are respected, and the compact review action remains reachable above the mobile safe area. The how-to cards use horizontal snap scrolling on phones and a three-column layout on wide screens; numbered overlay pins have matching text callouts so the screenshot annotations are not colour- or vision-dependent.

## Architecture

The application is one Next.js 16 App Router deployment on Vercel. Dynamic server components and server actions read and mutate a Vercel Marketplace Neon database through Drizzle and the Neon serverless HTTP driver. Zod validates every public, admin, and standings payload; PostgreSQL constraints repeat the important invariants.

Standings are deliberately decoupled from source acquisition:

```text
reviewed offline source or owner-entered table
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

There is no runtime football API client, production scraper, image hotlink, or Vercel Cron. Owner-run acquisition may produce reviewed data offline, but factual spotlight outcomes enter only through the authenticated `/admin/results` desk. Save creates a new immutable working snapshot; publish atomically advances the exact active pointer after permanent submission closure, bracket-count coverage, boundary-tie, and alias checks; finalize pins that exact active version. Manual entry at `/admin/standings` remains the standings fallback.

Win Streak fixtures are generated offline from the official Premier League schedule, committed as canonical JSON, and seeded into four dedicated tables for rounds, fixtures, receipt-bound profiles, and picks. Public scoring is derived from immutable facts. The authenticated results desk resolves exactly ten fixtures in one ordered atomic transition. The update-results workflow checks official fixture drift first and permits only an inspected kickoff-only correction for a future, unpicked, unresolved fixture through the targeted seed.

Every Win Streak pick in a matchweek locks at that round's earliest persisted fixture kickoff. The PostgreSQL clock is authoritative; choosing a club that plays later does not extend the pick window.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/RESEARCH.md](docs/RESEARCH.md), [docs/WIN-STREAK.md](docs/WIN-STREAK.md), and [docs/QA.md](docs/QA.md) for the detailed design, rules, source decisions, and current evidence.

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

| Variable                           | Required               | Purpose                                                                                                                                                                                       |
| ---------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                     | Yes                    | Pooled production/development Neon connection used by the application, migrations, seed, and local import script. Never point the automated integration or browser journeys at this database. |
| `DATABASE_URL_UNPOOLED`            | Provisioned            | Direct Neon connection supplied by the Marketplace integration; retained for provider tooling even though this app currently uses `DATABASE_URL`.                                             |
| `TEST_DATABASE_URL`                | Tests                  | Preferred explicit connection to an isolated test database or branch. The safety wrapper rejects a target that resolves to `DATABASE_URL`.                                                    |
| `TEST_DATABASE_NAME`               | Local test alternative | Local-only database name used to derive an isolated target from `DATABASE_URL` when `TEST_DATABASE_URL` is not set.                                                                           |
| `ADMIN_USERNAME`                   | Admin                  | Owner username; defaults to `admin` when unset.                                                                                                                                               |
| `ADMIN_PASSWORD_HASH`              | Preferred admin config | Salted `pbkdf2_sha256` password hash; server-only. This takes precedence over the legacy secret.                                                                                              |
| `ADMIN_SECRET`                     | Legacy fallback        | Transitional password fallback used only when `ADMIN_PASSWORD_HASH` is absent; server-only.                                                                                                   |
| `ADMIN_SESSION_SECRET`             | Yes                    | HMAC key for the signed, eight-hour HttpOnly admin session.                                                                                                                                   |
| `STANDINGS_INGEST_SECRET`          | For automated imports  | Primary bearer credential for `/api/automation/standings`; server-only.                                                                                                                       |
| `STANDINGS_INGEST_SECRET_PREVIOUS` | Rotation only          | Optional previous bearer credential accepted during a bounded rotation. Remove it after every caller uses the primary credential.                                                             |

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
npm run test:e2e            # deterministic pre/post-kickoff desktop, 320/390/430px Chromium, and iPhone WebKit phases
npm run test:production-smoke       # read-only public deployment checks
npm run test:production-write-smoke # explicit opt-in, exact-ID submit/delete proof
npm run admin:hash-password         # read a password from stdin and emit its PBKDF2 hash
npm run check               # complete optimized local verification chain
npm run docs:generate       # regenerate every Markdown HTML peer
npm run docs:check          # prove generated HTML is current
npm run win-streak:fixtures:check # compare the canonical snapshot with the official fixture page
npm run win-streak:fixtures:apply # write a reviewed candidate snapshot for inspection
```

Markdown remains canonical. The documentation generator inventories only Git-tracked or nonignored files through NUL-delimited paths, excludes private handoffs and QA assets, rejects source/output symlinks and unmanaged same-basename HTML, writes peers through same-directory atomic renames, and removes only orphaned HTML carrying a recognized legacy or current generator marker. Source hashes, heading IDs, and local Markdown-to-HTML links are deterministic; focused unit tests enforce those boundaries.

Database commands:

```bash
npm run db:generate         # generate a migration after an intentional schema change
npm run db:migrate          # apply committed migrations
npm run db:seed             # idempotently seed the active season and 20 clubs
npm run db:seed:win-streak  # seed or safely refresh only the 37 Win Streak rounds and 370 fixtures
npm run db:test:migrate     # apply migrations only to the isolated test target
npm run db:test:seed        # seed only the isolated test target
npm run db:test:seed:win-streak # seed Win Streak only through the isolated safety wrapper
```

The committed schema history starts with `drizzle/0000_oval_slyde.sql`. `drizzle/0001_left_iron_fist.sql` adds and backfills the season-level accepted-through standings watermark. `drizzle/0002_breezy_king_cobra.sql` persists and backfills each season's reviewed opening kickoff while preserving the null automatic-deadline sentinel. That nullable deadline field is now legacy compatibility state and is not an application cutoff. `drizzle/0003_fluffy_franklin_richards.sql` adds the season-scoped player catalogue and the seven category-pick rows attached to each prediction. `drizzle/0004_aromatic_kat_farrell.sql` tightens the player-pick subject constraint so a player ID or both normalized custom-name fields are explicitly required. `drizzle/0005_enforce_spotlight_seasons.sql` adds database triggers that prevent a player's club or a category subject from crossing season boundaries. `drizzle/0006_complex_ultimatum.sql` adds the four result-dataset states, immutable snapshot/items, mutable working aliases, publication pointers, cross-season/type checks, and empty pending-state backfill. `drizzle/0007_brainy_harpoon.sql` adds immutable aliases pinned to each snapshot so later working-alias changes cannot rewrite published scoring. These two migrations also seal a snapshot before any pointer may reference it and reject later fact appends. `drizzle/0008_previous_ezekiel_stane.sql` adds revocable administrator sessions and persistent security rate-limit buckets. `drizzle/0009_condemned_nighthawk.sql` enforces final/active standings-pointer consistency, same-season prediction clubs, and immutability or referenced-delete protection for accepted standings facts. `drizzle/0010_win_streak_live.sql` adds durable Win Streak rounds, fixtures, receipt-bound profiles, immutable picks, safe future fixture refresh constraints, and the two public-mutation rate-limit scopes. `drizzle/0011_win_streak_name_resume.sql` permits an existing profile's receipt hash to rotate while its identity, joined round, history, and picks remain immutable. Do not edit a migration after it has been applied to production; create a new forward migration.

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

The endpoint has a 64 KiB body limit, a persistent 60-request-per-minute source limit, and a bounded two-secret rotation path. It validates a complete known-team permutation, rejects stale, implausibly future, or post-final snapshots, records import outcomes, and preserves the last good snapshot on every failure. A database-time-anchored five-minute skew bound protects both capture timestamps. A season-level accepted-through watermark also advances for newer duplicate observations, so delayed changed data cannot regress the active table. The payload's `isFinal` field is advisory only; only an authenticated administrator can confirm final status.

### Offline source boundary

The owner confirmed on 2026-08-14 that the required permissions for this player-catalogue workflow have been obtained. Owner-run FotMob or Transfermarkt acquisition may run offline, retain its private provenance, and produce reviewed local snapshots or result payloads. The deployed application still stores no source cookies or credentials and never performs a runtime source request, scrape, hotlink, football API call, or scheduled acquisition.

## Admin credential configuration and rotation

The login accepts a username and password. `ADMIN_USERNAME` defaults to `admin`; set it explicitly in deployed environments for clarity. The preferred password configuration is `ADMIN_PASSWORD_HASH`, a randomly salted `pbkdf2_sha256` hash using 600,000 iterations, a 16-byte salt, and a 32-byte digest. Store only the encoded hash in Vercel's server-only environments and keep the raw password in the owner's password manager. Never place the password, hash, or session secret in source, command history, logs, screenshots, or documentation.

The current owner password is stored in macOS Keychain under service `pl-predictions-admin` and account `vishal`. `npm run admin:hash-password` reads the password from standard input, removes only the single line ending conventionally added by the provider, and emits a newly salted encoded hash. Stream Keychain directly through that command into Vercel so neither plaintext nor the generated hash is stored in a shell variable or temporary file:

```bash
security find-generic-password -a vishal -s pl-predictions-admin -w | npm run --silent admin:hash-password | vercel env add ADMIN_PASSWORD_HASH production --sensitive --force
security find-generic-password -a vishal -s pl-predictions-admin -w | npm run --silent admin:hash-password | vercel env add ADMIN_PASSWORD_HASH preview --sensitive --force
security find-generic-password -a vishal -s pl-predictions-admin -w | npm run --silent admin:hash-password | vercel env add ADMIN_PASSWORD_HASH development --force
printf '%s\n' admin | vercel env add ADMIN_USERNAME production --force
printf '%s\n' admin | vercel env add ADMIN_USERNAME preview --force
printf '%s\n' admin | vercel env add ADMIN_USERNAME development --force
vercel deploy --prod
```

Each password-hash command intentionally produces a different salt; all resulting hashes validate the same Keychain password. `ADMIN_SECRET` remains a migration-only fallback when `ADMIN_PASSWORD_HASH` is empty. After the PBKDF2-backed login is verified in every environment, remove the legacy value rather than keeping two active password sources. A malformed or weak configuration fails closed. Rotating `ADMIN_SESSION_SECRET` separately invalidates all existing eight-hour administrator sessions. Logout also revokes the current hashed session nonce in PostgreSQL. Applying migration `0008` invalidates cookies issued before the persistent session registry existed, so the owner must sign in again after that migration and deployment.

Every administrator mutation still requires the signed HttpOnly, SameSite Strict cookie and an exact same-origin request. A persistent application limiter allows five password attempts per source in 15 minutes and blocks further PBKDF2 work with HTTP 429; the Vercel Firewall remains an outer layer. Deleting an entry removes the parent prediction. PostgreSQL cascades through its 20 table rows and seven spotlight rows. The deletion invalidates the receipt and lets the normalized name submit again. Table ranks, team expectation indexes, and spotlight accuracy, including `N`, recalculate from the remaining entries. The bounded deletion audit remains.

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

For an existing production environment, run the official fixture check before Win Streak result work. When it reports no drift, do not rewrite or reseed fixtures. Apply migration `0010`, confirm its exact production target and unchanged existing aggregates, and run only `npm run db:seed:win-streak`; never use the general seed for a fixture refresh. The targeted seed permits an inspected future, unpicked, unresolved kickoff-only correction and fails closed on changed teams, pairings, matchweeks, expired rounds, picks, or results.

No Vercel Cron should be added. Recurring data acquisition belongs to the owner's separate offline Codex automation and must preserve the reviewed-import boundary above.

## Season rollover and club updates

The application intentionally has one code-selected active season.

1. Verify the new membership and display names against official Premier League sources.
2. Add the new season metadata in `src/data/season.ts` and a complete 20-club fixture in `src/data/teams.ts`. Give every club a stable slug, sort name, reviewed local asset path, and stable external mapping.
3. Keep the old season rows; a new slug makes `npm run db:seed` insert a separate season. Do not recycle IDs.
4. Run fixture, scoring, importer, integration, and browser tests, then seed and verify exactly 20 teams.
5. If correcting membership after a season has already been seeded, create an explicit data migration. The idempotent seed updates known teams but deliberately does not delete referenced historical rows.
6. Verify the first Gameweek 1 kickoff from an official source, update the auditable opening-fixture constant, and add a reviewed forward migration/data update for that season's `opening_kickoff`. Do not configure the legacy `submission_deadline`. Never reopen a season after kickoff, manual lock, or early reveal; use the irreversible administrator closure controls if entries must close before kickoff.
7. Generate a complete official-season Win Streak snapshot, explicitly choose the contest's first matchweek, validate all 20 clubs and ten fixtures per included round, and seed it only after the new season and team rows exist. Preserve old-season rounds and picks rather than recycling identifiers.

## Current limitations

- Club marks use the 20 owner-provided local PNG badges. Names and marks remain their respective owners' property; the repository records the project owner's direction to use this exact set, not a broader licence for other league or club artwork. The original monograms remain rollback-only during the first PNG release.
- Standings are manual or accepted through the authenticated canonical importer. There is no built-in provider fetch, sync-now source client, scheduled job, or live-data guarantee.
- The owner-provided 2026-08-20 snapshot supplies 580 player options and 578 local portraits. Ryan McAidoo and Luc De Fougerolles use the silhouette fallback, and Other player remains available for unavailable or newly added players.
- Production currently has active provisional snapshots for all four factual datasets that back the five result views; none was final at the 2026-08-22 release preflight. The owner can review, replace, or finalize them through `/admin/results`. No provider acquisition is built in. The former Alex/Jordan spotlight cards were hard-coded presentation fixtures, not stored submissions; they were retired so `/spotlight` represents only complete real entries.
- Participants have no accounts and cannot edit an entry. The administrator can delete an erroneous parent entry, cascading through all 20 table rows and seven spotlight picks so it can be resubmitted.
- Win Streak also has no account. A display name belongs to one season profile and uses a replaceable secure browser receipt. If the cookie is lost, entering the same display name rotates the receipt and resumes the profile. The season is capped at 500 profiles. Its leaderboard and current-matchweek picks are public.
- Win Streak fixtures are a reviewed static official snapshot rather than a runtime feed. Date-only fixtures use documented UK-time defaults and every run of update-results checks for official drift. Protected or structural drift requires explicit owner review.
- The opening fixture is reviewed static season data, not a live schedule feed. Because Premier League fixtures can change, the owner must update both the canonical UTC fixture metadata and the persisted season row through a reviewed forward migration before the existing cutoff if the opener moves. A constant-only deploy does not change the database-enforced instant.
- Season rollover currently requires a reviewed code and seed update.

## Data and rights attribution

Season membership and club names use the official Premier League 2026/27 table and AGM announcement. Win Streak pairings and timing bases use the official complete fixture list and schedule announcement checked August 23, 2026; fixtures remain subject to change. On 2026-08-14 the owner confirmed that the required permissions for this player-catalogue workflow have been obtained, including acquisition, storage, redistribution, and production use. Owner-run FotMob or Transfermarkt acquisition may run offline and produce reviewed local snapshots or result payloads. The deployed application does not fetch, scrape, or hotlink football data or images at runtime. FotMob average season rating is the requested metric for both player-opinion categories. The project owner supplied the local club badges and dated player snapshot. The official Premier League logo is not included. The roster import does not supply the five pending outcomes. [docs/RESEARCH.md](docs/RESEARCH.md) and [docs/WIN-STREAK.md](docs/WIN-STREAK.md) record the dated sources and current boundaries.

This is an unofficial fan project and is not affiliated with the Premier League. Club names and crests belong to their respective owners.
