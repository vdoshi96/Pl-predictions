# Quality assurance

Evidence date: 2026-08-08. This document records the newest completed local verification for the table-only leaderboard and separate spotlight-accuracy iteration. Production rows remain the prior-release baseline until this tested revision is merged and deployed. The administrator-login rate limit is live. Earlier release history remains in `docs/context/LOG.md`.

## Current results

| Gate                          | Command or environment                                                       | Result                                                                                                                                                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused Markdown formatting   | `npx prettier --check docs/QA.md docs/context/STATUS.md docs/context/LOG.md` | Passed for the three updated canonical records. HTML peers are regenerated separately by the canonical documentation workflow.                                                                                                                     |
| Complete local chain          | `CI=1 npm run check`                                                         | Passed on the tested feature revision: documentation and player-catalogue parity checks, formatting, ESLint, strict TypeScript, the default suite, isolated Neon integration, the Webpack production build, and both deterministic browser phases. |
| Unit/component/default suite  | `npm test` within the aggregate check                                        | 148 passed; 10 database cases were skipped by their explicit opt-in guard.                                                                                                                                                                         |
| Isolated Neon integration     | `npm run test:integration`                                                   | 10 passed through the fail-closed test-database wrapper. The atomic prediction case persists one parent, exactly 20 ordered table rows, and exactly seven spotlight rows or persists none.                                                         |
| Pre-kickoff browser phase     | deterministic Playwright phase                                               | 5 passed with 20 intentional project-routing skips across desktop Chromium, 320/390/430-pixel Chromium, and iPhone 13 WebKit.                                                                                                                      |
| Post-kickoff browser phase    | deterministic Playwright phase                                               | 3 passed with 2 intentional project-routing skips.                                                                                                                                                                                                 |
| Reviewed player catalogue     | `npm run players:check` within the aggregate check                           | Exact reviewed result: 587 players across the 20 clubs, 580 local portrait PNGs, and seven intentional silhouette fallbacks.                                                                                                                       |
| Prior production baseline     | deployment `dpl_HT2uPdP5iJPaWuYtNFEknroRmTqG`                                | The prior release remains Ready with target `production` for exact Git SHA `a9d1c12c804ff34db48450ff2e57bded64710022`. The current spotlight-accuracy split is not yet claimed as deployed in this row.                                            |
| Prior anonymous smoke         | corrected `npm run test:production-smoke`                                    | The prior release passed 5 of 5 projects against the stable alias. A new read-only run remains pending after deployment of this iteration.                                                                                                         |
| Prior bounded write smoke     | hardened `npm run test:production-write-smoke`                               | The prior release passed its one approved exact create-and-delete journey with zero residue. No production write ran for the current iteration.                                                                                                    |
| Production database baseline  | migrations `0003` through `0005` plus idempotent seed                        | The prior transition completed with 587 active catalogue players, 580 portrait paths, seven null portrait fallbacks, and zero QA residue. This iteration adds no schema or seed change.                                                            |
| Prior mobile evidence         | mobile Chromium at 390 by 844 pixels                                         | The retained prediction, review, leaderboard, and administrator-login screenshots belong to the prior completed production run.                                                                                                                    |
| Administrator credential path | prior bounded write smoke                                                    | The configured administrator username plus salted PBKDF2-SHA-256 password hash authenticated successfully. The raw owner password was not written to source, logs, or documentation.                                                               |
| Legacy administrator fallback | prior deployment metadata plus bounded login                                 | `ADMIN_SECRET` is absent from production, preview, and development inventories and from the running production deployment. `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` are present.                                                                 |
| Administrator login WAF       | `vercel firewall publish --yes` plus read-back                               | Live rule `rule_admin_login_protection_b4i7gM` limits `POST /admin/login` to 10 requests per 60 seconds for each IP. Excess requests receive HTTP 429. The read-back found active version 2 and no remaining draft.                                |

The local environment uses the repository's verified Webpack production-build command because its restricted sandbox does not allow a default Turbopack helper to bind an internal port. Vercel built the release successfully, so this remains an execution-environment limitation rather than an application compile failure.

## Unit and component coverage

The 148-test default run covers the earlier table, season, standings, privacy, and administrator invariants plus the new spotlight scope:

- canonical seven-category taxonomy and exact-cardinality validation;
- club-only validation for most clean sheets, underdog team, and overrated team, plus player-only validation for top scorer, top assister, underdog player, and overrated player;
- first-name, last-name, and full-name player search, keyboard-accessible combobox behavior, and a required custom name for Other player;
- exact normalization of the owner-provided 587-player snapshot, canonical mapping to all 20 clubs, duplicate/unreferenced-asset rejection, 580 local portraits, and seven null portrait paths;
- `PlayerMark` portrait rendering with an accessible generic silhouette when a path is absent or a browser image fails;
- atomic acceptance of one prediction parent, all 20 ordered clubs, and exactly seven category picks;
- derived table scoring capped at 100, occupied category ranks, shared ranks, team expectation indexes, and opposite player-rating directions;
- authenticated exact prediction deletion, cascade behavior for all table items and spotlight picks, deletion audit preservation, and normalized-name reuse;
- PBKDF2-backed administrator login, malformed-hash and sentinel-value failure handling, legacy-fallback migration coverage, signed-session expiry/tamper protection, strict cookie attributes, and same-origin administrator mutations;
- pre-reveal privacy that withholds prediction identifiers, positions 2–20, and all seven spotlight picks from public HTML, RSC, and route payloads; and
- the existing database-clock cutoff, irreversible reveal, importer last-good preservation, standings finalization, and compare-and-swap race protections.

## Scoring behavior and open outcome inputs

The main leaderboard uses table points only and remains capped at 100. The predicted champion remains table position 1 and has no separate bonus. Spotlight accuracy is a separate fun view. Let `N` be the current number of active, nondeleted season brackets. Accuracy points are `max(0, N + 1 - outcome rank)`. Overall accuracy sums only resolved categories. A resolved zero-point result still counts as available. Pending categories remain unavailable. Equal overall scores share a competition rank. Category sorts use outcome rank from low to high and put pending entries last.

Team expectation outcomes are derivable from submitted tables plus actual standings. Underdog uses `average predicted position - actual position`; overrated uses the exact inverse. Each list is ranked largest first with full precision before the occupied-rank curve is applied.

Five category outcome rankings still require reviewed input: top scorer, top assister, most clean sheets, underdog player, and overrated player. A future owner-run Codex automation will enter them manually. The two player-opinion lists rank season-average ratings in opposite directions. Custom Other-player names still require reconciliation. The roster import supplies selector identities and portraits only. Missing outcomes remain pending and do not receive zero.

## Database and production data verification

The isolated Neon integration suite passed all ten cases through `scripts/run-with-test-database.mjs`. Its prediction lifecycle now proves that a successful write contains exactly one parent, 20 table rows, and seven spotlight rows; deletion cascades through both child sets. The other cases retain the deadline, lock serialization, revealed-season, last-good import, monotonic watermark, future-time, and active-pointer protections. The wrapper refuses to run against production, and deterministic clock overrides remain disabled outside the wrapper-attested test target.

Production was inspected before migration and contained zero predictions and zero prediction items; the player and category-pick tables did not yet exist. Migrations `0003`, `0004`, and `0005` then completed before the idempotent seed. Post-seed verification found 587 active players, 580 portrait paths, seven intentional null portrait paths, and both cross-season integrity triggers. The bounded write smoke subsequently created and removed only its unique QA entry. Final exact queries returned zero QA prediction parents, zero table items, zero category picks, and zero deletion-audit rows.

## Browser and mobile verification

The deterministic browser phases cover desktop Chromium, touch-enabled Chromium at 390 by 844, exact 320- and 430-pixel Chromium reflow, and iPhone 13 WebKit. Verified behavior includes:

- the complete three-stage path from ordering all 20 clubs, through seven spotlight selectors, to one review dialog and atomic submit;
- 56-pixel move handles, mouse/touch/keyboard table reorder, safe-area actions, long-name wrapping, and no document-level horizontal overflow;
- searchable keyboard-accessible player selectors using real catalogue names and images, including first-name and last-name queries;
- the Other-player text path and generic silhouette, while most clean sheets and the team-opinion categories show club crests rather than players;
- exactly seven spotlight rows in review, decoded real portraits for selected catalogue players, a rendered silhouette with no nested image for the custom player, and all 20 decoded club marks;
- receipt-only access before reveal and withholding of the other participant details from clean browser contexts and public serialization;
- the separate spotlight-accuracy test run with real player names, real available portraits, club crests, and an intentional silhouette example;
- the rules page, administrator sign-in, exact submission deletion, deletion audit, and complete isolated cleanup; and
- the existing deterministic pre/post-kickoff table scores, champion status, standings import, finalization, and undo paths.

The production reruns exposed three harness-only browser boundaries, not product failures. A touch drag may finish without crossing the insertion boundary on its first attempt, so the smoke permits one bounded retry and still requires the club order to change. A browser may cancel a speculative optimized player-face candidate during navigation; the request guard excludes only that cancellation while the UI makes explicit rendered-image assertions. Finally, the rank-two Haaland demo starts in a closed details element while rank-one Jordan starts open, so the harness now keeps both details open before it requires Haaland's portrait to decode and Alysson's silhouette to contain no image. The corrected read-only production run then passed all five projects.

Automated WebKit emulation is strong regression evidence but is not a substitute for a final spot check on the owner's physical iPhone when one is available.

## Prior production deployment evidence

GitHub [PR #7](https://github.com/vdoshi96/Pl-predictions/pull/7) merged the player-catalogue feature at `c976c1719c8c17f8169b9c8b86248765821b203a`; [PR #8](https://github.com/vdoshi96/Pl-predictions/pull/8) merged its hardened release evidence at `a9d1c12c804ff34db48450ff2e57bded64710022`. Deployment `dpl_HT2uPdP5iJPaWuYtNFEknroRmTqG` is Ready with target `production` at immutable URL [https://pl-predictions-dixkq8ma0-vdoshi96s-projects.vercel.app](https://pl-predictions-dixkq8ma0-vdoshi96s-projects.vercel.app). Its metadata identifies the exact PR #8 SHA, and the stable public alias [https://pl-predictions-2026.vercel.app](https://pl-predictions-2026.vercel.app) points to it. This is the prior-release baseline, not production proof for the current score split.

The corrected read-only production smoke passed 5 of 5 browser projects. It verified application health, the three-stage preview, seven completed picks, explicit decoded portrait/silhouette behavior, the visible leaderboard demonstration, the rules page, administrator sign-in, 320–430-pixel reflow, no horizontal overflow, and no unexpected browser, same-origin request, or HTTP response errors.

The separately gated production write smoke passed its one exact journey. Its production mode requires only the `PLAYWRIGHT_ADMIN_PASSWORD` environment value, disables screenshot, trace, and video artifacts, and uses the list reporter so the credential cannot leak into retained browser evidence. The hardened live run left only `.last-run.json` in its output/results locations. It submitted a unique complete entry, confirmed the receipt-only privacy boundary, authenticated with the username and PBKDF2-backed credential, exact-deleted the created prediction, verified the deletion audit, then removed that QA audit as part of teardown. Final queries again found zero parent, table-item, spotlight-pick, or deletion-audit residue from the run.

The successful post-removal login proves the configured hash path because deployment metadata contains `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` but not `ADMIN_SECRET`. The legacy name is also absent from production, preview, and development environment inventories. The raw credential remained in macOS Keychain only and was never written to source, browser artifacts, logs, or documentation.

The administrator-login WAF rule is live. It matches only `POST /admin/login`. Each IP can send 10 requests in 60 seconds. Excess requests receive HTTP 429. The post-publication read-back found active version 2 and no remaining draft.

## Production mobile screenshots

Only the newest completed production run is retained. These prior-release screenshots were refreshed at 390 by 844 pixels and visually inspected for readable wrapping, reachable actions, painted local imagery, and absence of horizontal clipping. The current iteration will replace them after deployment.

**Prediction entry — mobile Chromium at 390 pixels:** stage one shows all 20 club crests in the mobile sorter after a verified keyboard move, with the display-name field and safe-area-aware spotlight action fitting the viewport.

![Production prediction entry on mobile Chromium](assets/qa/prediction-mobile.png)

**Review dialog — mobile Chromium at 390 pixels:** the complete review contains the ordered 20-club table and all seven spotlight categories. Assertions before capture verify real portraits for Cole Palmer, Declan Rice, and Elliot Anderson, plus the generic silhouette for the custom Other player.

![Production prediction review dialog on mobile Chromium](assets/qa/review-mobile.png)

**Leaderboard demonstration — mobile Chromium at 390 pixels:** the visible demo is labelled as a test run and uses real player selections and available portraits, club crests for club categories, and an intentional silhouette fallback without affecting real participant standings.

![Production spotlight leaderboard demonstration on mobile Chromium](assets/qa/leaderboard-mobile.png)

**Administrator sign-in — mobile Chromium at 390 pixels:** the owner-only username-and-password entry point reflows cleanly with labelled fields and a full-width action.

![Production administrator sign-in on mobile Chromium](assets/qa/admin-login-mobile.png)

## Security and source review

- No environment value, receipt token, database URL, administrator credential, or subscription cookie is committed or exposed through a public variable.
- Administrator writes require both a valid signed session and exact same-origin request metadata. The configured password is stored as a salted PBKDF2-SHA-256 hash; the raw owner password is absent from source and documentation.
- Public pre-reveal data withholds prediction identifiers, positions 2–20, and all seven spotlight picks. The only intentional public projection remains the display name and predicted champion.
- A prediction is accepted only when one transaction can persist the parent, all 20 ordered team rows, and exactly seven category rows.
- The owner-provided raw roster handoff is normalized into reviewed local data and images. Its acquisition scripts are not used at runtime, and the application performs no live football API request, FotMob extraction, scraper, or Vercel Cron.
- A future owner-run Codex automation will enter the five pending result rankings manually. Missing outcomes remain unavailable until that entry and Other-player reconciliation are complete.
- The official Premier League logo/lion/ball assets remain excluded. The 20 owner-provided local club crests and imported player portraits are the only selector imagery used for this release, with the established labelled fallbacks.

## Release closeout state

- [x] Merge GitHub PR #7 into working `main` at exact SHA `c976c1719c8c17f8169b9c8b86248765821b203a`.
- [x] Merge PR #8 at `a9d1c12c804ff34db48450ff2e57bded64710022` and verify Ready production deployment `dpl_HT2uPdP5iJPaWuYtNFEknroRmTqG`, its immutable URL, exact SHA, and stable alias mapping.
- [x] Apply migrations `0003` through `0005`, seed and verify 587 players with 580 portraits and seven silhouettes, and prove there were zero pre-existing predictions.
- [x] Pass the corrected five-project read-only smoke and the one-case bounded write smoke with exact zero QA residue.
- [x] Refresh and visually inspect the newest four mobile screenshots.
- [x] Confirm username-plus-PBKDF2 authentication, remove `ADMIN_SECRET` from Vercel inventories, deploy without it, and pass the bounded owner-login check against that exact runtime.
- [x] Publish the 10-per-60-second, per-IP administrator-login rate limit and make sure that no draft remains.
- [x] Implement and fully verify the table-only main leaderboard and separate dynamic spotlight-accuracy page locally.
- [ ] Set up the future owner-run Codex automation for the five pending outcome rankings and custom Other-player reconciliation.
- [ ] Deploy the score split, run the new read-only production smoke, replace the retained mobile evidence, publish final HTML parity, synchronize local and remote `main`, and remove completed branch state.
