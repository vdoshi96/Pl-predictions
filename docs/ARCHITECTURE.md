# Architecture

## Runtime flow

```text
permitted source/export or manual admin order
                  |
                  v
        canonical standings payload
                  |
                  v
authenticated import route or local import script
                  |
      Zod + known-team/permutation checks
                  |
                  v
      atomic Neon snapshot activation
                  |
                  v
 dynamic Next.js server reads and derived scoring
```

The deployed application never calls FotMob or another football source. Importing is a write-only operational boundary; public pages only query Neon.

## Routes

- `/` — prediction form or locked state.
- `/leaderboard` — pre-reveal roster or scored table.
- `/entries/[id]` — owner receipt before reveal; public comparison afterward.
- `/admin/login` — owner credential handoff.
- `/admin` — status overview.
- `/admin/submissions` — view and delete erroneous entries.
- `/admin/settings` — deadline, lock, and early reveal.
- `/admin/standings` — manual ordering, history, final confirmation/undo.
- `/api/automation/standings` — bearer-authenticated canonical import.
- `/api/health` — shallow non-secret health response.

## Trust boundaries

- The browser sends team UUID order only. Names, positions, and marks are resolved against database teams on the server.
- Public submission writes require a valid 20-team permutation, an accepted deadline state, a honeypot pass, and database uniqueness.
- An owner receipt uses a random token stored only as a hash; the HttpOnly receipt cookie authorizes private confirmation before reveal.
- Admin login compares credentials in constant time and issues a short signed HttpOnly SameSite cookie. Every admin mutation rechecks session and origin.
- Automation imports require `STANDINGS_INGEST_SECRET`, a complete known-team permutation, a monotonic capture time, and a new canonical content hash.

## Data invariants

Predictions and their 20 items are written atomically. A unique normalized name per season handles races. Every prediction and snapshot has unique team and position constraints. Standings activation preserves the last good snapshot on every failure. Scores are computed on read from the active snapshot and are never accumulated or independently editable.

## Scoring

Each club receives exactly one tier: 5 for exact, otherwise 3 within three places, otherwise 1 for the same half, otherwise 0. The leaderboard derives category counts and uses shared competition ranking with deterministic alphabetical ordering inside tied score groups.

## Caching and freshness

Public data pages are dynamic and do not cache database results across requests. Static monogram assets may be cached immutably. Snapshot pages show capture time, source, matchweek when present, and provisional/final status.
