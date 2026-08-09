# Sources

Checked on 2026-08-08.

## Product authority

- Original owner brief: `/Users/vishal/.codex/attachments/52a70e1f-75be-4dba-a2ab-739d8a99b417/pasted-text.txt` (local conversation attachment; intentionally not copied into the repository).
- Latest owner overrides: mobile-first for the majority-mobile audience; recurring updates will be owner-run Codex automation; no runtime live-data API and no Vercel Cron.
- Current spotlight-predictions brief: one three-stage immutable entry containing the 20-club table and seven required categories; searchable first/last-name player selectors with Other-player fallback; clubs for most clean sheets; local player portraits and club crests with visual fallbacks; expanded leaderboard; public rules page; and administrator deletion. The owner-supplied raw login password is operational secret input and is intentionally not copied into repository documentation.
- Current identity direction: user-facing name **Dranx Prediction League**; Premier-League-inspired palette using official purple `#37003c` with cyan `#05f0ff`, green `#00ff87`, and pink `#ff2882` accents; original Dranx mark; operational `pl-predictions` identifiers unchanged.
- Current club-asset direction: the project owner supplied a folder containing one transparent PNG badge for each of the 20 verified clubs and explicitly directed their use. The same folder's Premier League logo/lion/ball/composite files are outside that team-mark replacement and are not used.
- Current player-asset direction: the project owner added `premier-league-players-2026-08-08/` and explicitly directed use of its roster and available portraits in the selectors, with a silhouette when no portrait was supplied. Other player remains available for unavailable or newly added players.

## Owner-provided player snapshot source card

- Local handoff: `premier-league-players-2026-08-08/`; its `README.txt` records snapshot date 2026-08-08, 587 players across the application's 20 clubs, 580 supplied PNGs, and seven deliberately missing images.
- Handoff provenance: the local README identifies Transfermarkt 2026 first-team squad pages as the roster source, 570 FotMob-sourced images, and 10 Creative Commons Wikipedia images. For this repository, the operative provenance is the project owner's local handoff and direction to use it; this record does not claim broader ownership or redistribution permission.
- Application use: roster rows are imported into the season catalogue and reviewed portraits are copied to local `/player-faces/` paths. The seven players without a supplied portrait use `PlayerMark`'s generic silhouette.
- Runtime boundary: the deployed application does not execute the handoff's acquisition scripts, call those upstream sources, scrape player pages, or hotlink portraits. Other player covers unavailable or newly added players.
- Outcome boundary: this is a selector identity and portrait snapshot, not a goals, assists, clean-sheets, or player-rating result feed. The five non-table-derived outcomes remain pending a reviewed source-neutral input.

## Season and rights

- [Official Premier League 2026/27 table](https://www.premierleague.com/en/tables/premier-league/2026-27): authoritative 20-club membership and display-name check.
- [Premier League 2026/27 AGM announcement](https://www.premierleague.com/en/news/4673099/the-202627-premier-league-season-officially-starts/): membership-change corroboration.
- [Premier League opening-weekend schedule](https://www.premierleague.com/en/news/4675508/premier-league-fixture-schedulereleased-for-season-202627), checked 2026-08-08: the season kicks off with Arsenal v Coventry City at Emirates Stadium at 20:00 BST on Friday 21 August 2026, exactly `2026-08-21T19:00:00.000Z`.
- [Complete official 2026/27 fixture list](https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-202627-premier-league-season), checked 2026-08-08: Arsenal v Coventry is the sole Friday fixture before the other Matchweek 1 matches; the league explicitly states that all fixtures are subject to change.
- [Official fixture-change guidance](https://www.premierleague.com/en/news/4324634): scheduling can change for broadcast and competition conflicts, so the static UTC deadline must be reverified and reviewed if the opener moves.
- [FotMob Premier League page](https://www.fotmob.com/leagues/47/overview) and canonical team pages: one-time factual league/team identifier mapping only.
- [FotMob Terms of Use](https://www.fotmob.com/term-of-service), checked 2026-08-08: restriction on automatic crawlers and systematic or regular extraction. A consumer subscription is not treated as permission for automation or redistribution.
- [Premier League logo portal](https://logo.premierleague.com/), checked 2026-08-08: logo access and use are limited to directed commercial partners and genuine editorial news-media users; this private prediction tool is neither.
- [Premier League trademark and data FAQ](https://www.premierleague.com/en/about/faq/other): club names and badges remain member-club marks.

FotMob's official terms, the Premier League logo portal, and the Premier League trademark FAQ were checked on 2026-08-08. The production app never requests or hotlinks FotMob or another football-data source. The project owner's supplied 20-club PNG set and dated player snapshot are stored locally and used at the owner's direction; this repository does not claim original ownership of those assets or broader permission for unused league-brand files. The original Dranx mark remains the application identity, and the official Premier League logo is not included. A future standings or spotlight-outcome automation must use manual input, a permitted export, or a source whose written licence covers the intended collection and use.

## Spotlight outcome authority and pending inputs

- The owner defined occupied-rank judging for all seven categories and supplied the team expectation formulas. The brief did not define how those ranks convert into the existing additive points total; this implementation adopts a visible 20-to-1 scale, with rank 1 earning 20 and rank 20 earning 1, as the documented working rule pending any later owner adjustment.
- Team expectation data is internal: average each club's predicted position across the remaining valid submissions, then compare it with the active validated standings. Underdog is average prediction minus actual position; overrated is the inverse.
- The requested player-opinion metric is FotMob average season rating, descending for underdog and ascending for overrated. This product rule does not supersede FotMob's terms or authorize automated extraction. There is no runtime FotMob client, scraper, scheduled job, or stored provider credential.
- The owner has supplied the dated 587-player selector catalogue and 580 portrait PNGs, with seven intentional silhouette fallbacks. The handoff does not include reviewed top-scorer, assists, clean-sheets, or player-rating outcome rankings. Those five category results and custom-player reconciliation therefore remain pending. Do not infer, fabricate, or silently score missing result data from the roster snapshot.
- Any future spotlight outcome integration must be source-neutral at the application boundary and backed by permitted or licensed acquisition. The precise canonical payload, administrative review path, provenance fields, and final/provisional semantics remain an explicit design task rather than an implemented claim.

## Technical authority

Current official Next.js, React, Node.js/Vercel runtime, Tailwind CSS, dnd-kit, Neon, Drizzle, Vercel Marketplace/Git integration, Vercel Authentication, and GitHub documentation informed the pinned stack and deployment flow. Exact links, decisions, caveats, rejected alternatives, and failure behavior are recorded in `docs/RESEARCH.md`.

Implementation and current checked-out behavior remain authoritative when a historical note differs.
