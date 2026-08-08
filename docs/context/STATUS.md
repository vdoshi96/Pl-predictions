# Status

- Current phase: implementation and production deployment complete; anonymous production smoke/screenshots await one explicit Vercel protection approval, while GitHub publication closeout is in progress.
- Product: mobile-first prediction, private receipt, leaderboard/comparison, owner settings/submission deletion, manual standings, authenticated source-neutral imports, and explicit final-table controls implemented.
- Vercel: project `vdoshi96s-projects/pl-predictions`; production alias [https://pl-predictions-2026.vercel.app](https://pl-predictions-2026.vercel.app).
- Latest deployment evidence: preview `dpl_e7yEgPhrJBR17qnoQk3EAwdXjFmQ` and production `dpl_CGDPYcKNhq6EJb8AUReEVC8odRDF` are Ready after Vercel's default Turbopack build; the stable production alias points to the latter.
- Access blocker: Vercel Authentication still protects all `vercel.app` deployments. Changing it to preview-only would make production public while retaining preview SSO, but that persistent security-boundary change requires explicit owner approval.
- Database: Vercel Marketplace Neon resource `neon-coffee-queen`; migrations `0000` and `0001` applied to production, idempotent seed rerun, and exactly 20 verified 2026/27 clubs present. Automated DB/browser suites use isolated database `pl_predictions_test` through a fail-closed wrapper.
- Standings: no runtime football API, scraper, or Vercel Cron. Manual admin entry and the bearer-authenticated canonical importer preserve the last good snapshot. FotMob automation remains prohibited absent written permission.
- Finalization: all 20 clubs must show 38 played games; finalization and undo each compare-and-swap the exact active/final snapshot. Imports use a monotonic accepted-through watermark so duplicate observations cannot permit a later standings regression.
- Assets: local text monograms are the launch fallback because official crest redistribution rights are not cleared.
- Verification: 95 default tests passed with 9 opt-in database skips; all 9 isolated Neon integration tests passed; the Webpack production build passed; 5 focused browser journeys passed with 20 intentional routing skips across desktop, 320/390/430-pixel Chromium, and iPhone WebKit; production dependencies audit at 0 vulnerabilities.
- Dependency note: the full audit reports 4 moderate development-only legacy `esbuild` paths through `drizzle-kit`, with no high or critical findings. The breaking force-downgrade suggestion was not applied.
- Git: work is on `agent/build-pl-predictions`; public owner-supplied repository [vdoshi96/Pl-predictions](https://github.com/vdoshi96/Pl-predictions) is configured as `origin`, and push/merge/local-main synchronization are the next publication step.
- Documentation: canonical Markdown records current evidence and the protection blocker; deterministic same-content HTML peers are generated and checked.
- Remaining closeout: publish and merge GitHub, obtain the one explicit Vercel protection approval, run the anonymous read-only and bounded exact-ID write smokes, confirm cleanup/console health, retain newest annotated screenshots, then refresh documentation evidence.
