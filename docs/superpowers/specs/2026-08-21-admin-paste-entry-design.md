# Admin Paste Entry: Standings Tables and Spotlight Result Lists

- **Date:** 2026-08-21
- **Status:** Approved concept, awaiting implementation
- **Owner decisions locked during brainstorming:** text paste only (no AI/vision APIs), manual "seed from submissions" button, combined save+attest+publish confirm, diff review before every publish.

## 1. Problem

The owner has no football-data API keys. Today every update is manual:

- `/admin/standings` requires re-ordering 20 clubs by hand each matchweek.
- `/admin/results` requires adding spotlight result rows one searchable-select at a time, across four dataset cards, followed by a save → attest → publish → finalize ceremony per dataset.

This makes weekly upkeep slow and error-prone. The scoring engine itself is correct and fully derived; only the input UX needs improvement.

## 2. Goals

1. The owner can copy a league table from any website and paste it into `/admin/standings`; the parser fills a validated preview, shows a diff against the active snapshot, and publishes through the existing atomic snapshot path.
2. The owner can seed each spotlight dataset from the union of all submitted picks with one button, then update values by pasting list text (e.g. `Haaland 27`).
3. Publishing a spotlight dataset becomes one combined confirm dialog (diff + attestation + save + publish) instead of three separate steps.
4. Every new paste overrides the previous data by moving the existing active-snapshot pointer; history is preserved for audit.

## 3. Non-goals

- No AI/vision/OCR integration, no external HTTP data clients, no scrapers, no new runtime dependencies.
- No change to scoring formulas, coverage rules, snapshot immutability/sealing, CAS pointer transitions, or audit behavior.
- No public-facing changes; this is admin-surface only.
- No automatic scheduling/cron.

## 4. Current architecture the design plugs into

| Concern              | Existing code                                                                                                                                                                                                                                                                | Reused as-is |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Standings save       | `saveManualStandings` (`src/app/admin/standings/actions.ts`) accepts `{ matchweek, standings: [{ teamSlug, actualPosition, playedGames, leaguePoints }] }` and routes through `importCanonicalStandings` (duplicate detection, atomic replace, failure preserves last table) | Yes          |
| Standings validation | `createStandingsItemsSchema` (`src/features/standings/validation.ts`): exactly 20 unique known slugs, positions 1–20 unique, played 0–38 nullable, points −100…114 nullable                                                                                                  | Yes          |
| Team identity        | `PREMIER_LEAGUE_2026_27_TEAMS` (`src/data/teams.ts`): `displayName`, `shortName`, `slug`, `sortName`                                                                                                                                                                         | Yes          |
| Spotlight draft save | `saveSpotlightResultDraft` action takes rows `[{ subjectId, metricValue }]`, metadata, `expectedWorkingSnapshotId` (CAS)                                                                                                                                                     | Yes          |
| Spotlight publish    | `publishSpotlightResult` requires `coverageAttested: true`, working snapshot saved, exact-N coverage incl. boundary ties, aliases resolved, reveal+close done                                                                                                                | Yes          |
| Coverage semantics   | `coveredThroughRank === bracketCount N`; ties at rank N must be fully present; applies descending for goals/assists/clean sheets/underdog player and ascending for overrated player over the shared ratings list                                                             | Unchanged    |
| Alias resolution     | Other-player spellings must be matched to catalogue players before publish (`spotlightResultAliases`)                                                                                                                                                                        | Unchanged    |

## 5. Feature A — Standings paste import

### 5.1 UX flow

1. New collapsible "Paste table" panel on `/admin/standings` above the manual form.
2. Owner pastes multi-line table text and clicks Parse.
3. Parser output renders as an editable preview table (position, club, played, points) with per-row status: matched / low-confidence numbers / unknown club.
4. Below it, a diff against the active snapshot: position movement arrows, played/points changes, and counts of added/missing clubs.
5. Confirm is disabled until: all 20 clubs matched exactly once, positions form a 1–20 permutation, and no row is in error state. Low-confidence played/points cells may be left null (schema allows nulls) but are highlighted.
6. Confirm calls the existing `saveManualStandings` action with the parsed payload. Matchweek stays a separate manual field (rarely present in pasted text).

### 5.2 Parsing rules

- Split input into lines; ignore empty lines and obvious header/footer lines (lines containing no club-name match and either no integers or only column labels like `P W D L GD Pts`).
- Per line: extract integers and the remaining alphabetic tokens; the alphabetic run(s) are candidate club names.
- Club matching order: exact normalized `displayName` → `shortName` → `sortName` → curated alias table → word-window fallback.
  - Normalization: lowercase, Unicode NFKC, strip diacritics and punctuation, `&` → `and`, collapse whitespace.
  - Curated alias table (in `src/data`, derived strictly from the active 20-club set): `Spurs`→tottenham-hotspur, `Man Utd`→manchester-united, `Nottm Forest`→nottingham-forest, `Brighton`→brighton-and-hove-albion, `Villa`→aston-villa, etc. Aliases never override an exact match of another club's canonical name; a token matching no active club is an error, never a guess.
- Position: use a leading integer if present; otherwise infer from row order. If explicit positions exist they must be exactly 1–20 unique, else parse fails with the offending lines listed.
- Played/points classification:
  - If a header line was detected, map integer columns by header token (`P`/`Pl`→played, `Pts`→points, `GD` ignored).
  - Without a header, apply the heuristic first-integer-after-name = played, last-integer = points, and mark those cells **low-confidence** in the preview.
  - Any leftover unexplained integers mark the line low-confidence rather than failing the parse.
- Numbers tolerate thousands separators, en/em dashes, and trailing footnotes.

### 5.3 Edge cases

| Case                                         | Behavior                                                                                                                   |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Unknown club token ("Bayern Munich")         | Row flagged unknown; confirm blocked; message lists unparsed lines verbatim                                                |
| Ambiguous token matching two canonical names | Parse fails for that line; owner edits text or uses manual form                                                            |
| Duplicate club or missing club               | Confirm blocked with explicit missing/duplicate list (mirrors server-side zod messages)                                    |
| Positions absent entirely                    | Inferred from order; still validated as a permutation before confirm                                                       |
| All-zero played table                        | Allowed to save (preseason guard downstream treats it as not-started); preview shows a warning that scoring stays inactive |
| Pasting while active snapshot is final       | Panel disabled with note to undo final first (consistent with existing form behavior)                                      |
| Garbage input / empty paste                  | Parse produces zero rows; friendly error; nothing submitted                                                                |

## 6. Feature B — Results desk upgrades

### 6.1 Seed from submissions

- Per-dataset button **Seed from submissions**, enabled once predictions are revealed (`publishReady` gate already computed on the page).
- New admin query (server): union of distinct subject IDs picked for the categories mapping to the dataset (invert `RESULT_DATASET_BY_CATEGORY`): top_scorer→goals, top_assister→assists, most_clean_sheets→clean_sheets (team IDs), underdog_player + overrated_player→player_ratings (player IDs).
- Seeding merges subjects not already present as rows with metric 0; existing rows and edits are preserved; marks the draft dirty.
- Other-player spellings are **not** seeded (no subject ID until matched); the alias panel continues to govern them.
- Disabled when the dataset is finalized. Pressing seed resets the attestation checkbox (same as any edit).

### 6.2 Paste list text

- Per-dataset "Paste list" textarea (hidden for finalized datasets).
- Line grammar (tolerant): optional leading rank integer, subject name, trailing metric number. Examples: `1 Haaland 27`, `Haaland — 27`, `Salah 7.852`.
- Metric validation mirrors the editor: nonnegative integers for goals/assists/clean sheets; 0–10 with ≤3 decimals for ratings.
- Name matching against season players (or teams for clean sheets) using the same normalization as 5.2 plus `sortName` reversal (`Aarons, Max` → also try `Max Aarons`).
  - Zero matches: row flagged; one-click offer to create a result-only player via the existing `createStandaloneSpotlightResultOnlyPlayer` action, or skip the line.
  - Multiple matches (homonyms): flagged ambiguous; owner resolves via the existing searchable select for that row.
- Parsed rows merge into the editor (update metric when subject exists, append otherwise). Rows can always be removed manually afterwards.

### 6.3 Ratings lists longer than N

- Long pastes are desirable: the shared `player_ratings` list drives underdog player (descending) **and** overrated player (ascending), so deep lists improve lowest-rated accuracy.
- No cap is enforced on row count; however the publish gate still demands complete coverage through rank N in both directions, so the UI shows live coverage indicators: "complete through rank N ✓" or "rank N boundary incomplete: ties at value X missing players …".

### 6.4 Boundary-tie surfacing

- The editor already ranks rows client-side. Extend the ranking display to detect tie groups whose membership straddles rank N (descending datasets) or rank N ascending (overrated view) and render an amber warning naming the tied value and count.
- This is advisory; `assertPublishableCoverage` remains the enforcing authority server-side.

### 6.5 Combined save + attest + publish dialog

- Replace the current save button + checkbox + publish button cluster with one primary action: **Review & publish** (plus a secondary plain "Save draft" for work-in-progress).
- Dialog contents: full diff vs the currently published active snapshot (rank/value/added/removed per subject), unresolved-alias warnings if any, and the existing attestation sentence with an "I attest" confirmation control.
- On confirm, the client sequentially calls the existing `saveSpotlightResultDraft` then `publishSpotlightResult` with the returned working snapshot ID and `coverageAttested: true`.
  - If publish fails after save succeeded, the draft remains saved — a safe recovery state; the dialog reports the publish error and keeps state consistent (dirty=false, attestation reset).
- Finalize/undo keep their existing dedicated buttons and confirms; unchanged.

### 6.6 Diff-before-publish content

For each dataset, compared against the currently published active snapshot (or "nothing published yet"):

- Per-subject rows: old rank/value → new rank/value, with movement arrows.
- Added / removed subjects sections.
- Boundary tie warnings (6.4).
- Metadata summary: source, captured-at, covered-through-rank vs required N.

## 7. Constraints honored

- All mutations remain behind `requireAdminMutation` (signed session + same-origin); no new endpoints.
- Snapshots stay immutable and sealed; pointers move via existing CAS transitions; audit records unchanged.
- Import/save failures preserve the last accepted data (existing guarantee reused, not reimplemented).
- No secrets, keys, or external services introduced.
- Canonical docs parity: after implementation, run `npm run docs:generate` so this spec gains its HTML peer and `npm run docs:check` passes.

## 8. Testing strategy

- **Unit:** standings parser (header/no-header/garbage/alias/ambiguity/permutation cases), list parser grammar variants, name normalization/matching, boundary-tie detector, coverage indicator logic.
- **Component:** paste panels (disabled states, error rendering), combined dialog (attestation gating, sequential action calls, publish-failure recovery state), seed button merge semantics.
- **Integration (isolated Neon via `TEST_DATABASE_URL`/`TEST_DATABASE_NAME`):** seeded payload through real `saveManualStandings` → snapshot active; combined save+publish against real actions including alias-blocked publish; seed query correctness against fixture picks.
- **E2E (Playwright):** owner journey — paste table → diff → confirm → leaderboard reflects new table; seed → paste ratings → review & publish with attestation → spotlight page updates.
- Mobile QA per repo definition of done (320–430px reflow, touch targets) since these are admin forms used on phones too.

## 9. Open questions

None blocking. Implementation-time defaults chosen conservatively (documented above): low-confidence number cells become null rather than guessed values; alias table lives in `src/data` next to team fixtures.
