# Architecture

## System boundary

Dranx Prediction League is one Next.js 16 App Router application deployed to Vercel and backed by Vercel Marketplace Neon. Public pages, administrator pages, server actions, and the standings intake route share one codebase. Each original-game submission is one immutable parent with a 20-club ordering and seven spotlight picks. The separate Win Streak game stores official rounds and fixtures, receipt-bound profiles, and one immutable pick per profile and round. There is no separate backend, client-side source of truth, runtime football API client, production scraper, or Vercel Cron. Existing repository, Vercel, database, URL, and environment identifiers retain their operational `pl-predictions` names.

```text
participant browser                         owner operations
       |                          +-------------------------------+
       |                          | reviewed offline or manual data|
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

The public application never contacts FotMob or another football-data source. The owner-selected `premier-league-players-2026-08-20/` handoff supplies selector identities and portrait files. The deployed app never executes its acquisition code. The handoff and application fixture are reconciled internally; this update does not claim independent roster verification against official club or Premier League pages. The handoff does not supply competition outcomes. The owner confirmed permission on 2026-08-14 for offline acquisition, storage, redistribution, and production use in this player-catalogue workflow. Offline work may produce reviewed facts, but the owner enters factual outcomes only through the authenticated manual results desk. Missing datasets remain pending and do not receive zero.

## Runtime and deployment

- Vercel project: `vdoshi96s-projects/pl-predictions`.
- Production alias: `https://pl-predictions-2026.vercel.app`.
- Current verified production release: Win Streak GitHub PR #39 merged as `19bf11b4df43f8c3410f704fb278d1d4bdd845b5`; Vercel deployment `dpl_BTncZC77GmA3EXtaUjAKvfWZvRzP` is Ready at `https://pl-predictions-cdq31rqls-vdoshi96s-projects.vercel.app` and owns the stable production alias. Additive migration `0010` and the targeted 37-round/370-fixture seed are applied.
- Deployment protection: Vercel Authentication is `preview`; production is public and retained previews require Vercel sign-in.
- Database: Neon resource `neon-coffee-queen`, project `young-leaf-03280061`, provisioned through Vercel Marketplace before migrations and seed. Its root `main` branch has a six-hour restore window.
- Runtime: Node.js 24.x, Next.js 16.3.0, React 19.2.8, Neon serverless HTTP, and Drizzle ORM.
- Rendering: database-backed pages are dynamic; static local club badges and imported player-face assets may be cached and optimized by Next.js.
- Configuration: server-only Vercel variables; no credential has a `NEXT_PUBLIC` prefix.

The initial homepage server path reads an explicit active-season projection and the 20-club set only; it neither queries active players nor serializes catalogue rows or portrait paths into HTML or RSC. On first entry to Stage 2, the browser lazily requests dynamic same-origin `GET /api/player-catalogue`. The no-store route SQL-filters active players for the current season and returns only the `id`, `firstName`, `lastName`, `displayName`, and local `assetPath` values needed for client-side search and presentation. A successful response remains in form state for that season; an explicit Retry is available after failure.

## Routes

- `/` — the three-stage table, spotlight, and review flow before reveal; after reveal, the live Premier League table versus consensus averages and expectation-index callouts.
- `/leaderboard` — a 0-point champion-pick roster before scoring, then a top-three podium and dense shared-rank table with previous-snapshot movement, score breakdowns, and progress toward the 100-point cap.
- `/spotlight` — separate fun-accuracy views selected by `?view=categories|entries|matrix`. Categories are the default, entries retain `?sort=`, and the desktop matrix keeps its first column sticky. Before reveal, every view exposes only the complete-bracket count, not picks, identifiers, or hidden ordering.
- `/win-streak` — public Win Streak leaderboard plus the receipt-authorized current-profile picker. The leaderboard renders without a profile and publishes each current-matchweek pick; receipt and database identifiers remain private.
- `/entries/[id]` — receipt/admin-authorized private confirmation before reveal; public comparison afterward.
- `/rules` — an annotated three-screen live-mobile walkthrough followed by table tiers, spotlight rank rules, team formulas, privacy, and pending-data explanation.
- `/admin/login` — owner credential handoff.
- `/admin` — season and latest-import overview.
- `/admin/submissions` — view and delete erroneous entries.
- `/admin/settings` — fixed opening-kickoff display plus irreversible manual lock and early reveal.
- `/admin/standings` — manual table, import history, final confirmation, and explicit undo.
- `/admin/results` — five owner-facing factual result tables backed by immutable `goals`, `assists`, `clean_sheets`, and shared `player_ratings` snapshots.
- `/admin/win-streak` — earliest-unresolved-round desk for one reviewed, atomic set of ten fixture outcomes.
- `/api/player-catalogue` — dynamic minimal active-season player catalogue loaded when Stage 2 first needs it.
- `/api/automation/standings` — bearer-authenticated, write-only canonical snapshot/failure intake.
- `/api/health` — shallow non-secret health response.

## Mobile-first presentation

The prediction and manual standings experiences share the same accessible sorter. A 56 by 56 pixel handle is the only element with `touch-action: none`, preserving page scrolling on touch devices. Pointer drag and direct Arrow Up/Arrow Down movement both update position immediately and announce the result through an assertive live region. Rows remain single-column without horizontal overflow, display the top/bottom-half boundary, wrap long names on narrow screens, and use explicit focus rings. The spotlight stage uses keyboard-operable combobox/listbox controls with name filtering, visible selection state, and a focused free-text input after Other player is chosen. Player selectors require at least two normalized search characters, announce the total number of matches, render at most 20 matching catalogue rows, and keep Other player available during loading, empty, and error states. Exactly one selector popup can be open, and the sticky review action is hidden while it is open so it cannot cover the available choices. The submission action is otherwise reachable above safe-area insets, and reduced-motion preferences disable nonessential transitions. The rules walkthrough renders three live-site 390 × 844 captures as snap-scrolling cards on phones and a three-column grid on wide screens. CSS overlay pins and adjacent numbered text carry the same annotation semantics.

The open-submissions panel includes a compact days/hours/minutes/seconds calendar-flip countdown. Its initial duration is calculated on the server from the database wall clock and the persisted opening kickoff. The client advances that duration from monotonic `performance.now()` rather than trusting the participant device clock, then refreshes the server page once at zero. This display never authorizes a write; the database-locking kickoff check in the prediction write path remains authoritative.

Win Streak uses the same responsive tokens, buttons, cards, focus treatment, `TeamMark`, and safe-area behavior. Its mobile navigation has five equal cells at 320 pixels. Ten compact fixture rows present all 20 teams in one picker, and unavailable clubs stay visible with a written reason. The native fieldset/radio interaction and review dialog work with keyboard, touch, and pointer input. Its leaderboard uses a table on wide screens and labelled stacked rows on phones without page-level horizontal scrolling.

The revealed season table and leaderboard reflow without page-level horizontal scrolling at 320 pixels. The scored leaderboard uses a real table on wide screens and CSS-only stacked rows on phones. The spotlight category board changes from one to two columns at 860 pixels; its matrix intentionally scrolls inside a bounded wrapper and keeps the entry column sticky. The administrator navigation becomes a full-width two-column grid at narrow widths without forcing the primary page or prediction list to overflow.

## Prediction write path

1. Stage 1 collects a normalized display name before the ordered 20-club table; stage 2 collects all seven spotlight categories; stage 3 presents the final table and spotlight review before confirmation. The deterministic initial A–Z table is labelled as a blank slate and requires an explicit accessible acknowledgement if unchanged.
2. The browser sends the display name, honeypot, ordered team UUIDs, and seven typed category choices. Zod first rejects malformed input without catalogue or team reads, then the server loads the 20 current-season clubs and only the active player IDs referenced by the submitted picks. The season-scoped validation requires a 2–40 character normalized name, exactly one occurrence of every active team and position, exactly one row for each category, a current-season club for team categories, and either a current active player or normalized 2–120 character custom name for player categories. The server resolves display metadata from its own rows and never trusts browser-supplied names or assets.
3. One guarded PostgreSQL common-table-expression statement first locks the active season row, then samples PostgreSQL `clock_timestamp()` and claims the row only while manual lock and reveal are both false and that post-lock wall clock is strictly before the season's persisted opening kickoff.
4. The same statement inserts the prediction parent, all 20 ordered team items, and all seven category picks or inserts nothing. Returned counts must be 20 and 7. This closes request-start/deadline, lock-wait/deadline, administrator-lock, and partial-child-write races without relying on an application clock.
5. A unique `(season_id, normalized_participant_name)` index resolves simultaneous duplicate names safely.
6. A random receipt token is returned once and stored only as a SHA-256 hash. Its HttpOnly cookie permits that browser to view its own table before reveal.

Before submission, a versioned `localStorage` draft keyed by season slug retains the participant-entered display name, exact 20-team permutation, current stage, partial category shapes, and selected-player display metadata. Restoration happens after hydration and accepts only a compatible exact team set and valid category shapes; name normalization remains a server validation concern. Catalogue loading or failure never erases restored player IDs; only a successful catalogue response can prove one stale. Storage is cleared only after successful atomic submission or server-verified permanent closure. Validation, network, and server failures retain it; `beforeunload` is used only when browser storage itself fails.

Predictions are immutable after submission. Administrator deletion removes the parent row inside the active-season scope; PostgreSQL cascades through all 20 table items and seven category picks. The receipt lookup disappears, the normalized display name can submit again, the deletion remains in the bounded audit log, and team consensus scores derive again from the remaining entries.

## Win Streak write and scoring path

1. The Server Component reads the 37 seeded rounds, 370 fixtures, bounded profile and pick facts, and the optional matching receipt profile. It makes up to three attempts if the round version changes during the multi-query read, preventing a page from mixing facts from opposite sides of a result publication.
2. A 2–40-character display name creates a profile only when the season has fewer than 500 profiles. The action requires a same-origin request, applies a persistent rate limit, generates a random receipt token, stores only its SHA-256 hash, and sets an HttpOnly, SameSite Strict, production-Secure cookie scoped to `/win-streak`.
3. The pick action requires that receipt, a current seeded fixture, one of its two teams, and a PostgreSQL clock before the round's persisted `pick_deadline`. That deadline is the earliest kickoff among the round's ten fixtures, so every pick locks together even when the chosen club plays later. PostgreSQL enforces one pick per profile and round, current-round order, fixture membership, and no reuse of a club that won earlier in the active streak. The confirmed pick is immutable.
4. Scoring derives current streak, personal best, and restricted winning clubs from persisted fixture orientation, picks, and ordered results. Wins increment and restrict; draws and losses reset and unlock; voids and missed rounds preserve. Late joiners are evaluated only from their joined round.
5. Public ranking uses personal best alone with shared competition ranks, then alphabetizes tied names. Current streak and current-matchweek pick are public supporting facts; tokens and identifiers are never projected.
6. The authenticated results action exposes only the earliest unresolved round and waits until all ten persisted kickoffs pass. One SQL statement validates order, updates exactly ten results, records reviewed provenance and a content hash, and inserts an audit event. A resolved round cannot be edited or replayed.

The canonical fixture JSON is generated offline from official Premier League pages and seeded with the targeted `db:seed:win-streak` command. The generator validates all 380 fixtures, retains Matchweeks 2–38, uses explicit UK kickoff times where published, defaults date-only weekend and bank-holiday fixtures to 15:00, midweek fixtures to 20:00, and Matchweek 38 to 16:00, then converts `Europe/London` to UTC. Runtime requests never contact a football source. The fixture-refresh tool accepts only an inspected kickoff-only change for a future, unpicked, unresolved fixture; pairing, team, matchweek, expired, picked, or resolved drift fails closed.

## Reveal and privacy policy

The shared server policy reveals full entries at the owning season row's persisted Gameweek 1 opening kickoff or after irreversible manual lock or early reveal. The opening kickoff is the sole timed cutoff. Pages read PostgreSQL's wall clock with the season, and the atomic insert independently checks the same persisted instant after acquiring its row lock, so app-clock skew or lock contention cannot admit a competing entry after reveal. Both administrator closure controls reveal predictions and permanently close submissions; there is no editable earlier deadline.

Before full reveal, the leaderboard publishes one narrow projection: participant name, 0-point total, and predicted champion. Prediction UUIDs, positions 2–20, all spotlight picks, consensus averages, and hidden accuracy ordering remain absent from public HTML and RSC. The server returns from the season-table query before loading any consensus-bearing rows, and Spotlight does not load category leaders or aliases. An entry lookup still requires the matching receipt cookie or an administrator session. After reveal, full entries, consensus values, and spotlight choices become public. If every outcome is pending, the Spotlight entry view lists revealed picks but hides overall score and rank; category cards and matrix cells label pending data without converting it to zero.

## Fixed deadline and irreversible closure

Administrator settings reuse the database-seeded days/hours/minutes/seconds countdown and always render the kickoff instant in `America/Chicago`. A dropdown renders that same ISO instant in Eastern, Central, Mountain, Pacific, or UTC through IANA zones, so `Intl.DateTimeFormat` supplies the seasonally correct standard/daylight abbreviation. No zone-less date input or earlier-deadline mutation remains.

**Lock submissions now** and **Reveal predictions early** use separate accessible dialogs requiring exact `LOCK` and `REVEAL` phrases. The client disables confirmation until the phrase matches; the server parses the intent and phrase again. One database-time common-table-expression update claims only an open, pre-kickoff season, sets both permanent closure flags, and writes the distinct intent audit. A natural-deadline, concurrent, or already-closed attempt changes nothing and creates no misleading success audit. There is no reopen operation.

## Manual spotlight-result lifecycle

`/admin/results` exposes five tables backed by four factual datasets. Goals, assists, and clean sheets accept nonnegative integers. One shared player-ratings dataset accepts exact numeric values from 0 through 10 with at most three decimal places. Its two views show the separate underdog-player and overrated-player pick pools, while a player in both pools has one synchronized editable rating. A full pasted list may be parsed, but only picked players are applied and the desk reports the ignored count. New drafts accept a nonempty reviewed subset of resolved picked players and reject unpicked rows. The server recomputes competition ranks without pre-ranking rounding. Newly identified factual players become inactive result-only season rows, while normalized matches to an existing active or inactive player must reuse that canonical identity.

**Save draft** uses the expected working pointer to insert a new version, its rows, and the exact relevant Other-player alias facts in one statement. A deferred database seal closes the construction window before any working pointer can remain valid; after sealing, snapshot, item, and alias triggers reject update, delete, or append. The authoritative pinned alias map returns to the client, so a stale tab cannot attest to a different identity than the snapshot stores. **Publish provisional** compare-and-swaps the exact working and active pointers only after permanent closure/reveal, a positive current bracket count, relevant aliases, and explicit attestation. Goals, assists, and clean sheets require coverage through that exact `N` with boundary ties. Player ratings instead require a nonempty reviewed subset of resolved picked opinion players; `covered_through_rank` still records `N` for snapshot and audit compatibility. Re-publishing the already-active working version is a no-op conflict without an audit. **Finalize** and owner-only final-status undo compare-and-swap the exact active/final pointer; undo keeps the version active and does not alter season reveal.

Public scoring reads only the active sealed snapshot and its pinned aliases. Missing snapshots and unresolved identities remain pending. Goals, assists, and clean sheets use the published league-wide ranks; an omitted canonical subject is available at zero after attested coverage. Opinion-player scoring filters the rating facts to each category's distinct picked players and ranks that pool in the category's direction. A picked opinion player without a rating displays as N/A, remains unavailable, and contributes no accuracy points. The snapshot records the bracket count at publication, while points use the current active bracket count so a later administrator deletion recalculates both the candidate pool and the score.

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
- For every club, underdog index is `average predicted position - actual position`; overrated index is its inverse, `actual position - average predicted position`. The indexes use every complete bracket. Each category then ranks only its distinct picked clubs, largest first using full precision. For an average prediction of 2.4 and actual position 10, the indexes are -7.6 underdog and +7.6 overrated.
- Underdog player ranks only distinct underdog-player picks by reviewed average season rating descending; overrated player separately ranks only distinct overrated-player picks ascending. Owner-run offline acquisition is allowed; the deployed application has no runtime FotMob access.

Scoring cannot activate before the verified opening kickoff. The active table must also have an observation at or after kickoff. A preseason table cannot receive points only because the clock crossed kickoff. All-zero played-games tables remain inactive. Underdog-team and overrated-team indexes use the active table and all remaining submissions, but each category ranks only its distinct picked clubs. The other five categories read independently published manual facts from four datasets: goals, assists, club clean sheets, and one player-ratings dataset ranked high and low without pre-ranking rounding. The two opinion-player directions filter that shared dataset to their separate picked-player pools. A missing dataset, unresolved alias, or missing picked-player rating remains pending. Goals, assists, and clean sheets retain attested bracket-count coverage and outside-range zeroes.

Before activation, each table-leaderboard row shows 0 and its predicted champion. When scoring is active, the podium and dense table show table points, exact/within-three/correct-half counts, and the champion. Entries sort by table points only, and equal totals share a competition rank. Movement recomputes the same canonical table score against the previous meaningful snapshot, assigns shared ranks again, and reports previous rank minus current rank. The separate Spotlight entry view sorts by overall available accuracy or one category. Category sorts use outcome rank from low to high, put pending entries last, and use participant name for deterministic ties. Category boards regroup the already resolved picks by canonical team, player, pinned alias, or normalized Other identity. The matrix reuses each pick's existing result rank, status, and accuracy points. Only atomic 20-position-plus-seven-pick submissions contribute to bracket counts, consensus, or accuracy views.

## Database model and invariants

- `seasons` stores the code-selected season, persisted opening kickoff, fairness settings, active/final pointers, and the monotonic accepted-capture watermark. Its nullable `submission_deadline` field remains for schema and migration compatibility but is ignored by application, seed, environment, and administrator paths.
- `teams` stores season-scoped names, sort names, factual external mapping, and reviewed local asset path.
- `players` is the season-scoped catalogue of 580 imported 2026-08-20 players, with first/last/display names, club association, active status, and an optional local `/player-faces/` asset path.
- `predictions` and `prediction_items` store immutable participant tables and receipt hashes.
- `prediction_category_picks` stores exactly one typed choice per spotlight category. Team categories reference a club. Player categories reference either an active catalogue player or a normalized custom player name, never both.
- `spotlight_result_states` stores one working, active, and final pointer for each season's `goals`, `assists`, `clean_sheets`, and `player_ratings` dataset.
- `spotlight_result_snapshots` and `spotlight_result_items` store ranked factual versions. Facts are inserted only during construction, sealed before a pointer can reference them, and thereafter reject update, delete, or append. The snapshot records the attested coverage bracket count and a canonical content hash.
- `spotlight_result_aliases` is the owner's mutable working map from normalized Other-player spellings to canonical season players. Each saved snapshot copies those mappings into immutable `spotlight_result_snapshot_aliases`, so later corrections cannot rewrite published historical scoring. A newly identified factual subject becomes an inactive result-only `players` row and therefore never enters `/api/player-catalogue`.
- `standings_snapshots` and `standings_items` store complete actual tables.
- `standings_import_runs` preserves bounded outcome metadata for every attempt; `standings_import_run_items` retains row facts for activation attempts without storing arbitrary malformed input.
- `win_streak_rounds` stores Matchweeks 2–38, the earliest-kickoff round deadline, ordered resolution state, official fixture provenance, and immutable result provenance.
- `win_streak_fixtures` stores the ten home/away pairings and kickoff/result facts for each round. Safe refreshes may change only a future, unpicked, unresolved kickoff while preserving identity, teams, and matchweek.
- `win_streak_profiles` stores the 2–40-character public display name, normalized uniqueness key, joined round, and SHA-256 receipt hash. The season is bounded to 500 profiles.
- `win_streak_picks` stores one immutable fixture/team choice per profile and round plus the deadline applied at insertion. Database constraints enforce the active round, fixture membership, round deadline, and winning-club restriction.
- `admin_audit_logs` records administrator mutations with a request identifier when supplied by the platform.

PostgreSQL duplicates application invariants with foreign keys, position checks, name-length checks, season/team/player uniqueness, team/position uniqueness per prediction or snapshot, category and subject-shape checks, snapshot sealing, same-season dataset/pointer checks, and useful lookup indexes. Both prediction child tables use `ON DELETE CASCADE` from the prediction parent. Timestamps use PostgreSQL `timestamp with time zone` and application `Date` values.

## Administrator trust boundary

Administrator login requires a username and password. `ADMIN_USERNAME` defaults to `admin`. The preferred `ADMIN_PASSWORD_HASH` format is a randomly salted `pbkdf2_sha256` digest with 600,000 iterations. Bounded parsing and weak-configuration checks fail closed. The password comparison still runs when the username is wrong. Production runs the expensive derivation asynchronously. `ADMIN_SECRET` remains a constant-time migration fallback only when no password hash exists. A persistent PostgreSQL limiter permits five password attempts per source in 15 minutes and rejects later attempts before PBKDF2 work. Vercel Firewall remains an outer layer. Successful login issues a signed eight-hour cookie whose hashed nonce and expiry are registered server-side. The cookie is HttpOnly, SameSite Strict, Secure in production, and contains no credential. Every administrator request requires both a valid signature and an active registry row; logout revokes that row. Every administrator mutation also revalidates same-origin metadata.

The standings route independently requires a minimum-length `STANDINGS_INGEST_SECRET`, accepts an optional `STANDINGS_INGEST_SECRET_PREVIOUS` only for bounded rotation, compares fixed-length digests in constant time, enforces a persistent 60-request-per-minute source limit, rejects bodies above 64 KiB, and returns bounded errors without source or database details. Public submission has a honeypot and stores no account, email, IP address, or other personal data beyond the chosen display name.

The invited-group boundary is social rather than account-based: the public form has no invitation token or participant login. The honeypot and per-season normalized-name uniqueness reduce mistakes and simple bots but are not access control, so fabricated public entries could influence the two consensus team indexes until an administrator deletes them. This is an explicit honor-system tradeoff; add invitation enforcement before the competition if the public URL is expected to attract abuse.

Win Streak has the same no-account boundary with a stronger browser-ownership seam. Profile creation issues a random HttpOnly, SameSite Strict, production-Secure receipt scoped to `/win-streak`; only its hash is stored. A normalized name cannot be resumed from another browser, and a missing or corrupt receipt renders the visitor anonymous. Persistent `win_streak_create` and `win_streak_pick` limits use a normalized source key, including an IPv6 `/64`, and bounded public reads reject more than 500 profiles or 18,500 picks. The public projection deliberately includes display names and current-matchweek picks but excludes receipts and row identifiers.

The request proxy creates a per-response nonce for the Next.js content security policy. Production scripts require that nonce and `strict-dynamic`; the policy has no script `unsafe-inline`, and `unsafe-eval` exists only in local development. Production also sends two-year HSTS with subdomain coverage, denies framing, disables MIME sniffing, restricts referrers, and disables camera, microphone, geolocation, payment, and USB browser permissions.

## Assets and rights

The user-facing visual system is Dranx Prediction League: a Premier-League-inspired palette anchored on official purple `#37003c`, with cyan `#05f0ff`, green `#00ff87`, and pink `#ff2882` accents and an original Dranx mark. The official Premier League logo is not included.

The 20 canonical club assets are owner-provided transparent PNG badges with accessible club-name alternatives. They are served from `public/team-marks/`; the application does not fetch or hotlink FotMob images. `teams.asset_path` remains the stable database-backed local-asset seam, and the idempotent seed updates existing rows after the PNGs are deployed. The shared `TeamMark` uses contain sizing, a neutral backing, and a labelled initials fallback. Original SVG monograms remain rollback-only for the first PNG release. The separate Premier League logo/lion/ball files are excluded.

The owner-selected `premier-league-players-2026-08-20/` snapshot covers 580 players across the same 20 clubs and includes 578 portrait PNGs. Relative to August 18, it has five additions, five removals, no intra-league club moves, two position corrections, and two portraits restored for existing players. Ryan McAidoo and Luc De Fougerolles have null asset paths and therefore use `PlayerMark`'s generic silhouette. The import maps reviewed roster rows into the season catalogue and copies verified portraits to local `/player-faces/` paths. Other player remains available for unavailable or newly added players. The raw folder remains the owner-provided provenance handoff; the deployed app neither runs its acquisition scripts nor hotlinks portrait sources. Production uses the verified August 20 catalogue after the explicitly approved supported seed.

For the completed August 13 roster release, rollout was deliberately deploy-first and seed-second: the 582-player code/assets reached the exact Ready production deployment before the supported seed changed database paths. Because no legacy portrait paths were retained, the owner accepted the brief interval in which an old database path could render `PlayerMark`'s silhouette; the seed closed that compatibility window. The recovery stop gate first proved the configured six-hour window and reproduced the 20-team, 587-player pre-seed baseline through a read-only just-before-seed time-travel query; no restore was performed. The seed then ran exactly once, deactivated absent fixture players rather than deleting rows historical picks may reference, and upserted the approved active fixture. Read-only verification found 599 total player rows, 582 active, 17 inactive, 582 distinct active portrait paths, exact fixture parity, and intact foreign-key and cross-season constraints.

The manual-results remediation used a separate additive migration-first rollout. Production preflight proved the active legacy deadline was `NULL`, there were zero normalized display-name duplicate groups, migration history ended at `0005`, and no result tables existed. Migrations `0006` and `0007` were then applied while the August 13 application remained deployed and compatible. A transaction-scoped `READ ONLY` postcheck followed by `ROLLBACK` matched the committed migration hashes, found all 8 migration rows, exactly four pending result states with every working/active/final pointer `NULL`, zero snapshots/items/aliases, the expected 3 unique indexes and 14 valid enabled triggers, zero closure/result audits, and false lock/reveal flags. The migration created no result facts. PR #19 subsequently deployed the routes and guarded mutations without publishing results or invoking Lock or Reveal.

Roster identity and portrait ingestion are separate from result entry. The snapshot does not provide final goals, assists, clean sheets, or season ratings. Reviewed outcome facts are entered manually at `/admin/results`; no acquisition runs in the deployed application. Every relevant custom Other-player spelling must map to a canonical season player and be pinned into the exact working snapshot before that dataset can publish.

## Failure behavior

- Missing or invalid database configuration fails server-side without revealing credentials.
- Missing seed data produces a clear operational error rather than a partial 20-team UI.
- A player-catalogue load failure exposes Retry while preserving Other player in every player category.
- A malformed, stale, incomplete, concurrently replaced, unsealed, or post-final result snapshot cannot advance an active result pointer; the last good public version remains active.
- Malformed, stale, duplicate, unauthorized, concurrent, or post-final imports preserve the active snapshot.
- With no meaningful snapshot, the leaderboard retains the participant count and says scoring has not started.
- An unavailable or newly added player can still be entered through Other player; a missing portrait uses the silhouette, while a missing or unmatched category outcome remains pending and does not silently score zero.
- A source acquisition failure can be recorded without changing public standings.
- Manual standings remain available when external acquisition is unavailable.
- A missing or corrupt Win Streak receipt produces an anonymous view and cannot claim an existing name. Lost receipts have no name-only recovery path.
- Missing or incomplete Win Streak seed data, a profile-cap breach, an invalid club, a closed round, or a reused winning club fails closed without inserting a profile or pick.
- Fixture drift that changes a team, pairing, fixture identity, matchweek, expired deadline, picked fixture, or resolved fixture cannot pass the targeted refresh. No-drift checks perform no write.
- A Win Streak round with an unelapsed kickoff, fewer or more than ten results, invalid provenance, or a stale/concurrent transition cannot resolve. Published results are immutable.
- Public Win Streak reads compare round state before and after their bounded queries and retry up to two times. Continued concurrent change returns a clear refresh error instead of a mixed leaderboard.
