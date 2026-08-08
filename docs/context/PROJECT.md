# Project

Dranx Prediction League is an unofficial prediction game for a private invited group covering the 2026/27 English Premier League. A participant orders exactly 20 clubs, enters one display name, reviews, and submits an immutable prediction. Before the opener, the leaderboard exposes only each participant's predicted champion and a 0-point total. After kickoff, it compares every revealed entry with one active actual-table snapshot, recalculates all scores from scratch, and shows the champion pick's current actual position.

Primary users are invited participants on mobile devices and one owner-administrator. Arsenal v Coventry City's verified `2026-08-21T19:00:00.000Z` opening kickoff is the persisted, non-extendable submission ceiling for the 2026/27 season. The owner can close earlier, manually lock, reveal early, delete erroneous entries, manage standings/import visibility, and confirm or undo final status.

The user-facing visual system uses the Premier League's official purple, `#37003c`, with cyan `#05f0ff`, green `#00ff87`, and pink `#ff2882` accents and an original Dranx mark. The official Premier League logo is not included. The project owner supplied and directed use of 20 transparent local PNG club badges; `TeamMark` displays them with contain sizing and an accessible initials fallback, while the original monograms remain rollback-only for the first PNG release.

Constraints: one Next.js/Vercel application, Vercel-managed Neon, no end-user accounts, no runtime football API, no production scraper, no cron, no extra personal data, and compatibility with free/Hobby tiers. Operational repository, Vercel, database, and environment identifiers retain their existing `pl-predictions` names.
