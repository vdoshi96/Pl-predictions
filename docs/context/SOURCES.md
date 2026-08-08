# Sources

Checked on 2026-08-08.

## Product authority

- Original owner brief: `/Users/vishal/.codex/attachments/52a70e1f-75be-4dba-a2ab-739d8a99b417/pasted-text.txt` (local conversation attachment; intentionally not copied into the repository).
- Latest owner overrides: mobile-first for the majority-mobile audience; recurring updates will be owner-run Codex automation; no runtime live-data API and no Vercel Cron.
- Current identity direction: user-facing name **Dranx Prediction League**; Premier-League-inspired palette using official purple `#37003c` with cyan `#05f0ff`, green `#00ff87`, and pink `#ff2882` accents; original Dranx mark; operational `pl-predictions` identifiers unchanged.

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

FotMob's official terms, the Premier League logo portal, and the Premier League trademark FAQ were checked on 2026-08-08. FotMob crest downloads and the official Premier League logo were not added because repository policy and those current official terms require appropriate authorization before copying or redistributing the marks. The production app never requests FotMob or another football-data source, and the 20 local text monograms remain. `TeamMark` supports transparent local crest assets that may replace them after authorization. A future standings automation must use manual input, a permitted export, or a source whose written licence covers the intended collection and use.

## Technical authority

Current official Next.js, React, Node.js/Vercel runtime, Tailwind CSS, dnd-kit, Neon, Drizzle, Vercel Marketplace/Git integration, Vercel Authentication, and GitHub documentation informed the pinned stack and deployment flow. Exact links, decisions, caveats, rejected alternatives, and failure behavior are recorded in `docs/RESEARCH.md`.

Implementation and current checked-out behavior remain authoritative when a historical note differs.
