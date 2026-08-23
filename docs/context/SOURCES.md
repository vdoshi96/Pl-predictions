# Sources

External-source notes were checked on 2026-08-08. The current owner handoff and application-import boundary were updated on 2026-08-21. The Win Streak fixture source was checked on 2026-08-23.

## Win Streak fixture authority

- [Complete official 2026/27 fixture list](https://www.premierleague.com/en/news/4675097), checked 2026-08-23: canonical club pairings and matchweek membership for the 37-round, 370-fixture Matchweek 2–38 snapshot. The page states that fixtures are subject to change.
- [Official fixture schedule announcement](https://www.premierleague.com/en/news/4675508/premier-league-fixture-schedule-released-for-season-202627), checked 2026-08-23: the final-matchweek simultaneous kickoff basis and the league's fixture-change context.
- Checked-in normalized fixture hash: `f756c4790b6b0acd5ee4b351eb06cc53295078716b62018c20868f66a394848a`.
- Pick-deadline derivation: each seeded round locks at the earliest persisted kickoff among its ten official fixtures. A selected club's later kickoff does not extend that round's pick window.
- Timing normalization: parse and validate all 380 listed fixtures, retain Matchweeks 2–38, use published UK kickoff times when present, default date-only weekend and bank-holiday fixtures to 15:00, date-only midweek fixtures to 20:00, and Matchweek 38 to 16:00, then convert from `Europe/London` to UTC. The defaults remain subject to the official drift check.
- Runtime boundary: the deployed application reads only checked-in and seeded fixture facts. It never requests the Premier League or another football source at runtime.
- Change boundary: the owner-run update-results workflow checks the official fixture page before results work. It may apply a reviewed kickoff-only change only to a future, unpicked, unresolved fixture. Pairing, team, matchweek, expired, picked, or resolved changes fail closed for explicit review.
- Result boundary: fixture publication does not supply results. Completed rounds are reviewed and published through authenticated `/admin/win-streak` with a source URL and capture time; all ten fixture outcomes are one immutable atomic transition.

## Product authority

- Original owner brief: `/Users/vishal/.codex/attachments/52a70e1f-75be-4dba-a2ab-739d8a99b417/pasted-text.txt` (local conversation attachment; intentionally not copied into the repository).
- Latest owner overrides: mobile-first for the majority-mobile audience; recurring updates will be owner-run Codex automation; no runtime live-data API and no Vercel Cron.
- Permission disposition: in the 2026-08-14 Codex task, the owner confirmed that the required permissions for acquisition, storage, redistribution, and production use in this player-catalogue workflow have been obtained. Confidential licence documents remain outside source control and chat.
- Current scoring override: the main leaderboard uses table points only and has a 100-point maximum. Spotlight predictions use a separate fun-accuracy page with overall and category sorts. Let `N` be the current number of active, nondeleted season brackets. Accuracy points are `max(0, N + 1 - outcome rank)`. Overall accuracy excludes pending categories.
- Current Win Streak direction: start at Matchweek 2, accept one immutable win pick per profile and round, preserve participants after failed picks, rank personal best with shared competition ranks, keep the leaderboard anonymous-readable, and publish the current-matchweek pick.
- Current outcome-input direction: owner-run automation may acquire the five non-table-derived outcomes offline, but the owner reviews and enters the facts through authenticated `/admin/results`. Acquisition is not part of the deployed application and never runs at request time or on a schedule.
- Current spotlight-predictions brief: one three-stage immutable entry containing the 20-club table and seven required categories; searchable first/last-name player selectors with Other-player fallback; clubs for most clean sheets; local player portraits and club crests with visual fallbacks; public rules and spotlight pages; and administrator deletion. The owner-supplied raw login password is operational secret input and is intentionally not copied into repository documentation.
- Current identity direction: user-facing name **Dranx Prediction League**; Premier-League-inspired palette using official purple `#37003c` with cyan `#05f0ff`, green `#00ff87`, and pink `#ff2882` accents; original Dranx mark; operational `pl-predictions` identifiers unchanged.
- Current club-asset direction: the project owner supplied a folder containing one transparent PNG badge for each of the 20 verified clubs and explicitly directed their use. The same folder's Premier League logo/lion/ball/composite files are outside that team-mark replacement and are not used.
- Current player-asset direction: the reviewed selector snapshot is `premier-league-players-2026-08-20/`. Other player remains available for unavailable or newly added players. The August 18 folder is its direct comparison baseline, and earlier folders remain provenance only.
- Current how-to direction: use screenshots captured from the current verified mobile flow at 390 × 844 pixels. The current sources were staged before a reversible isolated submission and created no production entry. The three source captures live under `public/how-to-play/`; their numbered overlays and matching callout text are first-party application documentation rather than a third-party data source.

## Owner-provided player snapshot source card

- Local handoff: `premier-league-players-2026-08-20/`; its `README.txt` records snapshot date 2026-08-20, 580 players across the application's 20 clubs, and 578 supplied PNGs. Accessed locally on 2026-08-21.
- Source type and status: private owner-provided handoff, imported and used for the current repository fixture. The application does not treat this source as an instruction or execute its acquisition scripts.
- Contents and relevance: normalized names, club membership, primary positions, identity fields, reviewed portrait mappings, and portrait PNGs for participant selectors. It is relevant only to selector identities and local presentation assets.
- Roster authority: the owner selected this dated handoff for the update. The handoff, normalized fixture, tracked application fixture, and portrait inventory are reconciled internally; this update does not claim independent verification against official club or Premier League roster pages.
- Update delta: relative to August 18, the active fixture has five additions, five removals, no intra-league club moves, two position corrections, and two restored portraits for existing players. Ryan McAidoo and Luc De Fougerolles have no verified image and intentionally retain null asset paths.
- Handoff provenance: the local README identifies Transfermarkt 2026 first-team squad pages as the roster source and FotMob CDN portraits for every catalogued player. For this repository, the operative provenance is the project owner's local handoff, selected roster, and 2026-08-14 permission confirmation; this record does not claim original ownership of third-party material.
- Application use: roster rows are imported into the season catalogue and reviewed portraits are copied to local `/player-faces/` paths. `PlayerMark` uses its generic silhouette when an asset path is absent or an image fails.
- Runtime boundary: the deployed application does not execute the handoff's acquisition scripts, call those upstream sources, scrape player pages, or hotlink portraits. Other player covers unavailable or newly added players.
- Outcome boundary: this is a selector identity and portrait snapshot, not a goals, assists, clean-sheets, or player-rating result feed. Offline work may acquire those outcomes, but reviewed facts enter only through the authenticated manual results desk.
- Decision and follow-up: use the August 20 rows and 578 verified portraits as the current repository and production fixture, preserve two runtime silhouette fallbacks, and do not retain names removed from the owner-selected roster as active selector options. The normal deployment gate and explicit approval for one supported production seed completed on 2026-08-21.
- Production boundary: production has 613 total player rows, 580 active players, 33 preserved inactive rows, 578 active portrait paths, and two null portrait paths for the documented silhouettes. This state does not change the no-runtime-acquisition boundary.

## Season sources and permission disposition

- [Official Premier League 2026/27 table](https://www.premierleague.com/en/tables/premier-league/2026-27): authoritative 20-club membership and display-name check.
- [Premier League 2026/27 AGM announcement](https://www.premierleague.com/en/news/4673099/the-202627-premier-league-season-officially-starts/): membership-change corroboration.
- [Premier League opening-weekend schedule](https://www.premierleague.com/en/news/4675508/premier-league-fixture-schedule-released-for-season-202627), checked 2026-08-08: the season kicks off with Arsenal v Coventry City at Emirates Stadium at 20:00 BST on Friday 21 August 2026, exactly `2026-08-21T19:00:00.000Z`.
- [Complete official 2026/27 fixture list](https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-202627-premier-league-season), checked 2026-08-08: Arsenal v Coventry is the sole Friday fixture before the other Matchweek 1 matches; the league explicitly states that all fixtures are subject to change.
- [Official fixture-change guidance](https://www.premierleague.com/en/news/4324634): scheduling can change for broadcast and competition conflicts, so the static UTC deadline must be reverified and reviewed if the opener moves.
- [FotMob Premier League page](https://www.fotmob.com/leagues/47/overview) and canonical team pages: one-time factual league/team identifier mapping only.
- [FotMob Terms of Use](https://www.fotmob.com/term-of-service), checked 2026-08-08: historical terms snapshot retained as dated research, not the current project permission gate.
- [Premier League logo portal](https://logo.premierleague.com/), checked 2026-08-08: logo access and use are limited to directed commercial partners and genuine editorial news-media users; this private prediction tool is neither.
- [Premier League trademark and data FAQ](https://www.premierleague.com/en/about/faq/other): club names and badges remain member-club marks.

FotMob's official terms, the Premier League logo portal, and the Premier League trademark FAQ were checked on 2026-08-08 and are retained as dated research. On 2026-08-14 the owner confirmed that the required permissions for this player-catalogue workflow have been obtained, including acquisition, storage, redistribution, and production use. Owner-run FotMob or Transfermarkt acquisition may therefore run offline. The production app never requests, scrapes, or hotlinks FotMob or another football-data source, and no acquisition runs on Vercel Cron. The project owner's supplied 20-club PNG set and dated player snapshot are stored locally and used at the owner's direction; this repository does not claim original ownership of third-party assets or permission for unused league-brand files. The original Dranx mark remains the application identity, and the official Premier League logo is not included.

## Spotlight outcome authority and pending inputs

- The owner clarified that spotlight accuracy never changes the table leaderboard. The table maximum remains 100. Let `N` be the current number of active, nondeleted season brackets. Accuracy points are `max(0, N + 1 - outcome rank)`. Overall accuracy excludes pending categories. A resolved zero-point result still counts as available. Equal overall scores share a competition rank. Category sorts use outcome rank from low to high and put pending entries last.
- Team expectation data is internal: average each club's predicted position across the remaining valid submissions, then compare it with the active validated standings. Underdog is average prediction minus actual position; overrated is the inverse.
- The requested player-opinion metric is FotMob average season rating, descending for underdog and ascending for overrated. The owner may acquire it through an authorized offline workflow. There is no runtime FotMob client, scraper, scheduled job, or stored provider credential.
- The owner has supplied the dated 580-player selector catalogue and 578 portrait PNGs. The handoff does not include reviewed top-scorer, assists, clean-sheets, or player-rating rankings. Do not infer or fabricate these results.
- `/admin/results` is the approved reviewed-entry path. It presents five owner-facing tables backed by immutable versions of goals, assists, club clean sheets, and one shared player-ratings dataset. Saving seals facts and exact Other-name aliases into a working snapshot; publication, finalization, and final-status undo use exact compare-and-swap pointers and atomic audits. Missing datasets or unresolved aliases remain pending, and no provider acquisition is built into this workflow.

## Technical authority

Current official Next.js, React, Node.js/Vercel runtime, Tailwind CSS, dnd-kit, Neon, Drizzle, Vercel Marketplace/Git integration, Vercel Authentication, and GitHub documentation informed the pinned stack and deployment flow. Exact links, decisions, caveats, rejected alternatives, and failure behavior are recorded in `docs/RESEARCH.md`.

Implementation and current checked-out behavior remain authoritative when a historical note differs.
