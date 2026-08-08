# Quality assurance

Evidence date: 2026-08-08. This document records the newest completed local and deployment run only. Final anonymous production smoke screenshots remain blocked until the owner explicitly approves changing Vercel Authentication from all deployments to previews only. Generated HTML peers remain current with this documented blocker.

## Current results

| Gate                              | Command or environment                        | Result                                                                                                                                                                                                                   |
| --------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Formatting                        | `npm run format:check`                        | Passed; rerun after final Markdown/HTML generation.                                                                                                                                                                      |
| ESLint                            | `npm run lint`                                | Passed with zero warnings.                                                                                                                                                                                               |
| TypeScript                        | `npm run typecheck`                           | Passed in strict mode after Next route-type generation.                                                                                                                                                                  |
| Unit/component/default suite      | `npm test`                                    | 95 passed; 9 database cases skipped by their explicit opt-in guard.                                                                                                                                                      |
| Isolated Neon integration         | `npm run test:integration`                    | 9 passed against `pl_predictions_test` through the fail-closed test-database wrapper.                                                                                                                                    |
| Restricted-local production build | `npm run build:verify`                        | Passed using Next.js Webpack mode.                                                                                                                                                                                       |
| Browser journeys                  | `npm run test:e2e`                            | 5 passed with 20 intentional project-routing skips across desktop, 320/390/430-pixel Chromium, and iPhone 13 WebKit.                                                                                                     |
| Production dependency audit       | `npm audit --omit=dev --audit-level=high`     | 0 vulnerabilities.                                                                                                                                                                                                       |
| Full dependency audit             | `npm audit --audit-level=high`                | 4 moderate, 0 high, 0 critical. All four are development-only legacy `esbuild` paths through `drizzle-kit`; the proposed force fix would downgrade/break the selected Drizzle toolchain, so no force change was applied. |
| Vercel preview build              | deployment `dpl_e7yEgPhrJBR17qnoQk3EAwdXjFmQ` | Ready after Vercel's default Turbopack build at the sign-in-protected preview URL.                                                                                                                                       |
| Vercel production build           | deployment `dpl_CGDPYcKNhq6EJb8AUReEVC8odRDF` | Ready after Vercel's default Turbopack build; stable alias points to this deployment. Anonymous requests still receive Vercel SSO until the explicit protection-setting approval is supplied.                            |

The local sandbox did not permit a default Turbopack CSS helper to bind its internal port, so the local production gate used `next build --webpack`. This was an execution-environment restriction, not an application compile error; the Vercel deployment subsequently passed the default Turbopack build.

## Unit and component coverage

The 95-test default run covers:

- every required mutually exclusive scoring example, the top/bottom-half boundary, a 100-point exact table, preseason suppression, and shared ranks;
- NFKC name normalization, length checks, duplicate/missing/out-of-season team validation, and unique positions;
- the exact verified 20-club fixture, display sorting, monogram paths, and factual external mappings;
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

Final preview deployment `dpl_e7yEgPhrJBR17qnoQk3EAwdXjFmQ` is Ready at [https://pl-predictions-lkmdwjsh8-vdoshi96s-projects.vercel.app](https://pl-predictions-lkmdwjsh8-vdoshi96s-projects.vercel.app). Final production deployment `dpl_CGDPYcKNhq6EJb8AUReEVC8odRDF` is Ready, and [https://pl-predictions-2026.vercel.app](https://pl-predictions-2026.vercel.app) points to it. Both passed Vercel's default Turbopack build and use project `vdoshi96s-projects/pl-predictions` with Marketplace Neon resource `neon-coffee-queen`.

The project currently has Vercel Authentication configured for `all_except_custom_domains`, so anonymous requests to the `vercel.app` production alias receive an SSO redirect. The safer intended setting is `preview`: production public, previews still authenticated. Applying that persistent security-boundary change was correctly blocked pending explicit owner approval. Therefore the anonymous read-only production browser smoke, bounded exact-ID submit/privacy/delete proof, console/network review, and annotated newest-run screenshots remain deliberately unclaimed. The forward migration and idempotent production seed have succeeded, and the final deployment is Ready behind SSO.

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

- [ ] Obtain explicit owner approval to change Vercel Authentication to preview-only; do not disable preview protection.
- [ ] Run the read-only anonymous production smoke and retain only its newest annotated mobile prediction, leaderboard, and administrator screenshots under `docs/assets/qa/`.
- [ ] Run only the separately gated exact-ID production submit/privacy/delete proof and confirm zero QA residue. Do not run the reveal/standings journey against live data.
- [ ] Confirm the public production flow has no browser-console errors or failed same-origin requests.
- [ ] Record the final GitHub `main` commit after publication and rerun deterministic documentation generation/parity.
