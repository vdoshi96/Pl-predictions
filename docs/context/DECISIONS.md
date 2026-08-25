# Decisions

## 2026-08-24: Opinion categories rank only picked subjects

Rank each opinion category within its own distinct picked-subject pool. Underdog-player picks compete only with other underdog-player picks, overrated-player picks compete only with other overrated-player picks, and the two team categories follow the same separation. Repeated picks create one ranked subject. A subject picked in both directions belongs independently to both pools.

Continue calculating each club's expectation index from every complete table prediction, then filter the ranking candidates to the relevant team-opinion picks. Keep one shared factual rating value for each player, but filter the active immutable rating snapshot before ranking each player-opinion pool. Unpicked factual rows cannot affect an opinion rank. A picked player without a fact in a legacy active snapshot remains pending rather than becoming an outside-range zero.

Apply the rule on read so deployment recalculates existing public ranks without changing, republishing, or finalizing an immutable result snapshot. New player-rating drafts contain exactly the union of resolved picked players across both opinion categories and require every picked player to have a rating. Keep the snapshot's current bracket count in `covered_through_rank` for pointer and audit compatibility. The `N`-based accuracy curve, competition ties, full-precision metrics, and league-wide goals, assists, and clean-sheets rankings do not change. This decision supersedes the opinion-category ranking universes in the 2026-08-08 scoring decisions while preserving their formulas and history.

## 2026-08-23: Release Win Streak from Matchweek 2

Run Win Streak as a separate durable game across Matchweeks 2–38. One confirmed club-to-win pick is immutable for each profile and round. A win adds one to the current streak and keeps that winning club unavailable during the active streak. A draw or loss resets the current streak and unlocks every club. A missed round or void preserves the streak; a void returns that round's club to the available pool. Late joiners receive no retroactive penalty. Rank only personal best by shared competition rank, alphabetize tied names for deterministic presentation, and show current streak as supporting information.

Lock the complete round at its earliest persisted fixture kickoff rather than giving later-playing clubs a longer selection window. Display each fixture's kickoff for context, but use the round deadline and PostgreSQL clock for every profile creation and pick authorization.

Keep the leaderboard public before any display name is entered, and show each profile's current-matchweek pick with the fixture. Do not publish receipt tokens or internal identifiers. A 2–40-character display name creates a profile bound to one random browser receipt whose SHA-256 hash is stored. Do not allow name-only resumption or takeover. Accept the explicit no-login tradeoff that losing the cookie makes the profile unrecoverable; cap the season at 500 profiles and rate-limit profile and pick writes.

Seed all 370 official Matchweek 2–38 fixtures from the Premier League snapshot checked August 23, 2026. Do not make runtime football requests. The recurring update-results workflow must check official fixture drift first. It may automatically prepare only a reviewed kickoff-time correction for a future, unpicked, unresolved fixture; every structural or protected-fixture difference fails closed. Publish a completed round only through the authenticated results desk, with all ten persisted kickoffs elapsed and all ten results committed atomically and immutably.

## 2026-08-21: August 20 player catalogue and UI-report remediation

Use the owner-provided `premier-league-players-2026-08-20/` handoff as the current repository and production selector source. Normalize all 580 players and copy its 578 verified portraits. Keep null asset paths for Ryan McAidoo and Luc De Fougerolles so `PlayerMark` renders the generic silhouette. Relative to August 18, require exact parity for five additions, five removals, no intra-league moves, two position corrections, and two restored portraits for existing players. Do not run handoff acquisition scripts, infer result facts, or hotlink images. The owner approved the gated production release and one supported seed on 2026-08-21; the seed completed after the exact application deployment became Ready.

Implement all 20 findings from the owner-provided Oxalpha UI report as one mobile-first density and interaction pass. Keep the repository's 56-pixel move-handle requirement while reducing row chrome around it. Debounce local draft writes and flush on page exit, keep player pickers in the mobile viewport, add Home, End, Page Up, and Page Down movement, announce reorders politely, highlight only the first incomplete spotlight category, collapse the review table's middle positions, compact the public header and leaderboard, align countdown updates to one-second boundaries, export a safe-area viewport, and use named design tokens for repeated colors. Preserve the existing privacy, atomicity, lazy-catalogue, and no-runtime-acquisition boundaries.

## 2026-08-14: Browser-local drafts and intentional A–Z acknowledgement

Persist an in-progress entry only in versioned, season-keyed browser `localStorage`. The draft contains the display name, exact ordered current-team IDs, stage, partial typed picks, and selected-player display metadata. Restore only after hydration and only when the current 20-team permutation and category shapes validate. Keep restored player IDs through catalogue loading or failure; a successful current-season catalogue response is the only client event that may prove one stale. Clear storage only after successful atomic submission or server-verified permanent closure. Validation, network, and server failures retain it; use `beforeunload` only when storage itself is unavailable.

Place the display name before the sorter and label deterministic A–Z as a blank slate, not a suggestion. Continuing with the exact A–Z order requires an accessible **Yes, use A–Z** acknowledgement kept only in page memory. Reset, season/team change, and restored A–Z drafts require a fresh acknowledgement.

## 2026-08-14: Sealed manual result snapshots and pinned aliases

Implement `/admin/results` as five owner-facing tables backed by four factual datasets: `goals`, `assists`, `clean_sheets`, and one `player_ratings` dataset shown in synchronized highest/lowest views. Counts are nonnegative integers; ratings retain up to three decimal places and rank without pre-rounding. Newly identified factual players are inactive result-only season rows and never enter the participant catalogue.

Saving creates a new immutable working version. Facts and the exact current Other-player alias mappings are written during construction, the snapshot is sealed, and only then may the working pointer advance. Sealed snapshots, items, and pinned aliases reject update, delete, and append. Publishing uses compare-and-swap to advance the exact active pointer only after submissions are permanently closed/revealed, at least one active bracket exists, every relevant custom name is pinned, and the owner attests complete coverage through the current bracket count `N`, including boundary ties. The shared ratings dataset must cover both directions. Finalization pins the exact active version; its owner-only undo removes final status without changing season reveal.

Missing datasets and unresolved identities remain pending. After a complete snapshot publishes, listed subjects use competition rank; an omitted canonical subject is explicitly outside scoring range with zero points and counts as available. Store the coverage bracket count on the snapshot, but calculate accuracy with the current active bracket count so later prediction deletion can only reduce points safely. This decision implements and supersedes the future administrative-result path described in the 2026-08-08 spotlight decision while preserving the no-runtime-acquisition boundary.

## 2026-08-14: Deferred player catalogue and bounded selectors

Keep the 582-player catalogue out of the initial homepage HTML and RSC. The first transition to Stage 2 lazily requests the dynamic same-origin `/api/player-catalogue` route. That no-store route SQL-filters active rows for the current season and returns only `id`, `firstName`, `lastName`, `displayName`, and local `assetPath` values. A successful response remains in form state for that season; failure exposes an explicit Retry and preserves Other player.

Require at least two normalized search characters before catalogue matches appear, announce the total match count, and render no more than 20 matching rows. Keep Other player available during loading, empty, and error states, and hide the sticky review action while a selector popup is open. Submission validation must query only the active player IDs referenced by the submitted picks instead of loading the full catalogue.

## 2026-08-14: Opening kickoff as the sole timed submission cutoff

Use each season row's persisted `opening_kickoff` as the sole timed cutoff. The nullable `submission_deadline` column remains only for schema and migration compatibility and is ignored by runtime policy, seed, environment configuration, administrator pages, and the guarded prediction insert. The post-lock PostgreSQL wall clock remains authoritative at the boundary.

The administrator settings page displays the fixed opening kickoff rather than an editable deadline. It always shows the instant in `America/Chicago` and lets the owner compare Eastern, Central, Mountain, Pacific, or UTC through IANA-zone `Intl.DateTimeFormat`, including the correct seasonal abbreviation. Earlier closure is available only through irreversible manual lock or early reveal; both actions reveal predictions and permanently close submissions. Their accessible dialogs require the exact typed phrases `LOCK` and `REVEAL`, which the server validates again. One database-time compare-and-swap records the distinct intent only for the winning transition; a naturally closed, concurrent, or already-closed attempt is a truthful no-op with no misleading success audit. This decision supersedes only the optional configured-earlier-deadline clause in the 2026-08-08 opening-kickoff decision below and preserves that dated history.

## 2026-08-14: Offline source permission and runtime boundary

The owner confirmed in the 2026-08-14 Codex task that the required permissions for this player-catalogue workflow have been obtained, including acquisition, storage, redistribution, and production use. Confidential licence documents remain outside source control and chat. This confirmation supersedes the repository's earlier source-specific permission gates for the approved player workflow.

Owner-run FotMob or Transfermarkt acquisition may run offline and produce a reviewed local snapshot or result payload. The deployed application must remain free of runtime source requests, scraping, image hotlinking, football APIs, and scheduled acquisition. This decision does not alter participant privacy, prediction secrecy, security, or submission-integrity controls.

## 2026-08-14: Owner-selected August 13 roster refresh

Replace the 2026-08-08 selector snapshot with the owner-selected `premier-league-players-2026-08-13/` handoff: 582 players across the application's 20 clubs and 582 local `/player-faces/` portraits. Relative to August 8, the active fixture has 12 additions, 17 removals, and four intra-league club moves. Keep Other player available for unavailable or newly added players. `PlayerMark` still uses its generic silhouette when an asset path is absent or an image fails.

The handoff, normalized fixture, tracked application fixture, and portrait inventory are reconciled internally. The roster was not independently verified against official club or Premier League roster pages for this release. This decision supersedes the 2026-08-08 player-count and seven-fallback split without rewriting that dated release history.

Use the exact refreshed asset set: delete the 17 obsolete portrait paths and apply the four club-move renames without retaining legacy compatibility copies. Preserve inactive database player rows referenced by historical picks; the seed deactivates rather than deletes them. This roster is selector input only, does not provide spotlight outcomes, and does not change the deployed application's no-runtime-acquisition boundary.

## 2026-08-08: Complete-entry test data, fixture retirement, and deadline countdown

Remove the hard-coded Alex/Jordan spotlight presentation cards. Read-only live-page and production-database checks proved they were component fixtures, not prediction parents or partial stage-two writes, so no production deletion is warranted. The public spotlight page must derive its bracket count and, after reveal, every displayed pick and accuracy result from complete persisted submissions only.

Create the retained `Dranx Test Entry` through the same public three-stage flow used by a participant. Treat it as product test data, not a seed or demo shortcut. Verification must find one parent, exactly 20 ordered table rows, and exactly seven category-pick rows. Before reveal, the main leaderboard may show its permitted participant/champion projection and `/spotlight` may count the bracket, but neither route may expose its spotlight subjects, private table positions, or prediction identifier.

Show a compact days/hours/minutes/seconds calendar-flip countdown beside the server-derived open-submissions status. Calculate the initial remaining duration from PostgreSQL time and the effective deadline, then advance that duration with a monotonic client timer so a participant's device clock cannot move the display. Refresh the server page at zero. The countdown is informational; only the post-lock PostgreSQL `clock_timestamp()` check can authorize or reject a submission.

Use three 390 × 844 captures from the current verified mobile flow for the public how-to section. Keep each screenshot's numbered overlay pins synchronized with adjacent text callouts so the instructions remain understandable to screen-reader users and without relying on colour alone.

## 2026-08-08: Owner-provided player snapshot import

Use the owner's dated `premier-league-players-2026-08-08/` handoff as the local selector snapshot for the 2026/27 season. Import all 587 players across the application's 20 clubs, copy the 580 supplied portraits to `/player-faces/`, and deliberately show the `PlayerMark` silhouette for the seven players without a supplied image. Keep Other player available for unavailable or newly added players instead of inventing a catalogue row or portrait.

Preserve the raw handoff as owner-provided provenance, but do not run its acquisition scripts, fetch its upstream sources, or hotlink its images in production. This decision imports roster identity and portrait data only. It does not provide the reviewed goals, assists, club clean-sheets, or average season rating rankings needed for the five pending spotlight outcomes, and it does not change the source-neutral result-ingestion boundary. The 2026-08-13 roster refresh above supersedes the player-count and fallback split while retaining this runtime boundary.

## 2026-08-08: Three-stage immutable entry and spotlight placeholders

Treat the table and seven spotlight choices as one immutable submission. Stage 1 orders all 20 active clubs and captures the display name, stage 2 requires exactly one top scorer, top assister, most clean sheets, underdog team, overrated team, underdog player, and overrated player choice, and stage 3 reviews both sets before confirmation. The deadline-guarded PostgreSQL statement writes the parent, all 20 table rows, and all seven category rows together and verifies both child counts; a closed or partial attempt writes none of them.

Use season-scoped `players` and `prediction_category_picks` tables as the durable catalogue and selection seams. Player selectors search first, last, and full names and allow a normalized Other-player value; club categories reference existing season teams. The catalogue began empty while the roster handoff was pending, rather than fabricating entries. The later owner-provided player snapshot decision above supersedes that temporary empty state while retaining local-only `/player-faces/` paths and the generic `PlayerMark` fallback. Most clean sheets always chooses a club.

## 2026-08-08: Separate table leaderboard and spotlight accuracy

Keep the main leaderboard limited to the 5–3–1–0 table score. Its maximum remains 100. The predicted champion remains table position 1 and receives no separate bonus. Spotlight predictions are a separate fun-accuracy view and never change table points. Users can sort that view by overall available accuracy or one category.

Use the selected subject's occupied outcome rank. Let `N` be the current number of active, nondeleted brackets for the season. Rank 1 earns `N` accuracy points, rank 2 earns `N - 1`, and later ranks decrease to zero. Equal outcomes share rank and accuracy points. Overall available accuracy sums only categories with a reviewed result. Pending outcomes remain unavailable and are not incorrect zero-point answers. Because scores are derived, an administrator deletion changes `N` and recalculates the accuracy view.

At that iteration, the five non-table-derived outcomes remained pending until an approved offline-review and administrative-entry path existed. No acquisition runs inside the deployed application. The 2026-08-14 sealed manual-results decision above now implements that path; this separate-accuracy decision still supersedes the combined 240-point working rule below.

## 2026-08-08: Superseded unified 240-point working rule

This earlier implementation rule used the mutually exclusive 5–3–1–0 table tiers and a combined 240-point total. It gave 20 points for spotlight rank 1 through 1 point for rank 20. The separate table-leaderboard decision above supersedes this working rule before competition scoring.

Define underdog-team index as `average predicted position - actual position` and overrated-team index as `actual position - average predicted position`; rank the largest value first using unrounded precision. An average prediction of 2.4 and actual position 10 therefore produces -7.6 underdog and +7.6 overrated. Top scorer, top assister, and most clean sheets use reviewed result-list positions. Underdog player ranks reviewed FotMob average season ratings descending, while overrated player ranks them ascending.

The 2026-08-14 owner permission decision above supersedes this earlier source-permission gate. The deployed application still must not contact or scrape FotMob. Team expectation outcomes may derive from submitted tables and the active standings, but the other five categories remain pending until an offline-acquired, reviewed outcome and custom-name reconciliation path exists. Pending means unavailable, not an incorrect zero-point result. The then-visible leaderboard test run was hard-coded presentation evidence only and never entered stored standings, predictions, or real totals; the later complete-entry decision above retires that fixture.

## 2026-08-08: Spotlight privacy, PBKDF2 admin login, and cascade deletion

Extend the existing pre-reveal privacy boundary to all seven spotlight picks: publicly expose only participant name, submission time, 0 points, and the predicted champion, while withholding prediction IDs, positions 2–20, and category choices from HTML and RSC. A matching receipt browser and administrator retain private access; full picks become public only after the established deadline, lock, or early-reveal policy. Publish `/rules` as the participant-facing explanation of the expanded game.

Use `ADMIN_USERNAME` with default `admin` and a server-only `ADMIN_PASSWORD_HASH` encoded as salted PBKDF2-SHA-256 with 600,000 iterations. Keep `ADMIN_SECRET` only as a migration fallback when no hash is configured, and never store the raw owner password in source or documentation. Preserve the signed eight-hour HttpOnly session and exact same-origin mutation checks. Run the derivation asynchronously and pair the public production login with a per-source platform rate limit so the deliberately short owner-supplied credential is not an unbounded CPU or online-guessing path.

Administrator deletion removes the prediction parent in the active-season scope and records the audit action. Database cascades remove its 20 table rows and seven spotlight rows, making the receipt unusable and allowing that normalized display name to submit again. Because leaderboard totals and team expectation averages are derived, deletion naturally recalculates them from the remaining submissions.

## 2026-08-08: Honor-system public submission boundary

Keep participant entry account-free for the private invited group: collect only a display name, use the honeypot and one normalized name per season, and let the administrator remove mistakes or fabricated entries. Treat this as a social invitation boundary, not technical access control. A person with the public URL can submit under an unused name and influence consensus-based team indexes; add invitation tokens or participant authentication before kickoff if that risk is no longer acceptable.

## 2026-08-08: Opening-kickoff submission ceiling

Treat the first 2026/27 league kickoff, Arsenal v Coventry City at `2026-08-21T19:00:00.000Z`, as the non-extendable submission ceiling. Persist the reviewed instant on the season row so historical entries retain their own start boundary after rollover. An administrator may select an earlier deadline, manually lock, or reveal early, but neither a null nor later stored deadline can permit an entry at or after kickoff. Use the database clock for public access decisions and sample PostgreSQL's live wall clock only after the atomic write has acquired the season lock. Keep the official fixture URL and verification date with the season data because fixtures remain subject to change and this application has no live schedule feed; a reschedule requires a reviewed code and forward data migration.

## 2026-08-08: Public champion projection and preseason zero state

Before full-table reveal, publish only each participant's name, submission time, 0-point total, and predicted champion name/local club mark. Keep the prediction UUID and positions 2–20 out of public HTML and RSC. Do not score any active standings snapshot before the opening kickoff or until that table has been accepted/re-observed after kickoff; retain the meaningful-table guard as well. Once scoring is active, show the champion's actual ordinal position and define “on track” narrowly as currently 1st.

## 2026-08-08: Owner-provided local club badge set

The project owner supplied one transparent PNG badge for each of the 20 verified clubs and explicitly directed use of that exact set. Make slug-named PNGs the canonical `teams.asset_path` values and update existing rows through the idempotent seed only after the files are deployed. Keep the original SVG monograms as rollback-only files for this first release so either database path remains valid during the transition. Continue using the original Dranx identity and exclude the supplied Premier League logo/lion/ball/composite extras. This decision records project-owner direction for these local files; it does not claim original ownership, affiliation, or permission for additional third-party artwork.

## 2026-08-08: Dranx identity and authorized-asset boundary

Adopt **Dranx Prediction League** as the user-facing name while preserving existing `pl-predictions` repository, Vercel, database, URL, and environment identifiers. Use a Premier-League-inspired visual system anchored on the league's official purple, `#37003c`, with cyan `#05f0ff`, green `#00ff87`, and pink `#ff2882` accents and an original Dranx mark.

This decision superseded the launch identity but does not erase the historical monogram decision below. At that point, FotMob crest downloads and the official Premier League logo were not added because repository policy and the current official terms required appropriate authorization before copying or redistributing those marks. The owner-provided local club badge decision above later superseded the monogram presentation while retaining the prepared `TeamMark` seam.

## 2026-08-08: Static operational data boundary

The deployed application has no live football API, scheduled scraper, or Vercel Cron. A source-neutral canonical importer plus manual admin editor write validated snapshots. This implements the owner's Codex-run automation preference while isolating source acquisition and preserving the last good snapshot. The 2026-08-14 permission decision now allows owner-run FotMob or Transfermarkt acquisition offline; it does not permit acquisition inside the deployed application.

## 2026-08-08: Vercel-managed Neon and Drizzle

Use Vercel Marketplace Neon with pooled `DATABASE_URL`, Neon HTTP, Drizzle ORM, committed migrations, and atomic batches with pre-generated identifiers. This is current, serverless-friendly, and avoids obsolete Vercel Postgres packages.

## 2026-08-08: Accessible maintained dnd-kit

Use the current `@dnd-kit/react` sortable API. Pointer and keyboard behavior are first-class; touch-action is limited to the handle to preserve mobile scroll.

## 2026-08-08: Mobile is the primary layout

Design from the narrow single-column journey outward. Use 56-pixel dedicated move handles, a wrapping full-width navigation, safe-area-aware submission action, no horizontal overflow in the prediction list, explicit focus/live announcements, and reduced-motion support. Desktop density is an enhancement of the same semantic flow rather than a separate interface.

## 2026-08-08: Historical monogram fallback before the owner badge handoff (superseded)

At the time, FotMob image locations and a consumer subscription were not treated as redistribution permission. The project therefore shipped crisp club monograms with real names and a local asset seam. The later owner-provided badge decision superseded this presentation fallback for the exact 20-file set, while the 2026-08-14 permission decision superseded the source-specific gate for the approved player workflow.

## 2026-08-08: Derived scoring and shared ranks

Do not persist editable totals. Derive score and tier counts from prediction items and the one active snapshot. Equal totals share the same rank, and names are alphabetized only for deterministic display.

## 2026-08-08: Source finality is advisory

Imports always create provisional snapshots even when a source labels a table final. Final status requires all 20 teams to have 38 played games and an explicit authenticated administrator confirmation. This avoids trusting ambiguous provider completion semantics.

## 2026-08-08: Compare-and-swap standings transitions

Snapshot activation claims the active pointer value observed at import start, requires no final pointer, and advances a season-row accepted-capture watermark only for a newer observation. Newer identical observations advance that watermark, while genuinely newer historical content may be reactivated without mutating its first-seen provenance. Finalization and undo each use one PostgreSQL common-table-expression statement to claim the exact active/final snapshot and keep pointer, snapshot flag, and audit changes atomic. Whichever concurrent transition wins the shared season row prevents the other from applying a split-brain state.

## 2026-08-08: Single-owner credential handoff

Keep the administrator mechanism provider-free. Store the login credential in Vercel server-only environments and the owner's macOS Keychain, sign short HttpOnly sessions with a separate secret, and rotate either without source changes. Use a distinct bearer secret for the standings intake so data automation never receives administrator-session authority.

## 2026-08-08: Isolated database tests and bounded production proof

Integration and full browser journeys must never target the production database. `scripts/run-with-test-database.mjs` uses an explicit `TEST_DATABASE_URL` or derives `TEST_DATABASE_NAME`, compares the resolved identity with production, and fails closed on ambiguity or equality. Only that verified non-production process can activate the fixed pre/post-kickoff test clock; production always uses PostgreSQL's live wall clock, and Playwright refuses to reuse an unattested local server. Production verification is split into a read-only public smoke and an explicit opt-in submit/privacy/delete proof scoped to the exact created prediction ID. The irreversible reveal/standings journey is test-only.

## 2026-08-08: Production public, previews protected

Use the Vercel Authentication boundary `preview`: the finished production site is public while preview deployments require owner sign-in. This is narrower than disabling deployment protection. The owner explicitly approved the persistent change from all-deployments protection; anonymous production access now returns 200, and the retained preview URL still redirects to Vercel SSO with 302.
