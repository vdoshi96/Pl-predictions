# Research: PL Predictions

Checked on 2026-08-08. The latest user instruction supersedes the original brief where standings acquisition conflicts: the production application has no live football-data dependency and no Vercel Cron.

## Season and clubs

The official Premier League 2026/27 table and the league's 5 June AGM announcement confirm the 20-club field. Coventry City, Ipswich Town, and Hull City joined the league; Burnley, West Ham United, and Wolverhampton Wanderers are not members for 2026/27.

Decision: the database seed contains exactly the verified 20 clubs. Preferred display names follow official presentation, with `AFC Bournemouth` sorted under `Bournemouth` and `Brighton & Hove Albion` using an ampersand.

Sources:

- [Official 2026/27 Premier League table](https://www.premierleague.com/en/tables/premier-league/2026-27)
- [Premier League AGM membership announcement](https://www.premierleague.com/en/news/4673099/the-202627-premier-league-season-officially-starts/)

## FotMob data and rights

FotMob league ID `47` and the canonical team pages expose the factual external IDs used for import matching. Those identifiers are seeded once. The application stores only minimal snapshot facts: team ID, position, played, points, matchweek, capture time, and source URL.

FotMob's current terms, checked 2026-08-08, prohibit robots/crawlers and systematic or regular extraction. A consumer subscription is not evidence of a data redistribution or automation licence. The Premier League also says club names and badges remain member-club marks.

Decision: do not implement recurring FotMob scraping in the product. A future owner-run Codex workflow may submit a permitted/licensed export through the source-neutral importer. The app also supports manual standings. It stores no source HTML, browser cookies, or subscription credentials.

Crest decision: FotMob's image URLs identify the genuine marks but do not grant redistribution or hotlinking rights. Production starts with polished text monograms and documented attribution/rights status. Real local assets can replace them without schema or UI changes after the owner obtains permission. This is the documented temporary source limitation allowed by the brief.

Sources:

- [FotMob Premier League page](https://www.fotmob.com/leagues/47/overview)
- [FotMob 2026/27 table evidence](https://www.fotmob.com/teams/8669/table/coventry-city)
- [FotMob Terms of Use](https://www.fotmob.com/term-of-service)
- [Premier League trademark and data FAQ](https://www.premierleague.com/en/about/faq/other)

## Framework and UI

Decision: pin Next.js `16.3.0`, React/React DOM `19.2.8`, Node `24.x`, Tailwind `4.3.3`, and use the App Router with Node runtime. Next 16 uses the async request APIs and no longer provides `next lint`; ESLint runs directly.

Decision: use the maintained dnd-kit rewrite (`@dnd-kit/react` and `@dnd-kit/helpers` `0.5.0`). Its current sortable primitive supports pointer and keyboard interaction. The UI uses a semantic handle button and applies `touch-action: none` only to that handle so mobile scrolling remains usable.

Sources:

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js current package metadata](https://registry.npmjs.org/next/latest)
- [React versions](https://react.dev/versions)
- [Node release schedule](https://nodejs.org/en/about/previous-releases)
- [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Tailwind CSS Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
- [dnd-kit React quickstart](https://dndkit.com/react/quickstart/)
- [dnd-kit sortable hook](https://dndkit.com/react/hooks/use-sortable/)
- [dnd-kit sensors](https://dndkit.com/react/guides/sensors/)

## Database and deployment

Vercel Postgres is discontinued for new databases. Neon is provisioned through Vercel Marketplace and injects a pooled `DATABASE_URL`. The project uses `@neondatabase/serverless` `1.1.0`, Drizzle ORM `0.45.2`, and committed Drizzle Kit `0.31.10` migrations.

Decision: use `drizzle-orm/neon-http`. Prediction creation is one guarded PostgreSQL common-table-expression statement, so database-time fairness checks, the parent, and all 20 items succeed together. Snapshot creation uses an atomic Drizzle batch with pre-generated UUIDs. Both patterns match short serverless requests, and the database schema duplicates application invariants with unique and check constraints.

The Vercel project `vdoshi96s-projects/pl-predictions` and its Neon resource `neon-coffee-queen` were provisioned before scaffolding. No Vercel Cron is configured because the owner explicitly chose Codex-driven updates and no runtime data API.

Sources:

- [Vercel Postgres transition](https://vercel.com/docs/postgres)
- [Vercel Neon Marketplace integration](https://vercel.com/marketplace/neon)
- [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver)
- [Drizzle Neon guide](https://orm.drizzle.team/docs/connect-neon)
- [Drizzle batch API](https://orm.drizzle.team/docs/batch-api)
- [Vercel GitHub integration](https://vercel.com/docs/git/vercel-for-github)
- [Vercel Authentication deployment protection](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication)

## Rejected alternatives

- `football-data.org` and its token: superseded by the no-live-API instruction.
- Runtime FotMob scraping: conflicts with current published terms and makes the site brittle.
- Vercel Cron: unnecessary for the selected owner-run automation model.
- `@vercel/postgres`: obsolete for new Vercel databases.
- Legacy dnd-kit packages and recipes: superseded by the maintained React package.
- Supabase, Firebase, external auth, and Redis: unnecessary and explicitly out of scope.

## Failure behavior

Malformed, stale, duplicate, unauthorized, or incomplete imports never replace the last active snapshot. All-zero preseason tables remain unscored. If no valid active standings exist, the leaderboard still shows submission count and a clear scoring-not-started state. Manual admin entry remains available even when the external source is inaccessible.
