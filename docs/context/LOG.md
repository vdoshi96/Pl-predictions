# Session log

## 2026-08-08

### Research and provisioning

- Read the complete greenfield product brief and the owner's no-live-API/no-cron and mobile-first overrides.
- Verified official 2026/27 league membership and the 20 seeded club display names.
- Recorded FotMob's automated-extraction restriction and the fact that a consumer subscription does not grant automation or redistribution rights.
- Selected the source-neutral authenticated importer plus manual owner entry, with local monograms until crest redistribution rights are cleared.
- Verified Vercel CLI authentication, created and linked `vdoshi96s-projects/pl-predictions`, and provisioned Vercel Marketplace Neon resource `neon-coffee-queen` before database work.
- Generated server-only credentials, stored the owner login in macOS Keychain, configured Vercel environments without exposing values, pulled local environment names, applied the committed migration, and seeded exactly 20 teams.
- Initialized the local Git repository and created branch `agent/build-pl-predictions` after the bootstrap checkpoint.

### Implementation

- Built the mobile-first prediction sorter, review dialog, atomic submission flow, receipt-gated confirmation, fairness deadline/lock/reveal policy, pre-reveal roster, derived leaderboard, and entry comparison.
- Built the owner login/session, status dashboard, season settings, submission deletion, manual standings editor, import history, 38-game final-candidate check, explicit final confirmation, and undo.
- Added the canonical version-1 snapshot/failure schema, local import script, 64 KiB bearer-authenticated intake route, deterministic content hashes, stale/duplicate/final rejection, run history, and last-good preservation.
- Added compare-and-swap guards in both import activation and one-statement finalization so concurrent transitions cannot split the active and final snapshots.
- Added strict server validation, database constraints/indexes, receipt hashing, constant-time credential checks, signed HttpOnly sessions, same-origin admin mutations, honeypot, audit metadata, safe errors, security headers, and no-secret caching behavior.
- Added 20 independent local monogram assets, a responsive header/footer, unofficial rights disclaimer, safe-area mobile action, 56-pixel handle targets, keyboard announcements, focus states, and reduced-motion behavior.
- Added deterministic Markdown-to-HTML generation, repository context documents, focused unit/component/integration tests, a fail-closed isolated test-database wrapper, and reversible Playwright journeys across desktop, 320/390/430-pixel Chromium, and iPhone WebKit.
- Hardened prediction writes into one database-clock-guarded SQL statement; early reveal now closes submissions irreversibly, and hidden pre-reveal server payloads omit prediction identifiers and items.
- Added a five-minute database-time timestamp bound, season-level standings accepted-through watermark, historical-content reactivation, duplicate-watermark handling, and exact compare-and-swap final undo.

### Verification and deployment

- Passed formatting, ESLint with zero warnings, and strict TypeScript checks before documentation closeout.
- Passed 95 default-suite tests; the 9 database cases were skipped there by design and then all passed under `npm run test:integration` against isolated Neon database `pl_predictions_test`.
- Passed `npm run build:verify` with Next.js Webpack mode. The restricted local environment blocked an internal Turbopack helper port, while Vercel's default Turbopack production build later passed.
- Passed 5 browser journeys with 20 intentional project-routing skips across desktop, exact 320/390/430-pixel Chromium, and iPhone 13 WebKit. The run covered no-overflow layout, real mouse/touch/keyboard reorder, 56-pixel touch handles, review/submit, raw HTML/RSC hidden-entry privacy, pre-reveal leaderboard, admin manual standings, recalculation, comparison, exact-ID deletion, and reversible isolated-database cleanup.
- `npm audit --omit=dev --audit-level=high` found 0 vulnerabilities. The full audit found 4 moderate development-only legacy `esbuild` paths through `drizzle-kit`, no high/critical findings, and only a breaking forced downgrade; no force change was applied.
- Applied forward migration `0001_left_iron_fist.sql` to production before deploying code that reads its new watermark, then reran the idempotent 20-team seed.
- Received explicit owner approval and changed Vercel Authentication to `preview`. Anonymous production now returns 200 while the retained preview URL continues to return a 302 Vercel SSO redirect; preview protection was not disabled.
- Traced a Vercel edge 404 on an otherwise Ready production deployment to a null project framework preset. Set the preset to `nextjs`, deployed Ready production `dpl_JCfjcxvtVVfbsU55mmTppBK2FB9G` at [https://pl-predictions-65aqenfnq-vdoshi96s-projects.vercel.app](https://pl-predictions-65aqenfnq-vdoshi96s-projects.vercel.app), and mapped [https://pl-predictions-2026.vercel.app](https://pl-predictions-2026.vercel.app) to it.
- Passed the final anonymous production smoke in all 5 projects across desktop Chromium, mobile Chromium at 390 pixels, exact 320/430-pixel reflow, and iPhone WebKit. Health, no-overflow, mouse/touch/keyboard reorder, and zero console, page, unexpected same-origin request, or HTTP response error assertions passed; only expected canceled speculative `_rsc` prefetches were excluded.
- Retained and visually inspected only the newest prediction, review, leaderboard, and administrator-login mobile screenshots under `docs/assets/qa/`.
- Exact-deleted four legacy `Reflow QA` predictions by UUID before the final smoke; none had a prediction-target audit row, and the follow-up query found zero residue.
- Passed the explicitly gated 1-case production write smoke: exact QA submit, receipt-only unrevealed access, hidden public roster details, and administrator deletion of the exact created prediction. Final queries found zero predictions, items, or prediction-target audits; the season remained open, unrevealed, and unlocked with null active/final pointers.
- Reviewed Vercel logs for the preceding hour and found zero error entries and zero HTTP 500 responses.

### Final closeout

- Refreshed final production evidence and labeled screenshot references in canonical Markdown.
- Regenerated every HTML peer and reran parity/format checks before publication.
- Published this final evidence update through the closeout branch, merged it into GitHub `main`, synchronized local and remote `main`, and removed completed branch/worktree state.

### Repository publication

- Published the tested feature history to [vdoshi96/Pl-predictions](https://github.com/vdoshi96/Pl-predictions), merged it into the canonical `main` release branch, synchronized local and remote `main`, and removed completed branch/worktree state.
- Published the final production evidence and mobile screenshots to the same canonical `main` release branch; local and remote release state are synchronized.

### Dranx branding iteration (complete)

- Selected **Dranx Prediction League** as the user-facing identity while retaining the repository, Vercel, Neon, URL, environment, and credential identifiers already used operationally.
- Defined a Premier-League-inspired palette anchored on official purple `#37003c` with cyan `#05f0ff`, green `#00ff87`, and pink `#ff2882` accents and an original Dranx mark.
- Confirmed that FotMob crest downloads and the official Premier League logo were not added because repository policy and the current official terms require authorization before copying or redistributing those marks.
- Retained the 20 local monograms and updated `TeamMark` with contain sizing and a labelled initials fallback for transparent authorized crest assets in a future permitted update.
- Completed canonical Markdown and deterministic HTML updates, ESLint, strict TypeScript, 97 default tests with 9 guarded skips, 9 isolated Neon integration tests, the Webpack production build, and 5 focused Playwright journeys with 20 routing skips. The aggregate `npm run check` passed before the final production-evidence refresh.
- Deployed Ready production `dpl_BPJUGKA7CJF7bhaUCTHjUx2cPEK7` at [https://pl-predictions-pizpoqt4u-vdoshi96s-projects.vercel.app](https://pl-predictions-pizpoqt4u-vdoshi96s-projects.vercel.app) with target `production`; Vercel built Next.js 16.3.0 with Turbopack and the stable public alias was repointed to it.
- Confirmed that the stable public alias returned 200 while the retained protected preview returned 302 to Vercel SSO.
- Passed the final read-only production smoke against the stable alias in all 5 projects across desktop Chromium, mobile Chromium at 390 pixels, exact 320/430-pixel reflow, and mobile WebKit. No browser, page, unexpected same-origin request, or HTTP errors occurred; the request hook excluded only cross-browser expected canceled `_rsc` navigational prefetches.
- Reviewed Vercel logs for the preceding hour and found zero error entries and zero HTTP 500 responses.
- Refreshed and visually inspected the prediction, review, leaderboard, and administrator-login production screenshots at 390 by 844 pixels.
- Kept the branding-only production verification read-only: no production write smoke ran and no production data changed. The prior release's exact-ID write and cleanup evidence remains intentional history.
- Merged GitHub [PR #1](https://github.com/vdoshi96/Pl-predictions/pull/1) successfully into canonical `main` at merge SHA `a0586831332db66158975928e98246eaf72118f1`. Its head was `2a0008e`, and its Vercel status was successful.
- Fast-forwarded local `main` to match `origin/main` at that merge before creating the final closeout branch, then removed the completed feature branch.
- Published the final closeout documentation through canonical `main`, synchronized local and remote `main`, removed the completed local temporary closeout branch after its merge, and retained one primary worktree. The final closeout merge SHA is intentionally not pinned in this durable end-state note.

### Gameweek 1 lock and champion leaderboard iteration (complete)

- Verified from the official Premier League opening-weekend announcement and complete fixture list that Arsenal v Coventry City is the first 2026/27 match at 20:00 BST on Friday 21 August 2026, exactly `2026-08-21T19:00:00.000Z`; recorded that all fixtures remain subject to change.
- Added migration `0002_breezy_king_cobra.sql` to persist and backfill the verified kickoff per season while retaining null as the automatic-deadline sentinel. A configured owner deadline may close earlier, while null or later values cannot bypass the persisted ceiling.
- Aligned public access/reveal decisions with PostgreSQL's wall clock. The atomic statement now acquires the season-row lock before sampling `clock_timestamp()`, so a write blocked across either deadline inserts neither parent nor items.
- Changed the preseason leaderboard to show every participant at 0 points with only the predicted champion's local mark/name. The prediction UUID and positions 2–20 remain absent from public HTML and RSC.
- Added post-kickoff champion status: 1st is “On track”; every other actual ordinal position is “Off track”. Scoring now requires kickoff, a meaningful table, and an accepted/re-observed timestamp at or after kickoff, so a stale preseason ordering cannot activate automatically.
- Added a production-disabled isolated clock seam and fresh-server requirement so tests remain deterministic after the real kickoff. The post-kickoff browser phase proves stale-table suppression, 100/96-point totals, ranks, champion actual positions, and scored-card reflow at desktop/320/430 pixels.
- Passed the final `CI=1 npm run check`: documentation parity, formatting, ESLint, strict TypeScript, 115 default tests with 10 guarded database skips, all 10 isolated Neon integration tests, the Webpack production build, and 8 Playwright journeys with 22 intentional routing skips across deterministic pre/post-kickoff phases.
- Applied `0002_breezy_king_cobra.sql` to production and verified opening kickoff `2026-08-21T19:00:00.000Z`, a null optional earlier deadline, unlocked submissions, and unrevealed predictions.
- Merged GitHub [PR #3](https://github.com/vdoshi96/Pl-predictions/pull/3) into canonical `main` at merge SHA `65841c8d458c1912c25a151c531b2d0538490fc5`; its tested head was `3191afa`, and its Vercel status passed.
- Deployed Ready production `dpl_4UEPWvwSECSwCHMUvLpacwmNjo1t` at [https://pl-predictions-428nljcvk-vdoshi96s-projects.vercel.app](https://pl-predictions-428nljcvk-vdoshi96s-projects.vercel.app) with target `production` and repointed the stable alias.
- Corrected the read-only production-smoke state detector after its first harness-only failure: Review is intentionally name-gated, so the test now distinguishes open/closed seasons through the name field and verifies Review enables after valid input.
- Passed the clean production-smoke rerun in all 5 projects across desktop Chromium, mobile Chromium at 390 pixels, exact 320/430-pixel reflow, and mobile WebKit, with zero browser, page, unexpected same-origin request, or HTTP errors.
- Reviewed Vercel runtime logs for the preceding 15 minutes and found zero error entries and zero HTTP 500 responses.
- Kept browser verification read-only; no production prediction or standings rows were written. Recaptured and visually inspected the newest prediction, review, leaderboard, and administrator-login mobile evidence.
- Regenerated and checked every HTML peer, published the evidence-only closeout through canonical `main`, synchronized local and remote `main`, removed completed branch/worktree state, and retained one primary worktree.

### Owner-provided club badge iteration

- Received a project-owner-supplied folder containing exactly one transparent 2048-by-2048 PNG badge for each of the 20 verified clubs plus eight out-of-scope Premier League logo/lion/ball/composite files.
- Copied only the 20 club badges into `public/team-marks/` under canonical slug filenames, changed all fixture paths from SVG to PNG, retained the original monograms as rollback-only first-release files, and excluded all league-brand extras.
- Kept the shared `TeamMark` contain sizing and labelled initials-on-error fallback, updated the user-facing rights wording, and added fixture coverage that requires a local PNG file for every canonical team path.
- Planned the production transition as deploy first, then idempotent seed, so existing Neon SVG paths remain valid until the PNG files are available.
