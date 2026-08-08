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

## Current branding iteration

1. Replace user-facing “PL Predictions” and “Friends League” language with **Dranx Prediction League** while retaining operational `pl-predictions` identifiers.
2. Apply a Premier-League-inspired palette using official purple `#37003c` with cyan `#05f0ff`, green `#00ff87`, and pink `#ff2882` accents, and use an original Dranx mark instead of the official Premier League logo.
3. Use the exact 20 transparent club badge PNGs supplied and directed by the project owner, keep the original Dranx identity, exclude the supplied Premier League logo/lion/ball extras, and retain the monograms only as rollback-safe first-release files.
4. Update affected tests, then run formatting, lint, type, unit/component, isolated integration, production build, and desktop/mobile browser verification.
5. Refresh only the newest QA evidence, regenerate and check all HTML peers, verify production, publish through GitHub `main`, synchronize local `main`, and remove completed worktree state.
