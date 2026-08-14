# Research: Dranx Prediction League

External sources were checked on 2026-08-08. The owner supplied the current permission disposition on 2026-08-14. The latest user instruction supersedes the original brief where standings acquisition conflicts: the production application has no live football-data dependency and no Vercel Cron.

## Season and clubs

The official Premier League 2026/27 table and the league's 5 June AGM announcement confirm the 20-club field. Coventry City, Ipswich Town, and Hull City joined the league; Burnley, West Ham United, and Wolverhampton Wanderers are not members for 2026/27.

Decision: the database seed contains exactly the verified 20 clubs. Preferred display names follow official presentation, with `AFC Bournemouth` sorted under `Bournemouth` and `Brighton & Hove Albion` using an ampersand.

Sources:

- [Official 2026/27 Premier League table](https://www.premierleague.com/en/tables/premier-league/2026-27)
- [Premier League AGM membership announcement](https://www.premierleague.com/en/news/4673099/the-202627-premier-league-season-officially-starts/)

## Brand identity and third-party marks

The user-facing name is **Dranx Prediction League**. The visual direction is Premier-League-inspired rather than an imitation: it uses the league's official purple, `#37003c`, with cyan `#05f0ff`, green `#00ff87`, and pink `#ff2882` accents and an original Dranx mark. Existing repository, deployment, database, URL, and environment identifiers retain their operational `pl-predictions` names.

The official Premier League logo was not added. The Premier League trademark FAQ states that club names and badges remain member-club marks. The project owner later supplied one transparent local PNG badge per verified club and explicitly directed use of that exact set. This repository records that owner direction without claiming original ownership, affiliation, or broader permission for the unused league logo/lion/ball files. An original Dranx mark keeps the product identity distinct while retaining the requested color reference.

## FotMob data, dated research, and current permission

FotMob league ID `47` and the canonical team pages expose the factual external IDs used for import matching. Those identifiers are seeded once. The application stores only minimal snapshot facts: team ID, position, played, points, matchweek, capture time, and source URL.

The terms review completed on 2026-08-08 recorded restrictions on robots/crawlers and systematic or regular extraction. That paragraph is retained as dated research rather than the current project permission gate. The Premier League separately says club names and badges remain member-club marks.

Current disposition: on 2026-08-14 the owner confirmed that the required permissions for this player-catalogue workflow have been obtained, including acquisition, storage, redistribution, and production use. Owner-run FotMob or Transfermarkt acquisition may run offline and produce a reviewed local snapshot or result payload. Confidential licence documents remain outside source control and chat.

Decision: do not implement source acquisition in the deployed product. The existing source-neutral importer remains limited to standings, and the app also supports manual standings. The app stores no source HTML, browser cookies, or subscription credentials and performs no runtime source request, scrape, image hotlink, football API call, or scheduled acquisition.

Historical crest finding: under the 2026-08-08 terms-only review, FotMob image URLs identified the genuine marks but were not treated as redistribution or hotlinking permission. The project owner's later 20-file PNG handoff superseded the presentation portion of the original monogram decision for this exact local set. `TeamMark` uses contain sizing and a safe initials fallback; original SVG monograms remain rollback-only during the first PNG release. The deployed application still does not fetch or hotlink them.

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
- [Vercel framework preset](https://vercel.com/docs/builds/configure-a-build#framework-preset)
- [Vercel deployment protection scopes](https://vercel.com/docs/deployment-protection)
- [Vercel Authentication deployment protection](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication)

## Rejected alternatives

- `football-data.org` and its token: superseded by the no-live-API instruction.
- Runtime FotMob acquisition: violates the selected offline-review architecture and makes the site brittle.
- Unapproved crest downloads and the official Premier League logo: outside the owner-selected local asset sets and project identity.
- Vercel Cron: unnecessary for the selected owner-run automation model.
- `@vercel/postgres`: obsolete for new Vercel databases.
- Legacy dnd-kit packages and recipes: superseded by the maintained React package.
- Supabase, Firebase, external auth, and Redis: unnecessary and explicitly out of scope.

## Failure behavior

Malformed, stale, duplicate, unauthorized, or incomplete imports never replace the last active snapshot. All-zero preseason tables remain unscored. If no valid active standings exist, the leaderboard still shows submission count and a clear scoring-not-started state. Manual admin entry remains available even when the external source is inaccessible.
