# Quality assurance

Evidence date: 2026-08-08. This document records the newest completed local and production verification for the table-only leaderboard and separate spotlight-accuracy iteration. The administrator-login rate limit is live. Earlier release history remains in `docs/context/LOG.md`.

## Current results

| Gate                          | Command or environment                                                       | Result                                                                                                                                                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Focused Markdown formatting   | `npx prettier --check docs/QA.md docs/context/STATUS.md docs/context/LOG.md` | Passed for the three updated canonical records. HTML peers are regenerated separately by the canonical documentation workflow.                                                                                                                         |
| Complete local chain          | `CI=1 npm run check`                                                         | Passed on the tested feature revision: documentation and player-catalogue parity checks, formatting, ESLint, strict TypeScript, the default suite, isolated Neon integration, the Webpack production build, and both deterministic browser phases.     |
| Unit/component/default suite  | `npm test` within the aggregate check                                        | 148 passed; 10 database cases were skipped by their explicit opt-in guard.                                                                                                                                                                             |
| Isolated Neon integration     | `npm run test:integration`                                                   | 10 passed through the fail-closed test-database wrapper. The atomic prediction case persists one parent, exactly 20 ordered table rows, and exactly seven spotlight rows or persists none.                                                             |
| Pre-kickoff browser phase     | deterministic Playwright phase                                               | 5 passed with 20 intentional project-routing skips across desktop Chromium, 320/390/430-pixel Chromium, and iPhone 13 WebKit.                                                                                                                          |
| Post-kickoff browser phase    | deterministic Playwright phase                                               | 3 passed with 2 intentional project-routing skips.                                                                                                                                                                                                     |
| Reviewed player catalogue     | `npm run players:check` within the aggregate check                           | Exact reviewed result: 587 players across the 20 clubs, 580 local portrait PNGs, and seven intentional silhouette fallbacks.                                                                                                                           |
| Vercel production build       | deployment `dpl_3tyxwNSXGwTSuLctieAiJHYB2K9d`                                | Ready with target `production` for exact Git SHA `dc7b91ffd20200b79a51593c15b7dcb92cb493ab`. The stable alias resolves to its immutable deployment URL.                                                                                                |
| Anonymous production smoke    | strengthened `npm run test:production-smoke`                                 | 5 of 5 projects passed against the stable alias. The run covered the table-only leaderboard, separate spotlight page, all seven available demo portraits, Alysson's silhouette, rules, administrator login, narrow reflow, and browser/network guards. |
| Production write smoke        | not run for this iteration                                                   | This presentation-only release performs no schema, seed, standings, prediction, administrator, or other production-data mutation. The prior approved exact create-and-delete evidence remains in history.                                              |
| Production database baseline  | migrations `0000` through `0005`                                             | This iteration adds no schema or seed change. The reviewed catalogue remains 587 players with 580 portrait paths and seven null fallbacks.                                                                                                             |
| Production mobile evidence    | mobile Chromium at 390 by 844 pixels                                         | The prediction, review, spotlight-accuracy demo, and administrator-login screenshots were refreshed from the exact deployment and visually inspected.                                                                                                  |
| Administrator credential path | prior bounded write smoke                                                    | The configured administrator username plus salted PBKDF2-SHA-256 password hash authenticated successfully. The raw owner password was not written to source, logs, or documentation.                                                                   |
| Legacy administrator fallback | prior deployment metadata plus bounded login                                 | `ADMIN_SECRET` is absent from production, preview, and development inventories and from the running production deployment. `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` are present.                                                                     |
| Administrator login WAF       | `vercel firewall publish --yes` plus read-back                               | Live rule `rule_admin_login_protection_b4i7gM` limits `POST /admin/login` to 10 requests per 60 seconds for each IP. Excess requests receive HTTP 429. The read-back found active version 2 and no remaining draft.                                    |

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

The production harness retains three earlier browser boundaries. A touch drag receives one bounded retry but still has to change the club order. Cancelled optimized portrait candidates are ignored only while rendered-image assertions require the selected portraits. Both demo detail panels open before the test requires every available portrait and Alysson's silhouette. This iteration also ignores only Mobile WebKit's exact cancelled unauthenticated `/admin?_rsc` prefetch message and gives the complete production journey 90 seconds instead of the generic 30. The final read-only run passed all five projects.

Automated WebKit emulation is strong regression evidence but is not a substitute for a final spot check on the owner's physical iPhone when one is available.

## Production deployment evidence

GitHub [PR #10](https://github.com/vdoshi96/Pl-predictions/pull/10) merged the table and spotlight split into `main` at exact merge SHA `dc7b91ffd20200b79a51593c15b7dcb92cb493ab`. Deployment `dpl_3tyxwNSXGwTSuLctieAiJHYB2K9d` is Ready with target `production` at immutable URL [https://pl-predictions-6yyae7a73-vdoshi96s-projects.vercel.app](https://pl-predictions-6yyae7a73-vdoshi96s-projects.vercel.app). Its metadata identifies that exact SHA. Read-back proves that the stable public alias [https://pl-predictions-2026.vercel.app](https://pl-predictions-2026.vercel.app) resolves to it.

The final read-only production smoke passed 5 of 5 browser projects. It verified application health, the three-stage preview, seven completed picks, the table-only leaderboard, the separate spotlight-accuracy page, all seven available demo portraits, the intentional Alysson silhouette, the rules page, administrator sign-in, 320–430-pixel reflow, no horizontal overflow, and no unexpected browser, same-origin request, or HTTP response errors. The harness ignores only Mobile WebKit's exact cancelled unauthenticated `/admin?_rsc` prefetch message; direct administrator-login navigation, HTTP failures, and every other error remain enforced. A 90-second project timeout keeps cold production plus the full selector journey from inheriting the generic 30-second limit.

No production write smoke ran for this iteration because the release changes derived presentation, documentation, and smoke assertions only. The prior separately approved exact create-and-delete journey remains preserved in the earlier release history.

The successful post-removal login proves the configured hash path because deployment metadata contains `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` but not `ADMIN_SECRET`. The legacy name is also absent from production, preview, and development environment inventories. The raw credential remained in macOS Keychain only and was never written to source, browser artifacts, logs, or documentation.

The administrator-login WAF rule is live. It matches only `POST /admin/login`. Each IP can send 10 requests in 60 seconds. Excess requests receive HTTP 429. The post-publication read-back found active version 2 and no remaining draft.

## Production mobile screenshots

Only the newest completed production run is retained. All four screenshots were refreshed from deployment `dpl_3tyxwNSXGwTSuLctieAiJHYB2K9d` at 390 by 844 pixels and visually inspected for readable wrapping, reachable actions, painted local imagery, and absence of horizontal clipping.

**Prediction entry — mobile Chromium at 390 pixels:** stage one shows all 20 club crests in the mobile sorter after a verified keyboard move, with the display-name field and safe-area-aware spotlight action fitting the viewport.

![Production prediction entry on mobile Chromium](assets/qa/prediction-mobile.png)

**Review dialog — mobile Chromium at 390 pixels:** the complete review contains the ordered 20-club table and all seven spotlight categories. Assertions before capture verify real portraits for Cole Palmer, Declan Rice, and Elliot Anderson, plus the generic silhouette for the custom Other player.

![Production prediction review dialog on mobile Chromium](assets/qa/review-mobile.png)

**Spotlight accuracy demonstration — mobile Chromium at 390 pixels:** the separate page labels the test run and bracket-count formula, shows a ranked demo entry, and never changes the table leaderboard. Browser assertions also require all seven available demo portraits, club crests, and Alysson's intentional silhouette to render.

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

- [x] Merge GitHub PR #10 into `main` at exact SHA `dc7b91ffd20200b79a51593c15b7dcb92cb493ab`.
- [x] Verify Ready production deployment `dpl_3tyxwNSXGwTSuLctieAiJHYB2K9d`, its immutable URL, exact SHA, and stable alias mapping.
- [x] Preserve migrations `0000` through `0005` and the reviewed 587-player catalogue without a production database write.
- [x] Pass the strengthened five-project read-only smoke; no production write smoke was needed or run.
- [x] Refresh and visually inspect the newest four mobile screenshots.
- [x] Confirm username-plus-PBKDF2 authentication, remove `ADMIN_SECRET` from Vercel inventories, deploy without it, and pass the bounded owner-login check against that exact runtime.
- [x] Publish the 10-per-60-second, per-IP administrator-login rate limit and make sure that no draft remains.
- [x] Implement and fully verify the table-only main leaderboard and separate dynamic spotlight-accuracy page locally.
- [ ] Set up the future owner-run Codex automation for the five pending outcome rankings and custom Other-player reconciliation.
- [x] Deploy the score split, pass the read-only production smoke, replace the retained mobile evidence, publish final HTML parity, synchronize local and remote `main`, and remove completed branch state. The self-referential final evidence merge SHA is intentionally not pinned here.
