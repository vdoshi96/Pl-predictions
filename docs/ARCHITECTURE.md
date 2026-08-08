# Architecture

## System boundary

Dranx Prediction League is one Next.js 16 App Router application deployed to Vercel and backed by Vercel Marketplace Neon. Public pages, administrator pages, server actions, and the standings intake route share one codebase. There is no separate backend, client-side source of truth, runtime football API client, production scraper, or Vercel Cron. Existing repository, Vercel, database, URL, and environment identifiers retain their operational `pl-predictions` names.

```text
participant browser                         owner operations
       |                          +-------------------------------+
       |                          | manual table or permitted data |
       v                          +---------------+---------------+
Next.js server components/actions                           |
       |                                                     v
       |                                        canonical version-1 payload
       |                                        /admin form, local script,
       |                                        or authenticated POST route
       |                                                     |
       +----------------------+------------------------------+
                              v
              Zod validation and server policy checks
                              |
                              v
              Drizzle + Neon atomic database writes
                              |
                              v
               dynamic reads and derived scoring
```

The public application never contacts FotMob or another football-data source. A separate owner-run Codex automation may write a snapshot only when its acquisition method is permitted or licensed. FotMob's current terms prohibit automatic crawling and systematic or regular extraction, and a consumer subscription is not sufficient authorization. The manual standings editor remains fully independent of any external source.

## Runtime and deployment

- Vercel project: `vdoshi96s-projects/pl-predictions`.
- Production alias: `https://pl-predictions-2026.vercel.app`.
- Deployment protection: Vercel Authentication is `preview`; production is public and retained previews require Vercel sign-in.
- Database: Neon resource `neon-coffee-queen`, provisioned through Vercel Marketplace before migrations and seed.
- Runtime: Node.js 24.x, Next.js 16.3.0, React 19.2.8, Neon serverless HTTP, and Drizzle ORM.
- Rendering: database-backed pages are dynamic; static local monogram assets may be cached.
- Configuration: server-only Vercel variables; no credential has a `NEXT_PUBLIC` prefix.

## Routes

- `/` — prediction form or server-derived closed state.
- `/leaderboard` — pre-reveal participant roster or the scored table.
- `/entries/[id]` — receipt/admin-authorized private confirmation before reveal; public comparison afterward.
- `/admin/login` — owner credential handoff.
- `/admin` — season and latest-import overview.
- `/admin/submissions` — view and delete erroneous entries.
- `/admin/settings` — UTC deadline, manual lock, and early reveal.
- `/admin/standings` — manual table, import history, final confirmation, and explicit undo.
- `/api/automation/standings` — bearer-authenticated, write-only canonical snapshot/failure intake.
- `/api/health` — shallow non-secret health response.

## Mobile-first presentation

The prediction and manual standings experiences share the same accessible sorter. A 56 by 56 pixel handle is the only element with `touch-action: none`, preserving page scrolling on touch devices. Pointer drag and direct Arrow Up/Arrow Down movement both update position immediately and announce the result through an assertive live region. Rows remain single-column without horizontal overflow, display the top/bottom-half boundary, wrap long names on narrow screens, and use explicit focus rings. The submission action is reachable above safe-area insets, and reduced-motion preferences disable nonessential transitions.

Leaderboard and comparison data use mobile cards before expanding into denser desktop layouts. The administrator navigation becomes a full-width two-column grid at narrow widths without forcing the primary page or prediction list to overflow.

## Prediction write path

1. The browser sends a display name, honeypot, and ordered team UUIDs.
2. Zod requires a normalized 2–40 character name and exactly one occurrence of every active team and position. The server resolves names and assets from its own team rows; it never trusts browser-supplied club metadata.
3. One guarded PostgreSQL common-table-expression statement locks and claims the active season only while manual lock and reveal are both false and the database clock is strictly before any deadline.
4. The same statement inserts the prediction and all 20 dependent items or inserts nothing. This closes request-start/deadline and administrator-lock races without relying on an application clock.
5. A unique `(season_id, normalized_participant_name)` index resolves simultaneous duplicate names safely.
6. A random receipt token is returned once and stored only as a SHA-256 hash. Its HttpOnly cookie permits that browser to view its own table before reveal.

Predictions are immutable. Administrator deletion cascades through all 20 items, allowing a corrected resubmission.

## Reveal and privacy policy

The shared server policy reveals entries after the configured deadline, after a manual lock, or when early reveal is explicitly enabled. Before then, the leaderboard selects only participant names and timestamps. An entry lookup returns no result unless the request has the matching receipt cookie or an administrator session. There is no public route-handler payload containing hidden prediction items.

## Standings intake and last-good preservation

The version-1 canonical envelope is validated in `src/features/standings/validation.ts` and accepts either:

- `kind: "snapshot"` with exactly 20 known team slugs, unique actual positions 1–20, capture time, source, optional matchweek/source metadata, and nullable games/points; or
- `kind: "failure"` with a bounded failure code/message and observation time.

The same importer powers the local script, authenticated POST route, and manual administrator form. It computes a canonical SHA-256 content hash from standings facts, stores immutable first-seen snapshot provenance separately, and records every received/succeeded/rejected/duplicate/failed run. The season row also stores `standings_accepted_through`, a monotonic capture-time watermark advanced by each accepted activation or newer observation of the active content. Equal-time retries are idempotent, older observations are rejected, and a genuinely newer observation that returns to historical content reactivates that existing immutable snapshot. Public freshness labels use the watermark while the matching import run preserves the newer observation's source and capture metadata. Failure envelopes and invalid input never change the active pointer or watermark.

Snapshot insertion, 20 standings rows, import-run rows, and attempted activation are one Drizzle batch. Activation uses a compare-and-swap predicate requiring the active snapshot observed at the start, a null final pointer, and a capture time newer than the current watermark. PostgreSQL rechecks that predicate after concurrent row writers commit. A losing concurrent import is recorded as rejected; its complete validated content row may remain as immutable history so a concurrent identical observation can safely activate it without racing a cleanup delete. An exact duplicate of the current final content may advance only the watermark and cannot replace either final pointer.

Source-provided `isFinal` is advisory and excluded from content identity. Every newly stored snapshot is provisional, and reactivating historical content does not elevate it to final status.

## Race-safe finalization

Final status requires exactly 20 standings rows with `played_games = 38` and explicit administrator confirmation. One PostgreSQL common-table-expression statement:

1. claims the season only if the chosen snapshot is still the exact active snapshot and no final pointer exists;
2. sets that season's final pointer;
3. marks the same snapshot final; and
4. writes the administrator audit row.

All four effects succeed together or the action reports that the active standings changed. This compare-and-swap is complementary to import activation, so an import/finalize race cannot finalize one snapshot while activating another. A final pointer blocks differing imports until the owner explicitly confirms undo. Undo is a second single-statement compare-and-swap requiring the same snapshot to remain both active and final before it clears the pointer, unmarks that snapshot, and records the audit together. The current table remains active when final status is undone.

## Scoring and leaderboard

Scores are computed on read from prediction items plus the one active standings snapshot. They are never accumulated or stored as independently editable totals. Each club receives exactly one tier: 5 exact, otherwise 3 within three, otherwise 1 in the same half, otherwise 0. The system derives total, exact count, within-three count, and correct-half-only count.

All-zero played-games tables are treated as preseason and remain unscored. When scoring is active, entries sort by total descending; equal totals receive the same competition rank and are alphabetized only for deterministic display. The maximum is 100.

## Database model and invariants

- `seasons` stores the code-selected season, fairness settings, active/final pointers, and the monotonic accepted-capture watermark.
- `teams` stores season-scoped names, sort names, factual external mapping, and permitted local asset path.
- `predictions` and `prediction_items` store immutable participant tables and receipt hashes.
- `standings_snapshots` and `standings_items` store complete actual tables.
- `standings_import_runs` preserves bounded outcome metadata for every attempt; `standings_import_run_items` retains row facts for activation attempts without storing arbitrary malformed input.
- `admin_audit_logs` records administrator mutations with a request identifier when supplied by the platform.

PostgreSQL duplicates application invariants with foreign keys, position checks, name-length checks, season/team uniqueness, team/position uniqueness per prediction or snapshot, and useful lookup indexes. Timestamps use PostgreSQL `timestamp with time zone` and application `Date` values.

## Administrator trust boundary

`ADMIN_SECRET` is compared through fixed-length SHA-256 digests and constant-time equality. Successful login issues a signed, random-nonce, eight-hour cookie that is HttpOnly, SameSite Strict, Secure in production, and contains no credential. Every administrator mutation revalidates the session and same-origin request metadata. Logout expires the cookie with matching attributes.

The standings route independently requires a minimum-length `STANDINGS_INGEST_SECRET`, compares fixed-length digests in constant time, rejects bodies above 64 KiB, and returns bounded errors without source or database details. Public submission has a honeypot and stores no account, email, IP address, or other personal data beyond the chosen display name.

Security headers set a self-restricted content security policy, deny framing, disable MIME sniffing, restrict referrers, and disable camera, microphone, geolocation, payment, and USB browser permissions.

## Assets and rights

The user-facing visual system is Dranx Prediction League: a Premier-League-inspired palette anchored on official purple `#37003c`, with cyan `#05f0ff`, green `#00ff87`, and pink `#ff2882` accents and an original Dranx mark. The official Premier League logo is not included.

The 20 club assets remain independent text monograms with accessible club-name alternatives. FotMob crest downloads were not added because repository policy and current official terms require authorization before copying or redistributing those marks. `teams.asset_path` continues to provide the stable local-asset seam. The shared `TeamMark` uses contain sizing, a neutral backing, and a labelled initials fallback, so authorized transparent files can replace monograms later without changing the schema or public workflows.

## Failure behavior

- Missing or invalid database configuration fails server-side without revealing credentials.
- Missing seed data produces a clear operational error rather than a partial 20-team UI.
- Malformed, stale, duplicate, unauthorized, concurrent, or post-final imports preserve the active snapshot.
- With no meaningful snapshot, the leaderboard retains the participant count and says scoring has not started.
- A source acquisition failure can be recorded without changing public standings.
- Manual standings remain available when external acquisition is unavailable.
