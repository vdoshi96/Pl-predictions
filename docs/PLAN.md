# Implementation plan

1. Provision and link Vercel plus Neon, verify current sources, and record decisions.
2. Bootstrap project memory, scaffold the strict Next.js application, and add deterministic documentation parity.
3. Create the Drizzle schema, committed migration, idempotent 2026/27 seed, and source-neutral standings importer.
4. Implement the accessible prediction sorter, review, atomic submission, receipt confirmation, deadline, and reveal rules.
5. Implement derived leaderboard scoring, comparison pages, admin session/settings/submissions/manual standings/final controls, and import history.
6. Add security headers, server validation, same-origin checks, honeypot, safe errors, and focused audit logging.
7. Run format, lint, type, unit, integration, build, Playwright, dependency audit, responsive visual inspection, and production smoke tests.
8. Generate current documentation HTML and QA evidence, create the private GitHub repository, merge the feature branch to `main`, deploy production, and leave local/remote state synchronized.

Core implementation work proceeds autonomously. The only accepted blockers are an external consent/login step or missing legal permission for third-party crest redistribution; the latter uses the documented monogram fallback.
