---
name: update-results
description: >-
  Pulls current FotMob Premier League table and spotlight stats, then publishes
  them through the owner admin desk and checks table plus spotlight scoring.
  Use only when the user explicitly invokes $update-results to refresh live-season
  standings and spotlight categories.
---

# Update results (FotMob → admin)

Owner-run reviewed entry: fetch FotMob facts offline, paste them through `/admin/standings` and `/admin/results`, publish provisional snapshots, then verify scoring. Do not add FotMob to the deployed app.

## Hard stop

Do not:

- add a runtime football client, scraper, cron, or FotMob call to the Next.js app
- print `ADMIN_SECRET`, `ADMIN_PASSWORD_HASH`, `DATABASE_URL`, or any credential
- use `playwright.config.ts` / `npm run test:e2e` (those fail closed against the live DB)
- LOCK, REVEAL, or finalize snapshots unless the user asked
- seed unplayed players into `player_ratings` at rating `0`
- invent goals, assists, clean sheets, or ratings
- commit, push, migrate, seed, or deploy as part of this skill

Invoking `$update-results` authorizes live-season admin writes. Confirm the connected DB is the intended season database (prediction count, season slug) before mutating.

## Checklist

```
- [ ] Fetch FotMob table + goals, assists, team clean sheets, player ratings
- [ ] Read N (active brackets) and distinct seeded subjects per dataset
- [ ] Start local Next against .env.local; sign in without logging the password
- [ ] Paste and save the 20-club table
- [ ] Seed + fill each spotlight dataset through rank N; publish provisionally
- [ ] Confirm each dataset has active_snapshot_id; verify /leaderboard and /spotlight
```

## 1. Fetch FotMob

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

## 2. Coverage rules

`N` = `count(*)` from `predictions` for the active season. Every published list must use `coveredThroughRank = N`.

| Dataset             | How to fill                                                                                                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `goals` / `assists` | Seed from submissions. Set FotMob leaders to their real totals. Keep seeded names at factual `0` if they have none. If distinct subjects `< N`, add other current FotMob top players (same match/stat list) until there are **exactly N rows**. Extra `0` rows that straddle rank N trip the boundary-tie warning. |
| `clean_sheets`      | Paste all 20 clubs. Only clubs with a FotMob clean sheet get `1+`; the rest are `0`.                                                                                                                                                                                                                               |
| `player_ratings`    | Paste every FotMob-rated player (high and low). Need at least `min(2N, season player count)` rows. Do **not** seed unplayed catalogue picks at `0` — that falsely ranks them as most overrated. Unplayed picks resolve as outside-range zero after publish.                                                        |

No Other-player aliases to match unless custom names exist.

Source = `FotMob`. Source reference = `https://www.fotmob.com/leagues/47/stats/premier-league`. Leave snapshots provisional.

## 3. Drive the admin desk

1. `npm run dev -- --port 3000` with `.env.local`.
2. Standalone Playwright (`chromium.launch`), **not** the repo Playwright config. Login: `PLAYWRIGHT_ADMIN_PASSWORD` or `ADMIN_SECRET`, username `admin` unless `ADMIN_USERNAME` is set. Never log the secret.
3. `/admin/standings`: paste table → Parse → Save. Duplicate-active is OK.
4. `/admin/results`: wait for **Publish gate ready** (kickoff already reveals and closes; do not LOCK).
5. Per dataset card (`div.rounded-2xl.border.bg-surface` filtered by the heading **Top scorer** / **Top assister** / **Most clean sheets** / **Player ratings**): set source, seed if applicable, paste, Parse, fix unmatched lines, Apply, Review & publish, attest, Publish provisional.
6. After each publish, wait for **that card's** success text, or query `spotlight_result_states.active_snapshot_id`. Do not `getByText("Provisional result published.")` globally — leftover messages from earlier datasets are false positives. If save succeeded but active is still null, open Review & publish again.

## 4. Verify scoring

Table: `/leaderboard` shows scored totals (not “scoring has not started”), 14 or fewer shared competition ranks, and 5/3/1 club breakdowns. All-zero-played tables stay inactive; one club with `played > 0` is enough.

Spotlight: `/spotlight` and `?sort=` for all seven categories. Accuracy is `max(0, N + 1 − outcome rank)`. Tied rank 1 earns N. Omitted subjects after a complete publish are outside-range zero and still count as available. Overall should read `7 of 7 results available`.

Spot-check at least one pick against FotMob (for example a rank-1 rating pick earns N; a 0-goal seeded scorer inside the N-row list occupies the first 0-goal rank).

Also confirm the public alias `https://pl-predictions-2026.vercel.app/leaderboard` if `.env.local` points at the live season DB.

## 5. Final reply

Return only:

1. FotMob matchweek context (which matches are in the table)
2. N and what was filled beyond seeded subjects
3. Table top few scores
4. Spotlight overall leader and one check per category
5. Confirmation: provisional only; no finalize; no app/runtime FotMob client

Then stop.

## Example

User: `$update-results`

Agent: reads FotMob GW1 (Arsenal 3–0 Coventry), pastes the 20-club table, publishes four FotMob datasets through rank 14, filling goals/assists with extra top players from that match, pastes all 29 rated players, verifies `/leaderboard` and `/spotlight`, stops.
