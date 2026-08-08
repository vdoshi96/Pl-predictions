# Decisions

## 2026-08-08: Static operational data boundary

The deployed application has no live football API, scheduled scraper, or Vercel Cron. A source-neutral canonical importer plus manual admin editor write validated snapshots. This implements the owner's Codex-run automation preference while isolating source acquisition and preserving the last good snapshot. FotMob must not be scraped automatically without a written licence covering the intended extraction and use.

## 2026-08-08: Vercel-managed Neon and Drizzle

Use Vercel Marketplace Neon with pooled `DATABASE_URL`, Neon HTTP, Drizzle ORM, committed migrations, and atomic batches with pre-generated identifiers. This is current, serverless-friendly, and avoids obsolete Vercel Postgres packages.

## 2026-08-08: Accessible maintained dnd-kit

Use the current `@dnd-kit/react` sortable API. Pointer and keyboard behavior are first-class; touch-action is limited to the handle to preserve mobile scroll.

## 2026-08-08: Mobile is the primary layout

Design from the narrow single-column journey outward. Use 56-pixel dedicated move handles, a wrapping full-width navigation, safe-area-aware submission action, no horizontal overflow in the prediction list, explicit focus/live announcements, and reduced-motion support. Desktop density is an enhancement of the same semantic flow rather than a separate interface.

## 2026-08-08: Monograms until crest rights are cleared

FotMob image locations and a consumer subscription do not provide redistribution permission. Ship crisp club monograms with real names and documented source status; preserve a local asset field so permitted real marks can replace them later.

## 2026-08-08: Derived scoring and shared ranks

Do not persist editable totals. Derive score and tier counts from prediction items and the one active snapshot. Equal totals share the same rank, and names are alphabetized only for deterministic display.

## 2026-08-08: Source finality is advisory

Imports always create provisional snapshots even when a source labels a table final. Final status requires all 20 teams to have 38 played games and an explicit authenticated administrator confirmation. This avoids trusting ambiguous provider completion semantics.

## 2026-08-08: Compare-and-swap standings transitions

Snapshot activation claims the active pointer value observed at import start, requires no final pointer, and advances a season-row accepted-capture watermark only for a newer observation. Newer identical observations advance that watermark, while genuinely newer historical content may be reactivated without mutating its first-seen provenance. Finalization and undo each use one PostgreSQL common-table-expression statement to claim the exact active/final snapshot and keep pointer, snapshot flag, and audit changes atomic. Whichever concurrent transition wins the shared season row prevents the other from applying a split-brain state.

## 2026-08-08: Single-owner credential handoff

Keep the administrator mechanism provider-free. Store the login credential in Vercel server-only environments and the owner's macOS Keychain, sign short HttpOnly sessions with a separate secret, and rotate either without source changes. Use a distinct bearer secret for the standings intake so data automation never receives administrator-session authority.

## 2026-08-08: Isolated database tests and bounded production proof

Integration and full browser journeys must never target the production database. `scripts/run-with-test-database.mjs` uses an explicit `TEST_DATABASE_URL` or derives `TEST_DATABASE_NAME`, compares the resolved identity with production, and fails closed on ambiguity or equality. Production verification is split into a read-only public smoke and an explicit opt-in submit/privacy/delete proof scoped to the exact created prediction ID. The irreversible reveal/standings journey is test-only.

## 2026-08-08: Production public, previews protected

Use the Vercel Authentication boundary `preview`: the finished production site is public while preview deployments require owner sign-in. This is narrower than disabling deployment protection. The owner explicitly approved the persistent change from all-deployments protection; anonymous production access now returns 200, and the retained preview URL still redirects to Vercel SSO with 302.
