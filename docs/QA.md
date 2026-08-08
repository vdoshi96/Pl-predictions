# Quality assurance

Evidence date: 2026-08-08. This document records the newest completed local and production verification for the Dranx Prediction League iteration. The production verification was read-only because this iteration changed branding and presentation only; no production write smoke ran and no production data changed. Prior-release write and cleanup evidence is retained below as intentional history.

## Current results

| Gate                              | Command or environment                        | Result                                                                                                                                                                                                                   |
| --------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Formatting                        | `npm run format:check`                        | Passed; rerun after final Markdown/HTML generation.                                                                                                                                                                      |
| ESLint                            | `npm run lint`                                | Passed with zero warnings.                                                                                                                                                                                               |
| TypeScript                        | `npm run typecheck`                           | Passed in strict mode after Next route-type generation.                                                                                                                                                                  |
| Unit/component/default suite      | `npm test`                                    | 97 passed; 9 database cases skipped by their explicit opt-in guard.                                                                                                                                                      |
| Isolated Neon integration         | `npm run test:integration`                    | 9 passed against `pl_predictions_test` through the fail-closed test-database wrapper.                                                                                                                                    |
| Restricted-local production build | `npm run build:verify`                        | Passed using Next.js Webpack mode.                                                                                                                                                                                       |
| Browser journeys                  | `npm run test:e2e`                            | 5 passed with 20 intentional project-routing skips across desktop, 320/390/430-pixel Chromium, and iPhone 13 WebKit.                                                                                                     |
| Production dependency audit       | `npm audit --omit=dev --audit-level=high`     | 0 vulnerabilities.                                                                                                                                                                                                       |
| Full dependency audit             | `npm audit --audit-level=high`                | 4 moderate, 0 high, 0 critical. All four are development-only legacy `esbuild` paths through `drizzle-kit`; the proposed force fix would downgrade/break the selected Drizzle toolchain, so no force change was applied. |
| Retained preview protection       | retained preview URL                          | Anonymous request returns 302 to Vercel SSO after the owner-approved `preview` protection change.                                                                                                                        |
| Vercel production build           | deployment `dpl_BPJUGKA7CJF7bhaUCTHjUx2cPEK7` | Ready with target `production`; Vercel built the application with Next.js 16.3.0 and Turbopack. The stable public alias was repointed to this deployment and returned 200.                                               |
| Anonymous production smoke        | `npm run test:production-smoke`               | 5 passed against the stable alias across desktop Chromium, mobile Chromium at 390 pixels, exact 320/430-pixel reflow projects, and mobile WebKit, with no browser, page, unexpected same-origin request, or HTTP errors. |
| Bounded production write smoke    | `npm run test:production-write-smoke`         | Not run for this branding-only iteration. Historical prior-release evidence: 1 passed with an exact QA submit/privacy/delete journey and exact cleanup.                                                                  |
| Production data mutation          | branding-only read-only verification          | No production write smoke ran and no production data changed during this iteration.                                                                                                                                      |
| Vercel runtime logs               | final deployment, preceding hour              | Zero error entries and zero HTTP 500 responses.                                                                                                                                                                          |

The local sandbox did not permit a default Turbopack CSS helper to bind its internal port, so the local production gate used `next build --webpack`. This was an execution-environment restriction, not an application compile error; Vercel deployment `dpl_BPJUGKA7CJF7bhaUCTHjUx2cPEK7` subsequently passed the Next.js 16.3.0 Turbopack production build.

## Unit and component coverage

The 97-test default run covers:

- every required mutually exclusive scoring example, the top/bottom-half boundary, a 100-point exact table, preseason suppression, and shared ranks;
- NFKC name normalization, length checks, duplicate/missing/out-of-season team validation, and unique positions;
- the exact verified 20-club fixture, display sorting, local mark paths, and factual external mappings;
- original Dranx header/footer language plus `TeamMark` contain sizing, accessible club-mark semantics, and labelled initials fallback after an image error;
- pointer/keyboard sorter structure, 56-pixel handle-only touch targets, live language for predicted versus actual positions, A–Z reset, review, server rejection, sticky safe-area action, mobile navigation, and narrow-card shrink behavior;
- database-clock deadline, manual lock, and irreversible early-reveal policy, including concurrent lock and deadline boundaries;
- complete snapshot validation and source-failure envelopes;
- canonical hashing, future-skew rejection, duplicate watermark semantics, historical-content reactivation, initial/changed active-pointer guards, source-finality isolation, and import/finalize races;
- 38-game final-candidate requirements plus compare-and-swap finalization and undo;
- constant-time administrator credential verification, signed-session nonce/expiry/tamper handling, cookie attributes, origin checks, mutation authorization, rotation invalidation, and bounded request IDs.

## Database integration

`npm run test:integration` loaded `.env.local`, routed through `scripts/run-with-test-database.mjs`, and passed nine cases against the isolated `pl_predictions_test` database:

1. one prediction and exactly 20 items are created atomically;
2. case-insensitive participant uniqueness is enforced by PostgreSQL;
3. the database deadline boundary creates no partial rows;
4. a concurrent administrator lock wins before a guarded prediction insert;
5. an inconsistent revealed row still fails closed even if its lock flag is false;
6. imported snapshots remain provisional while invalid subsequent input retains the last good active snapshot;
7. newer duplicate observations advance the monotonic watermark, historical content can be reactivated without changing first-seen provenance, and delayed changed data is rejected;
8. implausibly future capture timestamps are rejected without moving the active pointer; and
9. implausibly future source-update timestamps receive the same last-good protection.

The wrapper refuses to run if the target resolves to production. The suite uses unique identifiers and deletes its prediction/import data after the run. A post-E2E read-only check found zero `Mobile QA` predictions, zero manual-admin import runs, null active/final pointers, and the original open/unrevealed season flags.

## Browser and mobile verification

Playwright routes focused cases across five projects:

- desktop Chromium for public layout, real mouse drag, and keyboard reorder;
- touch-enabled Chromium at 390 by 844 for the complete private-to-revealed owner journey;
- Chromium at exact 320-pixel and 430-pixel widths for reflow/privacy boundaries; and
- WebKit using the iPhone 13 device profile for the complete touch journey.

Verified behavior:

- `/` renders exactly 20 verified clubs with no document-level horizontal overflow;
- every move handle measures at least 56 by 56 pixels and is the only touch-action suppression point;
- real mouse and delayed touch gestures reorder through the production sorter; Arrow Down then produces a deterministic one-place order, updated accessible position text, and one live announcement;
- a normalized participant name opens a 20-row review dialog and submits successfully;
- the receipt browser can open its private confirmation, while a clean mobile context receives the not-found page for the same unrevealed entry;
- the pre-reveal leaderboard lists the participant without linking or exposing the table;
- owner login succeeds from the server-only credential, the manual admin table contains 20 clubs, and a provisional matchweek-one snapshot saves;
- early reveal recalculates the submitted table to the expected 96 points, exposes the participant link, and shows provisional comparison details;
- the administrator deletes the test entry and the leaderboard no longer contains it; and
- after each run, the test restores the original season deadline/lock/reveal/active/final pointers and removes its participant, snapshot, import, and audit rows.

The touch helpers honor the sorter's 250-millisecond activation constraint before movement. Chromium and WebKit can resolve the moving target at adjacent insertion boundaries, so the journey verifies touch movement independently, resets, and submits a deterministic keyboard order for the 96-point scoring assertion. Automated WebKit emulation is strong regression evidence, but it is not a substitute for a final spot check on the owner's physical iPhone when one is available.

## Production deployment evidence

The owner explicitly approved changing Vercel Authentication to `preview`. The retained preview at [https://pl-predictions-lkmdwjsh8-vdoshi96s-projects.vercel.app](https://pl-predictions-lkmdwjsh8-vdoshi96s-projects.vercel.app) still returns a 302 redirect to Vercel SSO, while the stable public production alias [https://pl-predictions-2026.vercel.app](https://pl-predictions-2026.vercel.app) returns 200. Preview protection was not disabled.

The Dranx release deployment `dpl_BPJUGKA7CJF7bhaUCTHjUx2cPEK7` is Ready with target `production` at immutable URL [https://pl-predictions-pizpoqt4u-vdoshi96s-projects.vercel.app](https://pl-predictions-pizpoqt4u-vdoshi96s-projects.vercel.app). Vercel built it with Next.js 16.3.0 and Turbopack. The stable public alias was repointed to this deployment and returned 200. The project remains `vdoshi96s-projects/pl-predictions` with Marketplace Neon resource `neon-coffee-queen`.

Historical prior-release context: an initial production verification exposed a Vercel edge 404 even though its deployment reported Ready. The project framework preset was null; correcting it to `nextjs` and deploying again resolved the routing failure. Prior deployment `dpl_JCfjcxvtVVfbsU55mmTppBK2FB9G` then became Ready at [https://pl-predictions-65aqenfnq-vdoshi96s-projects.vercel.app](https://pl-predictions-65aqenfnq-vdoshi96s-projects.vercel.app). This history is retained for operational diagnosis and is not the current Dranx deployment evidence.

The final read-only browser run against the stable alias passed all five production projects: desktop Chromium, touch-enabled mobile Chromium at 390 pixels, exact 320- and 430-pixel Chromium reflow, and mobile WebKit. It verified application and health responses, no document-level horizontal overflow, and real mouse, delayed-touch, and keyboard reordering. No browser console or uncaught page errors, unexpected same-origin request failures, or HTTP 4xx/5xx responses were recorded. The request hook excludes only cross-browser expected canceled Next.js `_rsc` navigational prefetches. Vercel logs for the preceding hour contained zero error entries and zero HTTP 500 responses.

No production write smoke ran for this branding-only iteration, and no production data changed. The separately gated prior-release write smoke remains intentional historical evidence: it passed one exact-ID submit/privacy/delete journey, and its post-cleanup queries returned zero `predictions`, zero `prediction_items`, and zero prediction-target audit rows with the season open, unrevealed, and unlocked and both active and final standings pointers null.

Historical prior-release cleanup: before that release's final smoke, four legacy `Reflow QA` predictions from earlier interrupted verification were identified and deleted by their exact UUIDs. None had an associated audit row. The follow-up and final post-smoke queries both confirmed zero prediction, item, or audit residue.

## Production mobile screenshots

Only the newest completed production run is retained. All four screenshots were refreshed at 390 by 844 pixels and visually inspected for the Dranx identity, clean narrow-screen rendering, readable wrapping, and absence of horizontal clipping.

**Prediction entry — mobile Chromium at 390 pixels:** the 20-club single-column sorter, dedicated move handles, top/bottom-half boundary, and safe-area-aware review action fit the viewport.

![Production prediction entry on mobile Chromium](assets/qa/prediction-mobile.png)

**Review dialog — mobile Chromium at 390 pixels:** the immutable 1–20 review remains legible and keeps its confirmation actions reachable without horizontal overflow.

![Production prediction review dialog on mobile Chromium](assets/qa/review-mobile.png)

**Pre-reveal leaderboard — mobile Chromium at 390 pixels:** the zero-entry launch state explains that tables remain private and exposes no prediction data.

![Production pre-reveal leaderboard on mobile Chromium](assets/qa/leaderboard-mobile.png)

**Administrator sign-in — mobile Chromium at 390 pixels:** the owner-only entry point reflows cleanly with a readable credential field and full-width action.

![Production administrator sign-in on mobile Chromium](assets/qa/admin-login-mobile.png)

## Security and source review

- No environment value, receipt token, database URL, administrator credential, or subscription cookie is committed or exposed through a public variable.
- Public entry queries fail closed before reveal unless the matching receipt or administrator session exists.
- Administrator writes require both a valid signed session and exact same-origin request metadata.
- The standings intake uses a separate bearer secret, a 64 KiB body cap, strict JSON/Zod validation, and bounded public errors.
- CSP, anti-framing, MIME-sniffing, referrer, and browser permissions headers are configured.
- Production dependencies have no reported audit vulnerability; the remaining moderate findings are dev-only and do not justify a breaking forced downgrade.
- There is no live football API call, runtime FotMob access, scraper, or Vercel Cron. FotMob automated extraction remains prohibited absent a written licence covering the intended workflow.
- Official crests are not redistributed. Local text monograms are the documented launch fallback.

## Final closeout checklist

GitHub [PR #1](https://github.com/vdoshi96/Pl-predictions/pull/1) merged successfully into canonical `main` at merge SHA `a0586831332db66158975928e98246eaf72118f1`; its head was `2a0008e`, and its Vercel status was successful. Local `main` was fast-forwarded to match `origin/main` at that merge before the final closeout branch was created, and the completed local feature branch was removed. Final closeout leaves local and remote `main` synchronized, no completed local temporary branch retained, and one primary worktree. The final closeout merge SHA is intentionally not pinned here so this end-state record remains accurate.

- [x] Apply the explicitly owner-approved Vercel Authentication `preview` boundary; keep preview protection enabled.
- [x] Run the read-only anonymous production smoke and retain only its newest labeled mobile prediction, review, leaderboard, and administrator screenshots under `docs/assets/qa/`.
- [x] Keep this branding-only production verification read-only. No production write smoke ran and no production data changed; the prior-release write/cleanup proof remains historical evidence only.
- [x] Confirm zero browser console/page errors, zero unexpected same-origin request failures or HTTP error responses, zero Vercel error log entries, and zero HTTP 500 responses for the final production run.
- [x] Publish the Dranx iteration and final evidence through canonical `main`, synchronize local `main` with `origin/main`, remove completed local branch state, and retain only the single primary worktree.
