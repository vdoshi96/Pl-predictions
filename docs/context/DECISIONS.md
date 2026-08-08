# Decisions

## 2026-08-08: Static operational data boundary

The deployed application has no live football API and no scheduled scraper. A source-neutral canonical importer plus manual admin editor write validated snapshots. This implements the owner's automation preference while isolating source access and preserving the last good snapshot.

## 2026-08-08: Vercel-managed Neon and Drizzle

Use Vercel Marketplace Neon with pooled `DATABASE_URL`, Neon HTTP, Drizzle ORM, committed migrations, and atomic batches with pre-generated identifiers. This is current, serverless-friendly, and avoids obsolete Vercel Postgres packages.

## 2026-08-08: Accessible maintained dnd-kit

Use the current `@dnd-kit/react` sortable API. Pointer and keyboard behavior are first-class; touch-action is limited to the handle to preserve mobile scroll.

## 2026-08-08: Monograms until crest rights are cleared

FotMob image locations and a consumer subscription do not provide redistribution permission. Ship crisp club monograms with real names and documented source status; preserve a local asset field so permitted real marks can replace them later.

## 2026-08-08: Derived scoring and shared ranks

Do not persist editable totals. Derive score and tier counts from prediction items and the one active snapshot. Equal totals share the same rank, and names are alphabetized only for deterministic display.
