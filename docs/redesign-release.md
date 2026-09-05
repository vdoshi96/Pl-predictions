# Approved redesign release

## Scope

Implement the approved September 5, 2026 interactive redesign across the 13 application routes, entry stages, and system states. Retain the points podium, group it by occupied competition rank, and show every tied participant equally. The owner authorizes implementation, GitHub integration, and production deployment.

## Direction

Use warm paper and calm surfaces, purple brand accents, compact headings, and comparison-first layouts. Keep the original badges. Use a consistent small animal icon system on the podium, derived from public display names without persistence or new personal data. The primary navigation distinguishes Season table from Leaderboard.

## Implementation plan

1. Establish shared surface tokens, navigation, and compact page headings.
2. Recompose the season comparison, friends' leaderboard and podium, Spotlight views, and entry detail.
3. Adapt entry, review, receipt, Rules, Win Streak, owner workflows, and system states while preserving complete interactions.
4. Run focused regressions, the full isolated verification gates, and desktop/mobile visual checks. Update canonical documentation and HTML peers.
5. Push and merge the feature branch, verify the exact Ready production deployment and stable alias, run bounded read-only production checks, and synchronize local main.

## Data boundary

No production migration, fixture refresh, seed, participant write, result publication, deadline edit, LOCK, or REVEAL belongs to this redesign. Write journeys use the repository's fail-closed isolated database wrapper. Preserve the fresh main branch's September 4 fixture updates.

## Verification and release status

The starting base is `55c2664`, including PR #63. The redesign preserves that fixture update.

| Check                            | Evidence                                                                                                                                                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Podium regression                | The original three-slot implementation failed the strengthened tie tests. The replacement includes every participant at occupied ranks 1, 2, and 3, including more than three joint leaders.                                            |
| Unit and component tests         | 429 passed; 34 database-guarded cases remain excluded from the default run.                                                                                                                                                             |
| Isolated integration             | 32 passed. Win Streak fixtures use real PostgreSQL time and a disposable future season; production deadline guards remain unchanged.                                                                                                    |
| Catalogue integrity              | 580 players, 578 decoded portraits, two intentional silhouettes, and release fingerprints verified.                                                                                                                                     |
| TypeScript and ESLint            | Passed.                                                                                                                                                                                                                                 |
| Optimized application build      | Passed with the installed Next.js 16.3 webpack build.                                                                                                                                                                                   |
| Design detector                  | No findings across changed and added interface files.                                                                                                                                                                                   |
| Entry and owner browser journeys | 24 passed across desktop Chromium, mobile Chromium, 320px, 430px, and mobile WebKit. Two narrow-screen assertions were updated for the selected dataset workspace and passed on targeted replay; 26 routing exclusions are intentional. |
| Revealed-state browser matrix    | 5 passed across desktop Chromium, mobile Chromium, 320px, 430px, and mobile WebKit. Four joint first-place participants remain equally represented; results, separate scoring, privacy, and all route reflow checks pass.               |
| Accessibility                    | Zero WCAG A/AA violations across 40 checks: 28 light route/viewport checks, ten dark public route/viewport checks, and both full-page review sizes.                                                                                     |
| Independent finish review        | Disposition **ship** for the four scored fixes, all resolved. The reviewer checked refreshed desktop/mobile captures and sampled source; runtime gates remain separately recorded here.                                                 |
| Production release               | Pending GitHub integration and exact deployment/alias verification.                                                                                                                                                                     |

## Test isolation and cleanup

Browser journeys run through `scripts/run-with-test-database.mjs`. They restore the exact original season state and remove their tracked predictions, table items, spotlight picks, standings snapshots, import runs, and audit records. The Win Streak helper creates all 37 rounds and 370 future fixtures in a disposable season. It temporarily assigns that season the active slug only inside the isolated browser run, then deletes it and verifies restoration of the original season ID. It never changes PostgreSQL time or disables a guard. The final read-only cleanup check, saved as `docs/assets/qa/redesign/cleanup.json`, found zero predictions, table items, Spotlight picks, standings snapshots/items, Win Streak profiles/picks, or temporary Win Streak seasons. The original 2026/27 season is open, unrevealed, and has no active/final standings pointer.

An interrupted runner left two synthetic post-kickoff snapshots in the isolated database. Targeted cleanup removed snapshots `5762cf59-d44f-417a-ba00-9527080f7b73` and `7e91076f-fea7-45be-a69e-eddd9ee3e212`, plus predictions `f24da22b-c566-45aa-9265-69f9300fd9ac` and `8641dcb0-0008-4098-a60c-48cb53d2644d`. Verification found zero remaining predictions, prediction items, spotlight picks, standings snapshots, and standings items. The empty open baseline was re-established before the completed suites. Production was never the cleanup target.

## Interface evidence

Captures in `docs/assets/qa/redesign/` cover the comparison table, leaderboard, three Spotlight views, entry detail, Rules, Win Streak, owner pages, and the full-page entry review. The route matrix uses synthetic isolated QA entries. The `before-*` and `after-*` public comparisons show actual published data through read-only requests. The `public/how-to-play/` entry walkthrough comes from the isolated build. Each path retains this iteration's newest capture.

The four requested finish-review corrections are visible in the refreshed evidence: each mobile club row includes Group avg.; Stage 3 displays all 20 clubs and seven picks with separate edit actions; the owner results desk selects one workspace without losing unsaved edits; and owner headings omit the decorative eyebrows. Browser checks verify the edit round trip, retained drafts, rejection recovery, immutable submission, and disabled publication gates before reveal.

Local Next.js sometimes reports a destination stream closing early during automated navigation. This is retained as a local verification limitation; it is not treated as production evidence or as a failed business transition.

The implemented visual system is recorded in [DESIGN.md](../DESIGN.md), with the machine-readable extension at `.impeccable/design.json`.

## Release and checkout closeout

Local verification and the four-fix independent design verdict are complete. The `vishal/approved-redesign` worktree remains active until merge and deployment verification complete.
