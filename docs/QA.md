# Quality assurance

Evidence date: 2026-08-14. The current evidence covers the pre-merge August 13 roster/portrait refresh. The completed August 8 how-to, database-time countdown, retained test entry, and fixture-retirement evidence remains below as dated production history; it does not verify the new roster.

## August 13 roster refresh: current pre-merge results

| Gate                            | Command or environment                                     | Result                                                                                                                                                                                                                                                                                                                                |
| ------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository/GitHub audit         | read-only Git plus GitHub API inspection                   | Feature worktree began clean at `7d1996ca`, one direct commit ahead of live `main` `38aa37ad`. The branch incorrectly tracked `origin/main`; no remote feature branch, pull request, or feature checks existed.                                                                                                                       |
| Candidate roster/portrait state | owner handoff plus application-fixture reconciliation      | Passed for 582 players and 582 portraits: 12 additions, 17 removals, four intra-league moves, seven restored portraits, and ten replaced portraits relative to August 8. The fixture, raw JSON, final JSON, workbook, source portraits, tracked fixture, and published portraits reconcile exactly.                                   |
| Roster authority                | owner decision recorded 2026-08-14                         | Treat the August 13 handoff as owner-selected and internally reconcile it without rerunning its acquisition scripts. This release does not claim independent official-club or Premier League roster verification.                                                                                                                     |
| Compatibility                   | owner decision recorded 2026-08-14                         | Use the exact refreshed asset set: remove 17 obsolete paths and apply four club-move renames without legacy copies. Preserve inactive database rows for historical picks and retain the runtime silhouette fallback.                                                                                                                  |
| Documentation generator         | `npx vitest run tests/unit/docs-generator.test.ts`         | Passed ten focused tests for NUL-safe Git discovery, private exclusion, deterministic hashes/links/headings, legacy/current ownership, unmanaged and duplicate-target collisions, symlinks, atomic output, staged/unstaged source deletion, exact CLI flags, and marker-owned orphan cleanup.                                         |
| Final handoff evidence          | retained private report and contact sheet                  | Report status `passed`; `PL Players!A1:K583` reconciled all 582 rows and 11 columns with no formulas, errors, or mismatches. All 582 PNGs decoded at 192×192 with unique encoded and decoded-pixel SHA-256 values. The 33-tile contact sheet passed visual inspection.                                                                |
| Exact private cleanup           | approved two-copy stale-artifact removal                   | After the passing pre-cleanup gate, removed only `progress.json` and the two superseded mismatch reports from both August 13 copies. The retained copies are byte-identical: 613 files, 24,912,376 bytes, full manifest SHA-256 `f625470979c156e233300ec42924eb858255d902a456af1283a089ae41169630`.                                   |
| Catalogue and safety coverage   | focused Vitest plus `npm run players:check`                | Passed 77 focused tests. The release validator proved exact 582-file coverage, full decode, dimensions, unique hashes/pixels, exact transition identities, provenance IDs, derived selector fields, traversal rejection, validation-before-mutation, rollback, and clean-clone release fingerprints.                                  |
| Production baseline             | approved read-only pre-release state                       | Production remains unchanged at 587 total/active players and 580 portrait paths. The 582-player fixture is not merged, deployed, or seeded.                                                                                                                                                                                           |
| Complete pre-merge chain        | `CI=1 npm run check` against attested isolated Neon        | Passed uninterrupted on the final pre-PR revision: 14-document parity, catalogue validation, formatting, ESLint, strict TypeScript, 205 unit/component tests with 11 guarded integration skips, all 11 isolated Neon integration tests, Webpack production build, five pre-kickoff browser journeys, and three post-kickoff journeys. |
| Release and production proof    | GitHub, Vercel, approved seed, read-only live verification | `TBD after release`: feature PR, merge SHA, exact Ready deployment, alias mapping, one production-seed result, database counts, selector/portrait/browser proof, and any required documentation-closeout PR.                                                                                                                          |

## August 8 completed production release (historical)

| Gate                      | Command or environment                                            | Result                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete local chain      | `CI=1 npm run check`                                              | Passed documentation/player parity, formatting, ESLint, strict TypeScript, 150 default tests with 10 guarded skips, all 10 isolated Neon integration tests, the Webpack production build, five pre-kickoff browser projects with 20 intentional skips, and three post-kickoff browser projects with two intentional skips. |
| Reviewed player catalogue | `npm run players:check` within the aggregate check                | Verified the then-current August 8 fixture: 587 players, 580 portrait paths, and seven silhouette fallbacks.                                                                                                                                                                                                               |
| Production data preflight | read-only aggregate query plus public page inspection             | Found zero prediction parents, table items, or spotlight picks before the requested test entry. Alex and Jordan existed only in a hard-coded component, not in Neon.                                                                                                                                                       |
| Retained production entry | supported public three-stage form                                 | Created `Dranx Test Entry`; follow-up verification found one parent with exactly 20 ordered table rows and seven spotlight rows. The public table leaderboard shows one entry, while unrevealed private picks remain absent from `/spotlight`.                                                                             |
| Live how-to sources       | mobile Chromium at 390 by 844 pixels                              | Captured stage 1, stage 2, and final review from the public live flow without submitting the walkthrough draft. All three PNGs were visually inspected.                                                                                                                                                                    |
| Production deployment     | Vercel production deployment `dpl_2L4cprnsWShhesujY7sTLKffywhg`   | Ready at the immutable URL recorded below after GitHub PR #13 merged to `main`. Read-back proved the stable public alias resolves to this deployment.                                                                                                                                                                      |
| Production release smoke  | `npm run test:production-smoke` against the immutable URL         | Passed 5 of 5 projects: desktop Chromium, 390-pixel mobile Chromium, exact 320/430-pixel Chromium reflow, and mobile WebKit. A second read-only mobile Chromium pass captured the dedicated countdown artifact.                                                                                                            |
| Production runtime logs   | exact-deployment error and HTTP 500 queries, preceding 30 minutes | Both queries returned no records after the smoke run.                                                                                                                                                                                                                                                                      |

The historical first aggregate-check attempt stopped at Prettier before lint, tests, integration, or build ran. After formatting the one flagged mobile test, the clean uninterrupted August 8 run above passed. The local environment uses the repository's verified Webpack build because the restricted sandbox does not permit a default Turbopack helper to bind its internal port.

The first August 14 post-kickoff browser run exposed one integration error in the newly hardened test harness: the wrapper emitted a target-specific attestation, while the isolated test clock still recognized only the retired static marker. The clock therefore ignored the fixed test instant and safely used the live database time. The clock now validates the shared dynamic attestation; legacy-marker spoof and target-mismatch tests were added. The corrected post-kickoff run and the later uninterrupted aggregate check both passed.

## Historical August 8 feature coverage

The default, integration, and browser suites now cover:

- a compact four-tile days/hours/minutes/seconds countdown beside the open-submissions status;
- database-time-derived initial duration, monotonic elapsed-time updates, zero clamping, padded digits, and exactly one server refresh at zero;
- the three-card live-mobile how-to section, all three images, numbered callouts, renamed navigation, and the `How to play & scoring` page heading;
- 320-, 390-, and 430-pixel Chromium reflow plus iPhone WebKit, with no document-level horizontal overflow;
- the complete journey from 20-club ordering through seven spotlight selectors to one review and atomic submit;
- pre-reveal privacy for prediction identifiers, positions 2–20, all seven spotlight subjects, and hidden accuracy ordering;
- absence of the former Alex/Jordan component and its dedicated demo assertions; and
- the existing 56-pixel mouse/touch/keyboard reorder handles, searchable selectors, Other-player path, safe-area action, long-name wrapping, table scoring, standings, administrator deletion, and compare-and-swap protections.

The countdown is an informational display. The server calculates its starting duration from PostgreSQL time, while the atomic submission statement still locks the season and rechecks PostgreSQL `clock_timestamp()` against the effective deadline. Device-clock changes or a stale open page therefore cannot authorize a late write.

## Production data verification

Read-only live inspection established the baseline before any requested mutation:

- `/leaderboard` showed no entries;
- `/spotlight` showed zero active brackets but rendered Demo Alex and Demo Jordan;
- the production database contained zero prediction parents, zero table items, and zero category picks.

Source tracing proved the two names were rendered unconditionally by `src/features/leaderboard/leaderboard-demo.tsx`. They were never partial stage-two submissions, so deleting database rows would have been both unnecessary and incorrect. The release removes the import, render path, component, and demo-specific tests.

The retained `Dranx Test Entry` was then submitted through the public three-stage UI. It contains:

- 20 ordered clubs, headed by Arsenal, Liverpool, Manchester City, and Chelsea;
- top scorer Erling Haaland;
- top assister Bruno Fernandes;
- most clean sheets Arsenal;
- underdog team Sunderland;
- overrated team Manchester United;
- underdog player Chris Rigg; and
- overrated player Alysson.

The final post-release database verification exposed only safe aggregate facts: one parent, 20 child positions, seven category picks, and the sole display name `Dranx Test Entry`. It found no display name containing Alex or Jordan. It did not print prediction IDs, receipt material, database URLs, private pick subjects, or credentials. Before reveal, the public spotlight page reports one active bracket but does not serialize or display those seven choices.

## Annotated live-mobile walkthrough

The participant-facing `/rules` section uses three first-party captures from the live 390 by 844 public flow:

1. `public/how-to-play/step-1-table-mobile.png` — ordered club table, reorder handles, display-name field, and continue action.
2. `public/how-to-play/step-2-spotlight-mobile.png` — selected player/club controls and the review action.
3. `public/how-to-play/step-3-review-mobile.png` — the complete 20-position and seven-pick review with the final submit action.

Each image receives two numbered overlay pins at render time. The same numbers and instructions appear as adjacent HTML text, so the annotations remain accessible, selectable, responsive, and understandable without colour. The walkthrough draft used the unsaved display name “How to play preview”; it never created a second production entry.

## Production deployment and mobile evidence

GitHub [PR #13](https://github.com/vdoshi96/Pl-predictions/pull/13) merged the tested feature into `main` at `a7785b9b16b64be825e06ef8f181ab5f98031524`. Vercel production deployment `dpl_2L4cprnsWShhesujY7sTLKffywhg` is Ready at [https://pl-predictions-9h7r762li-vdoshi96s-projects.vercel.app](https://pl-predictions-9h7r762li-vdoshi96s-projects.vercel.app). The standard release alias command moved [https://pl-predictions-2026.vercel.app](https://pl-predictions-2026.vercel.app) to that exact deployment, and deployment-ID read-back verified the mapping.

The final read-only smoke passed all five browser projects against the immutable URL. It exercised the timer, all three entry stages without submitting, the table leaderboard, private pre-reveal spotlight state, absence of Alex/Jordan fixtures, the annotated how-to, administrator login, 320–430-pixel reflow, WebKit, local imagery, no horizontal overflow, and browser/network/HTTP guards. The exact-deployment error-level and HTTP 500 log queries returned no records in the preceding 30 minutes.

Only the newest completed production run is retained under `docs/assets/qa/`. All seven artifacts were visually inspected for readable type, clear hierarchy, painted local imagery, reachable actions, correct annotations, and absence of clipping.

**Submission countdown — mobile Chromium at 390 by 844:** the compact calendar-flip timer is prominent inside the open-submissions card without overwhelming the hero or first-stage action.

![Production submission countdown on mobile Chromium](assets/qa/countdown-mobile.png)

**Prediction sorter — mobile Chromium at 390 by 844:** the reordered table, 56-pixel handle, painted crests, and sticky continue action fit without horizontal overflow.

![Production prediction sorter on mobile Chromium](assets/qa/prediction-mobile.png)

**Spotlight stage — mobile Chromium at 390 by 844:** all seven selector values are prepared and the review action remains reachable above the safe area.

![Production spotlight-pick stage on mobile Chromium](assets/qa/spotlight-picks-mobile.png)

**Final review — mobile Chromium at 390 by 844:** the preview shows the 20-club and seven-pick counts, real portraits, club crests, the custom-player silhouette, and the submit action. The smoke closes this preview without submitting.

![Production final review on mobile Chromium](assets/qa/review-mobile.png)

**Private spotlight state — mobile Chromium at 390 by 844:** the page exposes category navigation and its complete-bracket privacy explanation, with no Alex/Jordan fixture or real pick subjects.

![Production private spotlight page on mobile Chromium](assets/qa/spotlight-mobile.png)

**Rendered how-to annotations — 358 by 1200 element capture from mobile Chromium:** the first live-mobile card shows numbered overlay pins and matching textual instructions; the next card remains discoverable at the horizontal edge.

![Production annotated how-to section on mobile Chromium](assets/qa/how-to-mobile.png)

**Administrator sign-in — mobile Chromium at 390 by 844:** the owner-only credential form and navigation reflow cleanly.

![Production administrator sign-in on mobile Chromium](assets/qa/admin-login-mobile.png)

## Security and cleanup boundaries

- No environment value, receipt token, database URL, administrator credential, or subscription cookie is committed or printed.
- Production creation was limited to the explicitly requested retained test entry. The destructive production-write smoke was not used because that harness intentionally deletes its QA entry.
- The retained entry followed the same atomic write path as every participant: parent plus 20 table rows plus seven spotlight rows, or nothing.
- Alex/Jordan removal is a code cleanup, not a data deletion. No legitimate production submission was deleted.
- Public pre-reveal output continues to expose only the permitted table-leaderboard projection and complete-bracket count.
- The private handoffs remain untracked, ignored by exact root-anchored rules, excluded from generated documentation, and absent from the release diff. Acquisition scripts were not executed. The August 13 handoff was copied byte-for-byte into the primary repository, received only the approved final report/contact sheet and exact stale-artifact cleanup in both copies, and was reverified byte-identical afterward.
- The four known moderate `npm` advisories remain confined to the pre-existing development-only `drizzle-kit` legacy `esbuild` chain. The production dependency closure excludes that chain, the feature adds no runtime version change, and the uninterrupted release checks passed; no breaking forced downgrade was applied.

## August 13 roster release closeout state

- [x] Complete the read-only Git/worktree/GitHub audit and record the production pre-seed baseline.
- [x] Record the owner-selected roster authority, internal-only verification boundary, and exact no-legacy compatibility decision.
- [x] Pass the final complete local verification chain and visually inspect every added, restored, replaced, and renamed portrait.
- [ ] Push the feature branch under its own upstream, open the PR, and merge only after every available check is green.
- [ ] Verify the exact merged production deployment and stable alias, then run the approved idempotent production seed exactly once.
- [ ] Verify 582 active players, expected inactive historical rows, 582 portrait paths, representative additions/removals/moves, Other player, historical references, and every active portrait in the live UI.
- [ ] Record the exact PR, merge SHA, deployment, seed, browser/image verification, and any production-specific documentation closeout.
- [ ] Synchronize local `main`, verify retained handoff hashes, and remove the completed branch/worktree only after all release gates pass.

## August 8 release closeout state (historical)

- [x] Implement and locally verify the countdown, annotated walkthrough, navigation copy, and fixture removal.
- [x] Create and verify one complete retained production test bracket.
- [x] Pass the uninterrupted full local verification chain.
- [x] Merge GitHub PR #13 into `main` and verify the Ready production deployment plus stable alias mapping.
- [x] Pass the final five-project read-only production smoke, visually inspect all seven newest screenshots, and find no error-level or HTTP 500 records in the tested window.
- [x] Regenerate final HTML peers, publish this closeout through `main`, synchronize local and remote `main`, and remove completed branch state.
