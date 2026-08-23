---
name: update-results
description: >-
  Checks the Win Streak fixture snapshot against official Premier League
  sources, pulls current FotMob standings and spotlight facts, publishes
  reviewed results through the owner admin desks, and verifies public scoring.
  Use only when the user explicitly invokes $update-results to refresh
  live-season results.
---

# Update results

Owner-run reviewed entry: check official Win Streak fixtures, fetch FotMob facts offline, enter reviewed facts through `/admin/standings`, `/admin/results`, and `/admin/win-streak`, then verify public scoring. Do not add football-source access to the deployed app.

## Hard stop

Do not:

- apply ambiguous Win Streak drift: changed clubs, pairings, matchweek membership, or any round that is resolved, has a pick, or has reached either the stored or proposed deadline
- add a runtime football client, scraper, cron, or FotMob call to the Next.js app
- write Win Streak fixture outcomes directly to the database or through an unauthenticated route
- advance a Win Streak matchweek with fewer than 10 reviewed fixture outcomes
- treat a postponed, abandoned, or unresolved fixture as `Void` without explicit owner review
- print `ADMIN_SECRET`, `ADMIN_PASSWORD_HASH`, `DATABASE_URL`, or any credential
- use `playwright.config.ts` / `npm run test:e2e` (those fail closed against the live DB)
- LOCK, REVEAL, or finalize snapshots unless the user asked
- seed unplayed players into `player_ratings` at rating `0`
- invent goals, assists, clean sheets, or ratings
- migrate a schema or include unrelated code or documentation in a fixture-drift release

Invoking `$update-results` authorizes reviewed live-season writes through the authenticated standings, spotlight-results, and Win Streak admin workflows. It also authorizes the bounded fixture-drift path below: when the complete official schedule produces only safe future kickoff changes, refresh the canonical snapshot, run the focused checks, publish the fixture-data-only change, run the targeted Win Streak seed, and verify the exact production deployment. It does not authorize schema changes, pairing changes, changes to protected rounds, or unrelated release work. Confirm the connected database is the intended season database by checking the prediction count and season slug before mutating.

## Checklist

```
- [ ] Run the official Win Streak fixture drift check; sync safe kickoff drift or stop on protected/ambiguous drift
- [ ] Fetch FotMob table + goals, assists, team clean sheets, player ratings
- [ ] Read N (active brackets) and distinct seeded subjects per dataset
- [ ] Start local Next against .env.local; sign in without logging the password
- [ ] Paste and save the 20-club table
- [ ] Seed + fill each spotlight dataset through rank N; publish provisionally
- [ ] Enter all 10 reviewed outcomes for each completed Win Streak matchweek
- [ ] Confirm each spotlight dataset has active_snapshot_id
- [ ] Verify /leaderboard, /spotlight, and public /win-streak results and picks
```

## Check Win Streak fixtures

Win Streak starts in Matchweek 2. The tracked snapshot contains 370 fixtures across Matchweeks 2-38; Matchweek 1 is outside the contest.

Use the following official Premier League sources:

- Fixture list: `https://www.premierleague.com/en/news/4675097`
- Final-matchweek timing: `https://www.premierleague.com/en/news/4675508/premier-league-fixture-schedule-released-for-season-202627`

Check the tracked snapshot before you enter results:

```
npm run win-streak:fixtures:check
```

The expected result on most runs is no fixture drift. Report the verified 370 fixtures, 37 matchweeks, and retained source-check date. When there is no drift, do not rewrite, seed, commit, or deploy anything for fixtures.

If the command reports drift, pause result-entry mutations while you classify it in a clean isolated worktree. Generate the reviewed candidate with the current ISO check date:

```
npm run win-streak:fixtures:apply -- --checked-at=YYYY-MM-DD
```

Inspect the exact snapshot diff. The automatic path is allowed only when every football change is a future date, time, `kickoffAt`, or `timeBasis` change for the same canonical fixture ID, home club, away club, and matchweek. Stop and report the exact affected fixtures without seeding or publishing when the candidate changes a club, pairing, fixture ID, or matchweek, or when the targeted seed reports a resolved round, an existing pick, or an old/new deadline that is not in the future.

For safe kickoff-only drift, run:

```
npm run win-streak:fixtures:check
npx vitest run tests/unit/win-streak-fixture-refresh.test.ts tests/unit/win-streak-fixture-seed.test.ts
npm run typecheck
npm run lint
```

Commit only `src/data/win-streak-fixtures.json` and its directly generated documentation metadata, push the isolated fixture branch, merge it to `main`, and wait for the exact Vercel deployment to become Ready. Against the verified live season database, run only:

```
npm run db:seed:win-streak
```

The targeted seed is the production guard: it updates only unresolved, unpicked rounds before both deadlines, preserves all fixture identities, and fails closed otherwise. Verify 37 rounds, 370 fixtures, the affected round hashes and kickoff times, the merged SHA, the Ready deployment, and `/win-streak`. Resume result entry only after this bounded fixture sync is consistent. Do not run a migration or a general database seed.

## Fetch FotMob

League id `47`. Do not hardcode the season stats id.

```
https://www.fotmob.com/api/data/leagues?id=47
```

Use `details.selectedSeason`, `table[0].data.table.all` (position, shortName, played, pts), and `stats.seasonStatLinks` for the matching season. Then fetch:

- `https://data.fotmob.com/{RelativePath-dir}/goals.json`
- `.../goal_assist.json`
- `.../clean_sheet_team.json`
- `.../rating.json`

Relative paths look like `stats/47/season/<id>/topstats.json`; swap the filename.

Paste standings with **canonical display names** from `src/data/teams.ts` (not FotMob shorts). `Nottm Forest` does not match `Nott'm Forest`.

```
Pos Club P Pts
1 Arsenal 1 3
…
20 Coventry City 1 0
```

## Coverage rules

`N` = `count(*)` from `predictions` for the active season. Every published list must use `coveredThroughRank = N`.

Use the following coverage rules:

| Dataset             | How to fill                                                                                                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `goals` / `assists` | Seed from submissions. Set FotMob leaders to their real totals. Keep seeded names at factual `0` if they have none. If distinct subjects `< N`, add other current FotMob top players (same match/stat list) until there are **exactly N rows**. Extra `0` rows that straddle rank N trip the boundary-tie warning. |
| `clean_sheets`      | Paste all 20 clubs. Only clubs with a FotMob clean sheet get `1+`; the rest are `0`.                                                                                                                                                                                                                               |
| `player_ratings`    | Paste every FotMob-rated player (high and low). Need at least `min(2N, season player count)` rows. Do **not** seed unplayed catalogue picks at `0` — that falsely ranks them as most overrated. Unplayed picks resolve as outside-range zero after publish.                                                        |

No Other-player aliases to match unless custom names exist.

Source = `FotMob`. Source reference = `https://www.fotmob.com/leagues/47/stats/premier-league`. Leave snapshots provisional.

## Drive the standings and spotlight admin desks

1. Start `npm run dev -- --port 3000` with `.env.local`.
2. Open a standalone Playwright session with `chromium.launch`, not `playwright.config.ts`. Sign in with `PLAYWRIGHT_ADMIN_PASSWORD` or `ADMIN_SECRET` and use `admin` unless `ADMIN_USERNAME` is set. Never log the secret.
3. On `/admin/standings`, paste the table, click **Parse**, and click **Save**. A duplicate-active response is acceptable.
4. On `/admin/results`, wait for **Publish gate ready**. Kickoff already reveals and closes the game, so do not use `LOCK`.
5. In each dataset card, set the source, seed when applicable, paste the data, click **Parse**, fix unmatched lines, click **Apply**, click **Review & publish**, attest, and click **Publish provisional**. Locate each `div.rounded-2xl.border.bg-surface` card by its **Top scorer**, **Top assister**, **Most clean sheets**, or **Player ratings** heading.
6. After each publish, wait for that card's success text or query `spotlight_result_states.active_snapshot_id`. Do not use `getByText("Provisional result published.")` globally because messages from earlier datasets produce false positives. If the save succeeds but the active snapshot is null, open **Review & publish** again.

## Update completed Win Streak results

Use reviewed completed-match facts from the offline source set. The FotMob league response at `https://www.fotmob.com/api/data/leagues?id=47` provides match context; the official Premier League pages in the fixture-check section remain the schedule authority.

For each completed contest matchweek:

1. On `/admin/win-streak`, select the completed matchweek. Do not enter Matchweek 1 because the contest starts in Matchweek 2.
2. Enter one reviewed outcome for each of the 10 fixtures: **Home win**, **Draw**, **Away win**, or **Void**.
3. Use **Void** only when the owner confirms that the Win Streak policy treats the fixture as void. A postponement, abandonment, or missing result is not automatically void.
4. Review all 10 fixture rows before you submit. If any fixture lacks a final reviewed outcome, stop without advancing the matchweek.
5. Submit through the authenticated admin route and wait for that matchweek's scoped success state. Never replace this workflow with a direct database write.

The all-10-fixture requirement keeps every participant on one shared round and makes opposite-team picks resolve from the same fact.

## Verify public results

Table: `/leaderboard` shows scored totals (not “scoring has not started”), 14 or fewer shared competition ranks, and 5/3/1 club breakdowns. All-zero-played tables stay inactive; one club with `played > 0` is enough.

Spotlight: `/spotlight` and `?sort=` for all seven categories. Accuracy is `max(0, N + 1 − outcome rank)`. Tied rank 1 earns N. Omitted subjects after a complete publish are outside-range zero and still count as available. Overall should read `7 of 7 results available`.

Spot-check at least one pick against FotMob (for example a rank-1 rating pick earns N; a 0-goal seeded scorer inside the N-row list occupies the first 0-goal rank).

Also confirm the public alias `https://pl-predictions-2026.vercel.app/leaderboard` if `.env.local` points at the live season DB.

Win Streak: open `/win-streak` without an owner session. Confirm that current and best streaks recalculate, equal best streaks share a competition rank, and the next active matchweek is correct. Verify every participant's public current pick or explicit no-pick state. Spot-check a win, a draw or loss, and any void against the reviewed inputs: a win adds one; a draw or loss resets the current streak but preserves the best; a void preserves the streak and does not consume the club.

If `.env.local` points at the live season database, also confirm `https://pl-predictions-2026.vercel.app/win-streak`. Keep this verification read-only.

## Final reply

Return only:

1. FotMob matchweek context (which matches are in the table)
2. N and what was filled beyond seeded subjects
3. Table top few scores
4. Spotlight overall leader and one check per category
5. Win Streak matchweek updated, all 10 outcomes, explicit voids, next active matchweek, leaderboard, and current-pick checks
6. Fixture check result and any bounded kickoff-only sync, including affected rounds, seed counts, merged SHA, and deployment; otherwise confirmation that no fixture release was needed
7. Confirmation: table and spotlight snapshots remain provisional; no finalize, LOCK, REVEAL, runtime football client, direct result write, schema migration, protected-round change, or unrelated release work

Then stop.

## Example

User: `$update-results`

Agent: checks the official Win Streak snapshot. With no drift, it performs no fixture release. With safe future kickoff-only drift, it publishes the bounded snapshot change and targeted seed; protected or ambiguous drift stops for owner review. It then reads the completed FotMob matchweek, updates the table and spotlight data, enters all 10 completed Win Streak outcomes through `/admin/win-streak`, and verifies `/leaderboard`, `/spotlight`, and `/win-streak`.
