# Architecture

## System boundary

Dranx Prediction League is one Next.js 16 App Router application deployed to Vercel and backed by Vercel Marketplace Neon. Public pages, administrator pages, server actions, and the standings intake route share one codebase. Each submission is one immutable parent with a 20-club ordering and seven spotlight picks. There is no separate backend, client-side source of truth, runtime football API client, production scraper, or Vercel Cron. Existing repository, Vercel, database, URL, and environment identifiers retain their operational `pl-predictions` names.

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

The public application never contacts FotMob or another football-data source. The owner-provided `premier-league-players-2026-08-08/` handoff supplies selector identities and portrait files. The deployed app never executes its acquisition code. The handoff does not supply competition outcomes. A future owner-run Codex automation will enter the five non-table-derived outcomes manually. It must use permitted or licensed source material. The current importer and manual editor handle standings only. Missing spotlight outcomes remain pending and do not receive zero.

## Runtime and deployment

- Vercel project: `vdoshi96s-projects/pl-predictions`.
- Production alias: `https://pl-predictions-2026.vercel.app`.
- Deployment protection: Vercel Authentication is `preview`; production is public and retained previews require Vercel sign-in.
- Database: Neon resource `neon-coffee-queen`, provisioned through Vercel Marketplace before migrations and seed.
- Runtime: Node.js 24.x, Next.js 16.3.0, React 19.2.8, Neon serverless HTTP, and Drizzle ORM.
- Rendering: database-backed pages are dynamic; static local club badges and imported player-face assets may be cached and optimized by Next.js.
- Configuration: server-only Vercel variables; no credential has a `NEXT_PUBLIC` prefix.

## Routes

- `/` — three-stage table, spotlight, and review flow or the server-derived closed state.
- `/leaderboard` — 0-point champion-pick cards before reveal and a shared-rank table-only leaderboard afterward. The maximum is 100 points.
- `/spotlight` — a separate fun-accuracy leaderboard with overall and category sorts. Before reveal it exposes only the number of complete brackets, not their picks or hidden ordering.
- `/entries/[id]` — receipt/admin-authorized private confirmation before reveal; public comparison afterward.
- `/rules` — an annotated three-screen live-mobile walkthrough followed by table tiers, spotlight rank rules, team formulas, privacy, and pending-data explanation.
- `/admin/login` — owner credential handoff.
- `/admin` — season and latest-import overview.
- `/admin/submissions` — view and delete erroneous entries.
- `/admin/settings` — UTC deadline, manual lock, and early reveal.
- `/admin/standings` — manual table, import history, final confirmation, and explicit undo.
- `/api/automation/standings` — bearer-authenticated, write-only canonical snapshot/failure intake.
- `/api/health` — shallow non-secret health response.

## Mobile-first presentation

The prediction and manual standings experiences share the same accessible sorter. A 56 by 56 pixel handle is the only element with `touch-action: none`, preserving page scrolling on touch devices. Pointer drag and direct Arrow Up/Arrow Down movement both update position immediately and announce the result through an assertive live region. Rows remain single-column without horizontal overflow, display the top/bottom-half boundary, wrap long names on narrow screens, and use explicit focus rings. The spotlight stage uses keyboard-operable combobox/listbox controls with name filtering, visible selection state, and a focused free-text input after Other player is chosen. The submission action is reachable above safe-area insets, and reduced-motion preferences disable nonessential transitions. The rules walkthrough renders three live-site 390 × 844 captures as snap-scrolling cards on phones and a three-column grid on wide screens. CSS overlay pins and adjacent numbered text carry the same annotation semantics.

The open-submissions panel includes a compact days/hours/minutes/seconds calendar-flip countdown. Its initial duration is calculated on the server from the database wall clock and effective deadline. The client advances that duration from monotonic `performance.now()` rather than trusting the participant device clock, then refreshes the server page once at zero. This display never authorizes a write; the database-locking cutoff in the prediction write path remains authoritative.

Leaderboard and comparison data use mobile cards before expanding into denser desktop layouts. The administrator navigation becomes a full-width two-column grid at narrow widths without forcing the primary page or prediction list to overflow.

## Prediction write path

1. Stage 1 collects a normalized display name and the ordered 20-club table; stage 2 collects all seven spotlight categories; stage 3 presents the final table and spotlight review before confirmation.
2. The browser sends the display name, honeypot, ordered team UUIDs, and seven typed category choices. Zod requires a 2–40 character normalized name, exactly one occurrence of every active team and position, exactly one row for each category, a current-season club for team categories, and either a current active player or normalized 2–120 character custom name for player categories. The server resolves display metadata from its own rows and never trusts browser-supplied names or assets.
3. One guarded PostgreSQL common-table-expression statement first locks the active season row, then samples PostgreSQL `clock_timestamp()` and claims the row only while manual lock and reveal are both false and that post-lock wall clock is strictly before both the configured deadline and the season's persisted opening-kickoff ceiling.
4. The same statement inserts the prediction parent, all 20 ordered team items, and all seven category picks or inserts nothing. Returned counts must be 20 and 7. This closes request-start/deadline, lock-wait/deadline, administrator-lock, and partial-child-write races without relying on an application clock.
5. A unique `(season_id, normalized_participant_name)` index resolves simultaneous duplicate names safely.
6. A random receipt token is returned once and stored only as a SHA-256 hash. Its HttpOnly cookie permits that browser to view its own table before reveal.

Predictions are immutable. Administrator deletion removes the parent row inside the active-season scope; PostgreSQL cascades through all 20 table items and seven category picks. The receipt lookup disappears, the normalized display name can submit again, the deletion remains in the bounded audit log, and team consensus scores derive again from the remaining entries.

## Reveal and privacy policy

The shared server policy reveals full entries after the effective deadline, after a manual lock, or when early reveal is explicitly enabled. The effective deadline is the earlier of an optional owner deadline and the owning season row's persisted Gameweek 1 opening kickoff. Pages read PostgreSQL's wall clock with the season, and the atomic insert independently checks the same persisted instant after acquiring its row lock, so app-clock skew or lock contention cannot admit a competing entry after reveal.

Before full reveal, the leaderboard publishes one narrow projection: participant name, submission time, 0-point total, and predicted champion. Prediction UUIDs, positions 2–20, all spotlight picks, and hidden accuracy ordering remain absent from public HTML and RSC. An entry lookup still requires the matching receipt cookie or an administrator session. After reveal, full entries and spotlight choices become public. If every outcome is pending, `/spotlight` lists the revealed picks but hides overall score and rank.

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

Scores are computed on read from immutable prediction rows, the one active standings snapshot, and any reviewed category-result rankings. They are never accumulated or stored as independently editable totals. Each table club receives exactly one tier: 5 exact, otherwise 3 within three, otherwise 1 in the same half, otherwise 0. The system derives table total, exact count, within-three count, and correct-half-only count. The position-1 champion is highlighted but receives no separate bonus, so the table maximum remains 100.

Spotlight accuracy is separate from the table score. Each category uses the selected subject's occupied outcome rank. Let `N` be the current number of active, nondeleted season brackets. Accuracy points are `max(0, N + 1 - outcome rank)`. Overall accuracy sums only resolved categories. A resolved zero-point result still counts as available. Pending categories remain unavailable. Equal overall scores share a competition rank. Seven rank-1 picks have a separate maximum of `7 × N`.

- Top scorer and top assister use the player's rank in reviewed goals and assists lists.
- Most clean sheets uses the selected club's rank in the reviewed club clean-sheets list.
- For every club, underdog index is `average predicted position - actual position`; overrated index is its inverse, `actual position - average predicted position`. Each category ranks the largest index first using full precision. For an average prediction of 2.4 and actual position 10, the indexes are -7.6 underdog and +7.6 overrated.
- Underdog player ranks reviewed FotMob average season ratings descending; overrated player ranks them ascending. This defines the intended metric, not permission for runtime or automated FotMob access.

Scoring cannot activate before the verified opening kickoff. The active table must also have an observation at or after kickoff. A preseason table cannot receive points only because the clock crossed kickoff. All-zero played-games tables remain inactive. Underdog-team and overrated-team ranks use the active table and all remaining submissions. A future owner-run Codex automation will enter the five other reviewed outcomes manually. Missing outcomes display as pending. They are not incorrect zero-point answers.

Before activation, each table-leaderboard card shows 0 and its predicted champion. When scoring is active, cards show table points and the champion's actual position. Entries sort by table points only. Equal totals share a competition rank. The separate spotlight page sorts by overall available accuracy or one category. Category sorts use outcome rank from low to high, put pending entries last, and use participant name for deterministic ties. Only atomic 20-position-plus-seven-pick submissions contribute to its bracket count or accuracy view; the retired Alex/Jordan cards were code fixtures and never prediction rows.

## Database model and invariants

- `seasons` stores the code-selected season, persisted opening kickoff, optional earlier owner deadline, fairness settings, active/final pointers, and the monotonic accepted-capture watermark.
- `teams` stores season-scoped names, sort names, factual external mapping, and permitted local asset path.
- `players` is the season-scoped catalogue of 587 imported 2026-08-08 players, with first/last/display names, club association, active status, and an optional local `/player-faces/` asset path.
- `predictions` and `prediction_items` store immutable participant tables and receipt hashes.
- `prediction_category_picks` stores exactly one typed choice per spotlight category. Team categories reference a club. Player categories reference either an active catalogue player or a normalized custom player name, never both.
- `standings_snapshots` and `standings_items` store complete actual tables.
- `standings_import_runs` preserves bounded outcome metadata for every attempt; `standings_import_run_items` retains row facts for activation attempts without storing arbitrary malformed input.
- `admin_audit_logs` records administrator mutations with a request identifier when supplied by the platform.

PostgreSQL duplicates application invariants with foreign keys, position checks, name-length checks, season/team/player uniqueness, team/position uniqueness per prediction or snapshot, category and subject-shape checks, and useful lookup indexes. Both prediction child tables use `ON DELETE CASCADE` from the prediction parent. Timestamps use PostgreSQL `timestamp with time zone` and application `Date` values.

## Administrator trust boundary

Administrator login requires a username and password. `ADMIN_USERNAME` defaults to `admin`. The preferred `ADMIN_PASSWORD_HASH` format is a randomly salted `pbkdf2_sha256` digest with 600,000 iterations. Bounded parsing and weak-configuration checks fail closed. The password comparison still runs when the username is wrong. Production runs the expensive derivation asynchronously. `ADMIN_SECRET` remains a constant-time migration fallback only when no password hash exists. Successful login issues a signed eight-hour cookie. The cookie is HttpOnly, SameSite Strict, Secure in production, and contains no credential. Every administrator mutation revalidates the session and same-origin metadata. Vercel Firewall limits `POST /admin/login` to 10 requests per 60 seconds for each IP. Excess requests receive HTTP 429.

The standings route independently requires a minimum-length `STANDINGS_INGEST_SECRET`, compares fixed-length digests in constant time, rejects bodies above 64 KiB, and returns bounded errors without source or database details. Public submission has a honeypot and stores no account, email, IP address, or other personal data beyond the chosen display name.

The invited-group boundary is social rather than account-based: the public form has no invitation token or participant login. The honeypot and per-season normalized-name uniqueness reduce mistakes and simple bots but are not access control, so fabricated public entries could influence the two consensus team indexes until an administrator deletes them. This is an explicit honor-system tradeoff; add invitation enforcement before the competition if the public URL is expected to attract abuse.

Security headers set a self-restricted content security policy, deny framing, disable MIME sniffing, restrict referrers, and disable camera, microphone, geolocation, payment, and USB browser permissions.

## Assets and rights

The user-facing visual system is Dranx Prediction League: a Premier-League-inspired palette anchored on official purple `#37003c`, with cyan `#05f0ff`, green `#00ff87`, and pink `#ff2882` accents and an original Dranx mark. The official Premier League logo is not included.

The 20 canonical club assets are owner-provided transparent PNG badges with accessible club-name alternatives. They are served from `public/team-marks/`; the application does not fetch or hotlink FotMob images. `teams.asset_path` remains the stable database-backed local-asset seam, and the idempotent seed updates existing rows after the PNGs are deployed. The shared `TeamMark` uses contain sizing, a neutral backing, and a labelled initials fallback. Original SVG monograms remain rollback-only for the first PNG release. The separate Premier League logo/lion/ball files are excluded.

The owner-provided `premier-league-players-2026-08-08/` snapshot covers 587 players across the same 20 clubs and includes 580 portrait PNGs. The import maps reviewed roster rows into the season catalogue and copies portraits to local `/player-faces/` paths. `PlayerMark` shows a generic silhouette for the seven players without a supplied image, for a null asset path, or after an image failure. Other player remains available for unavailable or newly added players. The raw folder remains the owner-provided provenance handoff; the deployed app neither runs its acquisition scripts nor hotlinks portrait sources.

Roster identity and portrait ingestion are separate from result entry. The snapshot does not provide final goals, assists, clean sheets, or season ratings. A future owner-run Codex automation will enter these reviewed outcomes manually. Custom Other-player names still require reconciliation.

## Failure behavior

- Missing or invalid database configuration fails server-side without revealing credentials.
- Missing seed data produces a clear operational error rather than a partial 20-team UI.
- Malformed, stale, duplicate, unauthorized, concurrent, or post-final imports preserve the active snapshot.
- With no meaningful snapshot, the leaderboard retains the participant count and says scoring has not started.
- An unavailable or newly added player can still be entered through Other player; a missing portrait uses the silhouette, while a missing or unmatched category outcome remains pending and does not silently score zero.
- A source acquisition failure can be recorded without changing public standings.
- Manual standings remain available when external acquisition is unavailable.
