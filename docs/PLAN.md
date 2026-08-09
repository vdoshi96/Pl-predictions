# Implementation plan

1. Provision and link Vercel plus Neon, verify current sources, and record decisions.
2. Bootstrap project memory, scaffold the strict Next.js application, and add deterministic documentation parity.
3. Create the Drizzle schema, committed migration, idempotent 2026/27 seed, and source-neutral standings importer.
4. Implement the accessible prediction sorter, review, atomic submission, receipt confirmation, deadline, and reveal rules.
5. Implement derived leaderboard scoring, comparison pages, admin session/settings/submissions/manual standings/final controls, and import history.
6. Add security headers, server validation, same-origin checks, honeypot, safe errors, and focused audit logging.
7. Run format, lint, type, unit, integration, build, Playwright, dependency audit, responsive visual inspection, and production smoke tests.
8. Generate current documentation HTML and QA evidence, create the private GitHub repository, merge the feature branch to `main`, deploy production, and leave local/remote state synchronized.

Core implementation work proceeds autonomously. The only accepted blockers are an external consent/login step or missing project-owner direction for additional third-party artwork; the existing owner-provided club set uses the documented initials fallback if a local image fails.

## Completed branding iteration

1. Replace user-facing “PL Predictions” and “Friends League” language with **Dranx Prediction League** while retaining operational `pl-predictions` identifiers.
2. Apply a Premier-League-inspired palette using official purple `#37003c` with cyan `#05f0ff`, green `#00ff87`, and pink `#ff2882` accents, and use an original Dranx mark instead of the official Premier League logo.
3. Use the exact 20 transparent club badge PNGs supplied and directed by the project owner, keep the original Dranx identity, exclude the supplied Premier League logo/lion/ball extras, and retain the monograms only as rollback-safe first-release files.
4. Update affected tests, then run formatting, lint, type, unit/component, isolated integration, production build, and desktop/mobile browser verification.
5. Refresh only the newest QA evidence, regenerate and check all HTML peers, verify production, publish through GitHub `main`, synchronize local `main`, and remove completed worktree state.

## Current spotlight-predictions iteration

1. Extend the mobile entry journey to three stages: the 20-club table and display name, seven required spotlight selectors, then one final review and confirmation.
2. Import the owner-provided `premier-league-players-2026-08-08/` snapshot into the season-scoped player catalogue: 587 players across the 20 clubs and 580 copied local portrait PNGs. Search first, last, or full names, use the `PlayerMark` silhouette for the seven players without a supplied image, and retain Other player plus a required custom-name field for unavailable or newly added players. Continue using existing local club crests for the three club categories.
3. Validate exactly one top scorer, top assister, most clean sheets, underdog team, overrated team, underdog player, and overrated player choice. Persist the prediction parent, 20 ordered table items, and seven category rows in the existing deadline-guarded atomic statement.
4. Derive the 5–3–1 table score on read and cap the main leaderboard at 100. Treat the position-1 champion as part of table scoring, not a separate bonus. Keep spotlight accuracy separate from table points.
5. Calculate underdog-team index as average predicted position minus actual position and overrated-team index as the inverse, ranking the largest values first with full precision. Rank top scorer, top assister, and most clean sheets by their reviewed result-list positions; rank reviewed average season player ratings descending for underdog and ascending for overrated.
6. Keep the five non-table-derived outcomes pending until a future owner-run Codex automation enters the reviewed results manually. Treat the roster snapshot as selector and portrait input only. Do not add runtime FotMob access, a production scraper, or cron. Reconcile custom player names before ranking them.
7. Preserve pre-reveal privacy for prediction IDs, positions 2–20, and all seven spotlight picks. Add `/rules` and a separate `/spotlight` accuracy page. Let `N` be the current number of active, nondeleted season brackets. Use `max(0, N + 1 - outcome rank)` for resolved categories. Exclude pending categories from overall accuracy. Show a labelled in-memory test run that cannot affect stored submissions or rankings.
8. Move owner login to username plus salted PBKDF2-SHA-256 configuration while retaining `ADMIN_SECRET` only as a migration fallback. Keep same-origin/session protections, and verify an administrator deletion cascades through all 20 table items and seven spotlight rows while retaining its bounded audit record.
9. Run focused and full unit/component tests, isolated Neon integration, TypeScript, ESLint, formatting, production build, three-stage desktop/mobile browser checks, documentation parity, and bounded production smoke. Refresh only the newest QA evidence after the verification result is known, then complete the repository merge/deploy/cleanup rules.
