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
- Deployed Ready preview `dpl_e7yEgPhrJBR17qnoQk3EAwdXjFmQ` and Ready production `dpl_CGDPYcKNhq6EJb8AUReEVC8odRDF`; [https://pl-predictions-2026.vercel.app](https://pl-predictions-2026.vercel.app) points to the final production deployment.
- Attempted the narrow Vercel Authentication setting `preview` so only previews remain protected. Policy correctly rejected the persistent production-access change without explicit owner approval; no workaround or weaker setting was applied.

### Open closeout

- Push the feature branch to the owner-supplied public GitHub repository, merge it to `main`, synchronize local `main`, and verify no completed worktrees remain.
- After explicit owner approval, set Vercel Authentication to preview-only, run the anonymous read-only smoke plus the separately gated exact-ID submit/privacy/delete proof, confirm zero production QA residue, and retain only the newest annotated screenshots.
- Refresh final smoke/GitHub evidence, regenerate every HTML peer, and rerun parity/format checks.
