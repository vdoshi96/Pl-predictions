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

### Dranx branding iteration (release verification in progress)

- Selected **Dranx Prediction League** as the user-facing identity while retaining the repository, Vercel, Neon, URL, environment, and credential identifiers already used operationally.
- Defined a Premier-League-inspired palette anchored on official purple `#37003c` with cyan `#05f0ff`, green `#00ff87`, and pink `#ff2882` accents and an original Dranx mark.
- Confirmed that FotMob crest downloads and the official Premier League logo were not added because repository policy and the current official terms require authorization before copying or redistributing those marks.
- Retained the 20 local monograms and updated `TeamMark` with contain sizing and a labelled initials fallback for transparent authorized crest assets in a future permitted update.
- Completed canonical Markdown and deterministic HTML updates, ESLint, strict TypeScript, 97 default tests with 9 guarded skips, 9 isolated Neon integration tests, the Webpack production build, and 5 focused Playwright journeys with 20 routing skips. The aggregate `npm run check` passes. Deployment, production verification, final QA evidence, and GitHub closeout remain pending for this iteration.
