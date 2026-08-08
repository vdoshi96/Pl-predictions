# Project

Dranx Prediction League is an unofficial prediction game for a private invited group covering the 2026/27 English Premier League. A participant orders exactly 20 clubs, enters one display name, reviews, and submits an immutable prediction. After reveal, the leaderboard compares every entry with one active actual-table snapshot and recalculates all scores from scratch.

Primary users are invited participants on mobile devices and one owner-administrator. The owner controls deadline, lock, reveal, erroneous-entry deletion, manual standings, import visibility, and final status.

The user-facing visual system uses the Premier League's official purple, `#37003c`, with cyan `#05f0ff`, green `#00ff87`, and pink `#ff2882` accents and an original Dranx mark. The official Premier League logo and FotMob crest downloads are not included. Third-party marks still require authorization, so the 20 local monograms remain; the shared `TeamMark` already supports transparent authorized crest files.

Constraints: one Next.js/Vercel application, Vercel-managed Neon, no end-user accounts, no runtime football API, no production scraper, no cron, no extra personal data, and compatibility with free/Hobby tiers. Operational repository, Vercel, database, and environment identifiers retain their existing `pl-predictions` names.
