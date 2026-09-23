# September 2026 UX Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all 17 findings from the owner-approved September 22 UI/UX audit. Show answers sooner on mobile, give scores and gaps colors that match their meaning, and replace two-step controls with one-tap ones. The competition rules, data, and privacy must not change.

**Architecture:** This is presentation work inside the existing Next.js 16 App Router application. New pure helpers and small client components carry the new behavior. The existing server queries, scoring, server actions, schema, and migrations remain unchanged, except for one additive read field (`secondsUntilDeadline`) and one read-only owner overview query. The tests already exist on this branch. Implementation is finished when they pass.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, Tailwind CSS v4, Radix Dialog, lucide-react, Drizzle/Neon (read-only use here), Vitest + Testing Library (jsdom), and Playwright.

**Spec:** `docs/superpowers/specs/2026-09-22-ux-audit.html`. Open it in a browser. Each section shows a current capture beside the approved design. The plan has priority when it gives more precise instructions, such as exact copy, class names, and labels.

---

## 0. Rules of engagement (read twice)

These rules exist because this work is easy to overbuild. Follow them literally.

1. **Use only the tests you were given.** Every test this work needs is already committed on this branch. Do **not** create, delete, rename, skip (`.skip`, `.todo`, `test.fixme`), weaken, or loosen any test. Do not add snapshot tests, helper test files, or "extra coverage."
2. **Do not edit any file under `tests/`,** except the four exact Playwright edits in Task 12. Those edits are written out in full; apply them character for character.
3. **Report a test that looks wrong; do not change it.** If a provided test fails after you have implemented the step exactly as written, stop and report the file, test name, full failure output, and what you implemented. Do not change the test, and do not try alternative implementations until one passes.
4. **Do not do unrequested work.** No refactors outside the listed files, new dependencies, schema or migration changes, server-action changes, or scoring changes. Do not add features that are not in this plan. When the plan gives code, use that code. When it gives a class list, use those classes.
5. **Never touch** `drizzle/`, `src/db/schema.ts`, `scripts/`, `.impeccable/`, `public/team-marks/`, `public/player-faces/`, `premier-league-players-*/`, `src/features/scoring/`, `src/features/results/` (except the read-only import in Task 11), or `src/app/actions/`.
6. **Never run** a production write, seed, migration, `LOCK`, `REVEAL`, fixture apply, or result publish. Browser tests only run through the repository's isolated-database wrapper, which the `npm run test:e2e*` scripts already use.
7. Read `AGENTS.md` first. This Next.js version differs from your training data. If you touch routing or page props, read the relevant guide under `node_modules/next/dist/docs/` before writing code.
8. Commit after every task with the message given. Do not squash. Work on branch `vishal/ux-refresh-2026-09` (already checked out).

### Contract strings: do not change

Existing browser tests and the production smoke suite locate elements by these exact strings. Keep all of them visible and spelled exactly as they are now:

- Level-one headings: `The season, against our predictions.`, `The friends’ leaderboard.`, `Who called it?`, `One pick. Keep it going.`, `The rules, without the guesswork.`, `Season control room`, and `Admin sign in`.
- `Submissions closed · predictions revealed` (season table meta), `Provisional` / `Final` badge text, `Matchweek N` meta text.
- Link `View separate spotlight accuracy`; link `Read the full scoring rules` → `/rules#spotlight-scoring`.
- Labels `Scored leaderboard`, `Leaderboard podium`, `${name} leaderboard entry` (row `aria-label`), `Rank N` (rank badge `aria-label`), `Predicted champion: ${club}` (with a visible crest image), `Spotlight categories`, `Spotlight matrix`, `Spotlight accuracy leaderboard`, `${name} spotlight accuracy entry`, `Premier League season table`, `${name}'s predicted table`, `Premier League predicted positions`, and `${team}, predicted position N of 20` (sorter `li`).
- Win Streak: test id `win-streak-leaderboard`, heading `Win Streak leaderboard`, the sentence `Ranked by personal best. Tied bests share a rank; current picks are visible as soon as they are locked.`, region `Your Win Streak`, textbox `Display name`, buttons `Continue to profile`, `Review pick`, `Confirm ${club}`, dialog `Review your pick`, headings `${name}'s streak` and `Pick locked: ${club}`, text `Matchweeks 2–38 · Public picks · No account or password`, and text `No pick yet`.
- Entry flow: textbox `Your display name`, button `Continue to spotlight picks`, heading `Make your spotlight picks`, text `Type at least 2 letters to search players.`, `Draft saved in this browser`, `Not scored`, `How you enter` (rules disclosure), and `How to play in three steps`.

## Global constraints

- Participant data stays exactly as it is: no new personal fields, no new cookies, and no widened cookie paths. The prediction receipt cookie stays scoped to `/entries`. The audit's "You" pin and "Your prediction" column are therefore **out of scope** and are not built.
- Never serialize unrevealed prediction IDs, positions 2–20, or spotlight picks into HTML or RSC. Any server-to-client prop added here must contain only data the page already rendered publicly.
- Keep the podium grouped by occupied competition ranks 1–3, with every tied participant styled identically.
- Table points (maximum 100) and Spotlight accuracy stay visually and semantically separate.
- Touch targets must be at least 44px (`min-h-11`), and the sorter drag handle stays at 56px (`size-14`).
- Names, ranks, and numbers must carry meaning without color. Color is never the only signal.
- Club and participant names wrap **between words**: use Tailwind `break-words`, and never `[overflow-wrap:anywhere]`.
- Global CSS in `src/app/globals.css` is unlayered, so it beats Tailwind utilities regardless of specificity. Never put a Tailwind `display` or `height` utility on an element whose own global class sets that property. Use a wrapper element or a data attribute instead.
- Short local times use Chicago time via `formatLeagueDateTime`. **Deadlines** (Win Streak "Picks close", entry cutoff) keep the existing `formatChicagoUtcDateTime` dual-zone string, because people act on them.
- React 19 lint forbids synchronous `setState` in effects. Where this plan does it deliberately (URL hash), it gives the exact justified `eslint-disable-next-line` comment. Do not add others.

## Review Focus (failure modes that are easy to miss)

1. **A 320px club name breaks mid-word**, for example "Mancheste / r City". Club names must wrap only between words. This is pinned by the Task 12 Playwright helper `expectNoMidWordBreaks`, which runs on all five projects, including `reflow-320-chromium`.
2. **The bottom tab bar covers a sticky action bar or selector sheet.** The Stage 1 "Continue" bar, the Win Streak "Review pick" footer, and the player-search bottom sheet must sit above the tab bar. This is pinned by existing mobile journeys (`app-journey`, `mobile-reflow-privacy`, and `win-streak` specs), which click those controls at 320, 390, and 430px. Task 3 gives the offsets.
3. **The leaderboard filter must work without JavaScript.** The input keeps `name="q"` inside a `GET /leaderboard` form, so pressing Enter still filters on the server. This is pinned by `leaderboard-board.test.tsx` → "filters rows as the visitor types…" (checks `name="q"`) and "starts from the server query…".
4. **Old deep links still work.** `/rules#spotlight-scoring` must open the Spotlight tab. `/spotlight?category=…` must keep working after the select is removed. These are pinned by `rules-page.test.tsx` → "opens the Spotlight section from an existing #spotlight-scoring link" and `spotlight-views.test.tsx` → "switches category with one tap…".
5. **A tie spanning the podium and the list.** All entries stay in the accessible table. The podium only adds a compact visual summary. This is pinned by `leaderboard-board.test.tsx` → "keeps every scored entry in the accessible table" and the three podium tie tests.

---

## File map

Create:

| File                                                 | Responsibility                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/components/score-pill.tsx`                      | `ScorePill` + `SCORE_TIER_LABELS`: one table-points tier chip used everywhere |
| `src/components/score-breakdown-bar.tsx`             | `ScoreBreakdownBar`: proportional exact / within-3 / half bar                 |
| `src/components/league-time.tsx`                     | `LeagueTime`: `<time>` with a short Chicago line and a UTC tooltip            |
| `src/components/snapshot-status.tsx`                 | `SnapshotStatus`: Provisional/Final badge plus a Provisional explainer        |
| `src/components/mobile-tab-bar.tsx`                  | `MobileTabBar`: fixed bottom navigation below 640px                           |
| `src/features/leaderboard/leaderboard-explorer.tsx`  | `LeaderboardExplorer`: instant client-side participant filter                 |
| `src/features/entries/navigation.ts`                 | `findAdjacentEntries`: previous and next entries in leaderboard order         |
| `src/features/entries/entry-pager.tsx`               | `EntryPager`: previous/next links                                             |
| `src/features/entries/entry-compare-picker.tsx`      | `EntryComparePicker`: one-tap "Compare with…" links                           |
| `src/features/entries/entry-comparison-table.tsx`    | `EntryComparisonTable` + `summarizeEntryTiers`                                |
| `src/features/win-streak/fixture-days.ts`            | `groupFixturesByLeagueDay`                                                    |
| `src/features/win-streak/used-club-reason.ts`        | `usedClubReason`                                                              |
| `src/features/win-streak/round-countdown.tsx`        | `RoundCountdown` + `formatRoundCountdownLabel`                                |
| `src/features/win-streak/round-outcomes.tsx`         | `RoundOutcomeChips` (shared by Win Streak and Rules)                          |
| `src/features/win-streak/win-streak-layout.tsx`      | `WinStreakLayout`: puts the board or the panel first                          |
| `src/app/rules/rules-tabs.tsx`                       | `RulesTabs`: accessible tabs with hash deep-linking                           |
| `src/features/predictions/spotlight-completeness.ts` | Moved completeness helpers (breaks an import cycle)                           |
| `src/features/predictions/spotlight-progress.tsx`    | `SpotlightProgress`: seven-dot Stage 2 progress                               |
| `src/features/admin/status-board.tsx`                | `buildAdminStatusRows` + `AdminStatusBoard`                                   |

Modify: `src/app/globals.css`, `src/shared/format.ts`, `src/components/page-heading.tsx`, `src/components/site-footer.tsx`, `src/components/site-header.tsx`, `src/components/site-navigation.tsx`, `src/app/layout.tsx`, `src/features/standings/season-table-page.tsx`, `src/features/leaderboard/leaderboard-board.tsx`, `src/features/leaderboard/podium.tsx`, `src/app/leaderboard/page.tsx`, `src/app/entries/[id]/page.tsx`, `src/features/leaderboard/spotlight-views.tsx`, `src/app/spotlight/page.tsx`, `src/features/win-streak/view-model.ts`, `src/features/win-streak/queries.ts`, `src/features/win-streak/win-streak-entry-panel.tsx`, `src/features/win-streak/win-streak-leaderboard.tsx`, `src/app/win-streak/page.tsx`, `src/app/rules/page.tsx`, `src/components/how-to-play.tsx`, `src/features/predictions/prediction-sorter.tsx`, `src/features/predictions/prediction-form.tsx`, `src/features/predictions/spotlight-predictions-form.tsx`, `src/features/predictions/searchable-prediction-select.tsx`, `src/app/admin/page.tsx`, `src/app/admin/admin-nav.tsx`, `src/app/admin/results/page.tsx`, `tests/e2e/post-kickoff-leaderboard.spec.ts` (Task 12 only), `DESIGN.md`, `AGENTS.md`, `docs/QA.md`, and the generated HTML peers.

## The tests (already committed; your finish line)

| Test file                                                     | Owning task                                               |
| ------------------------------------------------------------- | --------------------------------------------------------- |
| `tests/unit/consensus-delta-palette.test.ts`                  | 1                                                         |
| `tests/unit/league-format.test.ts`                            | 2                                                         |
| `tests/components/site-shell.test.tsx`                        | 2 (footer, heading, time, status) and 3 (tab bar, header) |
| `tests/components/season-table-page.test.tsx`                 | 4                                                         |
| `tests/components/leaderboard-board.test.tsx`                 | 5                                                         |
| `tests/components/entry-comparison.test.tsx`                  | 6                                                         |
| `tests/components/spotlight-views.test.tsx`                   | 7                                                         |
| `tests/unit/win-streak-production-ui.test.tsx`                | 8                                                         |
| `tests/components/rules-page.test.tsx`                        | 9                                                         |
| `tests/components/prediction-sorter-move.test.tsx`            | 10                                                        |
| `tests/components/spotlight-progress.test.tsx`                | 10                                                        |
| `tests/components/prediction-form.test.tsx` (one test edited) | 10                                                        |
| `tests/components/admin-status-board.test.tsx`                | 11                                                        |

The complete target command (Task 13) is:

```bash
npx vitest run tests/unit/consensus-delta-palette.test.ts tests/unit/league-format.test.ts tests/components/site-shell.test.tsx tests/components/season-table-page.test.tsx tests/components/leaderboard-board.test.tsx tests/components/entry-comparison.test.tsx tests/components/spotlight-views.test.tsx tests/unit/win-streak-production-ui.test.tsx tests/components/rules-page.test.tsx tests/components/prediction-sorter-move.test.tsx tests/components/spotlight-progress.test.tsx tests/components/prediction-form.test.tsx tests/components/admin-status-board.test.tsx
```

---

### Task 1: Score and gap color tokens, score pill, breakdown bar

**Files:**

- Modify: `src/app/globals.css`
- Create: `src/components/score-pill.tsx`, `src/components/score-breakdown-bar.tsx`
- Test: `tests/unit/consensus-delta-palette.test.ts`

**Interfaces produced:**

- `ScorePill({ points: ScorePoints; tier: ScoreTier })` renders `<span class="score-pill" data-tier={tier}>{points} · {label}</span>`.
- `SCORE_TIER_LABELS: Record<ScoreTier, string>`
- `ScoreBreakdownBar({ exact: number; withinThree: number; correctHalf: number; missed?: number; size?: "sm" | "lg"; className?: string })`

- [ ] **Step 1: Run the failing test**

Run: `npx vitest run tests/unit/consensus-delta-palette.test.ts`
Expected: FAIL with `Missing --gap-neutral-bg token.` and 14 other failures.

- [ ] **Step 2: Add tokens to the light `:root` block** in `src/app/globals.css`, directly after the line `--brand-hover: #4b0b50;`:

```css
--score-exact-bg: #0b6b47;
--score-exact-ink: #ffffff;
--score-within-bg: #c9f0dc;
--score-within-ink: #0b4d34;
--score-half-bg: #e6dcef;
--score-half-ink: #4b2560;
--score-miss-bg: #efebf0;
--score-miss-ink: #6b6071;
--score-within-bar: #3aa877;
--score-half-bar: #a992bb;
--gap-neutral-bg: #efebf0;
--gap-neutral-ink: #6b6071;
--gap-positive-slight-bg: #d3f3e2;
--gap-positive-slight-ink: #0b4d34;
--gap-positive-clear-bg: #1f7a54;
--gap-positive-clear-ink: #ffffff;
--gap-positive-far-bg: #0b5a3b;
--gap-positive-far-ink: #ffffff;
--gap-negative-slight-bg: #fbdde2;
--gap-negative-slight-ink: #7a1c2c;
--gap-negative-clear-bg: #b4344d;
--gap-negative-clear-ink: #ffffff;
--gap-negative-far-bg: #7e1830;
--gap-negative-far-ink: #ffffff;
```

- [ ] **Step 3: Add dark overrides** inside the existing `@media (prefers-color-scheme: dark) { :root { … } }` block, directly after `--accent-blue: #ce9cd6;`:

```css
--score-within-bg: #174c37;
--score-within-ink: #b7ffdc;
--score-half-bg: #3b2a45;
--score-half-ink: #e7c7eb;
--score-miss-bg: #342939;
--score-miss-ink: #bcb0c2;
--gap-neutral-bg: #342939;
--gap-neutral-ink: #bcb0c2;
--gap-positive-slight-bg: #163f2f;
--gap-positive-slight-ink: #b7ffdc;
--gap-negative-slight-bg: #43161f;
--gap-negative-slight-ink: #ffc9d3;
```

- [ ] **Step 4: Replace every `.consensus-delta` rule.** Delete all seven existing `.consensus-delta[...]` rules and the whole `@media (prefers-color-scheme: dark) { .consensus-delta… }` block that follows them. Put this in their place:

```css
.consensus-delta[data-band="neutral"] {
  background: var(--gap-neutral-bg);
  color: var(--gap-neutral-ink);
}

.consensus-delta[data-direction="positive"][data-band="slight"] {
  background: var(--gap-positive-slight-bg);
  color: var(--gap-positive-slight-ink);
}

.consensus-delta[data-direction="positive"][data-band="clear"] {
  background: var(--gap-positive-clear-bg);
  color: var(--gap-positive-clear-ink);
}

.consensus-delta[data-direction="positive"][data-band="far"] {
  background: var(--gap-positive-far-bg);
  color: var(--gap-positive-far-ink);
}

.consensus-delta[data-direction="negative"][data-band="slight"] {
  background: var(--gap-negative-slight-bg);
  color: var(--gap-negative-slight-ink);
}

.consensus-delta[data-direction="negative"][data-band="clear"] {
  background: var(--gap-negative-clear-bg);
  color: var(--gap-negative-clear-ink);
}

.consensus-delta[data-direction="negative"][data-band="far"] {
  background: var(--gap-negative-far-bg);
  color: var(--gap-negative-far-ink);
}

.score-pill {
  display: inline-flex;
  min-height: 1.75rem;
  align-items: center;
  border-radius: 0.5rem;
  padding-inline: 0.5rem;
  font-size: 0.75rem;
  font-weight: 900;
  white-space: nowrap;
}

.score-pill[data-tier="exact"] {
  background: var(--score-exact-bg);
  color: var(--score-exact-ink);
}

.score-pill[data-tier="within-three"] {
  background: var(--score-within-bg);
  color: var(--score-within-ink);
}

.score-pill[data-tier="correct-half"] {
  background: var(--score-half-bg);
  color: var(--score-half-ink);
}

.score-pill[data-tier="miss"] {
  background: var(--score-miss-bg);
  color: var(--score-miss-ink);
}

.score-bar {
  display: flex;
  width: 100%;
  height: 0.375rem;
  overflow: hidden;
  border-radius: 9999px;
  background: var(--surface-subtle);
}

.score-bar[data-size="lg"] {
  height: 0.625rem;
}

.score-bar > [data-tier="exact"] {
  background: var(--score-exact-bg);
}

.score-bar > [data-tier="within-three"] {
  background: var(--score-within-bar);
}

.score-bar > [data-tier="correct-half"] {
  background: var(--score-half-bar);
}
```

- [ ] **Step 5: Create `src/components/score-pill.tsx`**

```tsx
import type { ScorePoints, ScoreTier } from "@/features/scoring";

export const SCORE_TIER_LABELS: Record<ScoreTier, string> = {
  "correct-half": "Correct half",
  exact: "Exact",
  miss: "No points",
  "within-three": "Within 3",
};

export function ScorePill({
  points,
  tier,
}: {
  points: ScorePoints;
  tier: ScoreTier;
}) {
  return (
    <span className="score-pill" data-tier={tier}>
      {points} · {SCORE_TIER_LABELS[tier]}
    </span>
  );
}
```

- [ ] **Step 6: Create `src/components/score-breakdown-bar.tsx`**

```tsx
import { cn } from "@/components/ui/cn";

export function ScoreBreakdownBar({
  className,
  correctHalf,
  exact,
  missed,
  size = "sm",
  withinThree,
}: {
  className?: string;
  correctHalf: number;
  exact: number;
  missed?: number;
  size?: "sm" | "lg";
  withinThree: number;
}) {
  const label = [
    `${exact} exact`,
    `${withinThree} within three places`,
    `${correctHalf} in the correct half`,
    ...(missed === undefined ? [] : [`${missed} missed`]),
  ].join(", ");

  return (
    <span
      aria-label={label}
      className={cn("score-bar", className)}
      data-size={size}
      role="img"
    >
      <span data-tier="exact" style={{ width: `${exact * 5}%` }} />
      <span data-tier="within-three" style={{ width: `${withinThree * 3}%` }} />
      <span data-tier="correct-half" style={{ width: `${correctHalf}%` }} />
    </span>
  );
}
```

- [ ] **Step 7: Run the test**

Run: `npx vitest run tests/unit/consensus-delta-palette.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 8: Commit**

```bash
git add src/app/globals.css src/components/score-pill.tsx src/components/score-breakdown-bar.tsx
git commit -m "Add score and gap color scales with shared score pill and breakdown bar"
```

---

### Task 2: Short league time, Provisional explainer, lighter heading and footer

**Files:**

- Modify: `src/shared/format.ts`, `src/components/page-heading.tsx`, `src/components/site-footer.tsx`
- Create: `src/components/league-time.tsx`, `src/components/snapshot-status.tsx`
- Test: `tests/unit/league-format.test.ts`; `tests/components/site-shell.test.tsx` (describe blocks `site footer`, `page heading`, `league time`, `snapshot status`)

**Interfaces produced:**

- `formatLeagueDateTime(value: Date | string): string` → `"Sun 20 Sep, 1:13 pm CDT"`
- `formatLeagueDay(value: Date | string): string` → `"Sat 10 Oct"`
- `formatLeagueTime(value: Date | string): string` → `"6:30 am"`
- `formatUtcDateTime(value: Date | string): string` → `"20 Sep 2026, 18:13 UTC"`
- `LeagueTime({ prefix?: string; value: Date | string })`
- `SnapshotStatus({ isFinal: boolean })`
- `PROVISIONAL_EXPLANATION: string`

- [ ] **Step 1: Run the failing tests**

Run: `npx vitest run tests/unit/league-format.test.ts`
Expected: FAIL because `formatLeagueDateTime` is not exported.

- [ ] **Step 2: Append to `src/shared/format.ts`** (leave every existing export as it is):

```ts
const leagueFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  hour: "numeric",
  hour12: true,
  minute: "2-digit",
  month: "short",
  timeZone: "America/Chicago",
  timeZoneName: "short",
  weekday: "short",
});

function leagueParts(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Map(
    leagueFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    day: `${parts.get("weekday")} ${parts.get("day")} ${parts.get("month")}`,
    time: `${parts.get("hour")}:${parts.get("minute")} ${parts.get("dayPeriod")?.toLowerCase()}`,
    zone: parts.get("timeZoneName"),
  };
}

export function formatLeagueDateTime(value: Date | string) {
  const parts = leagueParts(value);
  return `${parts.day}, ${parts.time} ${parts.zone}`;
}

export function formatLeagueDay(value: Date | string) {
  return leagueParts(value).day;
}

export function formatLeagueTime(value: Date | string) {
  return leagueParts(value).time;
}

export function formatUtcDateTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return formatDateTimePart(date, dateTimeFormatters.utc);
}
```

- [ ] **Step 3: Create `src/components/league-time.tsx`**

```tsx
import { formatLeagueDateTime, formatUtcDateTime } from "@/shared/format";

export function LeagueTime({
  prefix,
  value,
}: {
  prefix?: string;
  value: Date | string;
}) {
  const date = typeof value === "string" ? new Date(value) : value;
  return (
    <time dateTime={date.toISOString()} title={formatUtcDateTime(date)}>
      {prefix ? `${prefix} ` : ""}
      {formatLeagueDateTime(date)}
    </time>
  );
}
```

- [ ] **Step 4: Create `src/components/snapshot-status.tsx`**

```tsx
"use client";

import { Info } from "lucide-react";
import { useId, useState } from "react";

import { Badge } from "@/components/ui/badge";

export const PROVISIONAL_EXPLANATION =
  "Provisional tables change as matchweeks are played. The owner marks the table Final after the last matchweek.";

export function SnapshotStatus({ isFinal }: { isFinal: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (isFinal) return <Badge variant="success">Final</Badge>;

  return (
    <span className="relative inline-flex items-center">
      <Badge variant="warning">Provisional</Badge>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        aria-label="What does Provisional mean?"
        className="text-muted hover:text-brand-ink focus-visible:ring-accent-blue inline-grid size-11 place-items-center rounded-full outline-none focus-visible:ring-2"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Info aria-hidden="true" className="size-4" />
      </button>
      {open ? (
        <span
          className="border-border bg-surface text-foreground absolute top-full right-0 z-30 mt-1 w-64 rounded-xl border p-3 text-xs leading-5 shadow-lg"
          id={panelId}
          role="note"
        >
          {PROVISIONAL_EXPLANATION}
        </span>
      ) : null}
    </span>
  );
}
```

- [ ] **Step 5: Rewrite `src/components/page-heading.tsx`**. Keep the same props and the same structure; only these class strings change.

- `h1` className: `text-[1.75rem] leading-8 font-bold tracking-tight break-words sm:text-4xl sm:leading-10`
- description `p` className: `text-muted mt-1.5 max-w-2xl text-sm leading-6 sm:mt-2`
- children wrapper className: `text-muted mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs leading-5`

- [ ] **Step 6: Edit `src/components/site-footer.tsx`**

- Container `div` className: `mx-auto grid w-full max-w-6xl gap-1 px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-[0.7rem] leading-4 sm:px-6 lg:px-8`
- First `p` className: `text-brand-ink font-medium` (it was `text-brand-ink font-bold`)
- Keep both paragraphs' text exactly as it is.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run tests/unit/league-format.test.ts`
Expected: PASS.

`tests/components/site-shell.test.tsx` cannot load yet, because it imports `@/components/mobile-tab-bar`, which Task 3 creates. A `-t` filter does not skip import resolution. Its `site footer`, `page heading`, `league time`, and `snapshot status` blocks are verified in Task 3 Step 8. Do not stub or create `mobile-tab-bar.tsx` here.

- [ ] **Step 8: Commit**

```bash
git add src/shared/format.ts src/components/league-time.tsx src/components/snapshot-status.tsx src/components/page-heading.tsx src/components/site-footer.tsx
git commit -m "Add short league time, Provisional explainer, and lighter headings and footer"
```

---

### Task 3: Mobile tab bar and owner-aware header

**Files:**

- Create: `src/components/mobile-tab-bar.tsx`
- Modify: `src/components/site-navigation.tsx`, `src/components/site-header.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/features/predictions/prediction-form.tsx` (one class), `src/features/predictions/searchable-prediction-select.tsx` (one class), and `src/features/win-streak/win-streak-entry-panel.tsx` (one class)
- Test: `tests/components/site-shell.test.tsx` (all); `tests/components/prediction-form.test.tsx` → "shared site chrome" and "uses a safe-area-aware sticky action at mobile widths"

**Interfaces produced:** `MobileTabBar()` (no props); CSS custom property `--mobile-tab-bar-height` on `body` below 640px, when the tab bar is present.

- [ ] **Step 1: Run the failing test**

Run: `npx vitest run tests/components/site-shell.test.tsx`
Expected: FAIL with `Failed to resolve import "@/components/mobile-tab-bar"`.

- [ ] **Step 2: Create `src/components/mobile-tab-bar.tsx`**

```tsx
"use client";

import { BookOpen, Flame, ListOrdered, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", icon: ListOrdered, label: "Table" },
  { href: "/leaderboard", icon: Trophy, label: "Leaderboard" },
  { href: "/spotlight", icon: Sparkles, label: "Spotlight" },
  { href: "/win-streak", icon: Flame, label: "Streak" },
  { href: "/rules", icon: BookOpen, label: "Rules" },
] as const;

export function isCurrentSection(pathname: string, href: string) {
  if (href === "/leaderboard") {
    return pathname === "/leaderboard" || pathname.startsWith("/entries/");
  }
  return pathname === href;
}

export function MobileTabBar() {
  const pathname = usePathname() ?? "/";
  if (pathname.startsWith("/admin")) return null;

  return (
    <nav aria-label="Primary navigation" className="mobile-tab-bar">
      {tabs.map(({ href, icon: Icon, label }) => (
        <Link
          aria-current={isCurrentSection(pathname, href) ? "page" : undefined}
          href={href}
          key={href}
        >
          <Icon aria-hidden="true" className="size-5" strokeWidth={1.9} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Replace `src/components/site-navigation.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isCurrentSection } from "./mobile-tab-bar";

const navigation = [
  { href: "/", label: "Season table" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/spotlight", label: "Spotlight" },
  { href: "/win-streak", label: "Win Streak" },
  { href: "/rules", label: "Rules" },
] as const;

export function SiteNavigation() {
  const pathname = usePathname() ?? "/";

  if (pathname.startsWith("/admin")) {
    return (
      <nav aria-label="Primary navigation" className="site-nav">
        <Link href="/">View public site</Link>
      </nav>
    );
  }

  return (
    <div className="max-sm:hidden">
      <nav aria-label="Primary navigation" className="site-nav">
        {navigation.map(({ href, label }) => (
          <Link
            aria-current={isCurrentSection(pathname, href) ? "page" : undefined}
            href={href}
            key={href}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 4: Edit `src/components/site-header.tsx`.** Change only the brand row wrapper's className from `flex min-h-18 items-center justify-between gap-3` to `flex min-h-14 items-center justify-between gap-3 sm:min-h-18`.

- [ ] **Step 5: Edit `src/app/layout.tsx`.** Import `MobileTabBar` from `@/components/mobile-tab-bar` and render `<MobileTabBar />` directly after `<SiteFooter />`.

- [ ] **Step 6: CSS in `src/app/globals.css`.** Delete these rules inside `@media (max-width: 479px)`: `.site-nav { … }` and `.site-nav a { … }` (the text nav is hidden below 640px now). Then append:

```css
.mobile-tab-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 40;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  border-top: 1px solid var(--border);
  background: var(--surface);
  padding-bottom: env(safe-area-inset-bottom);
}

.mobile-tab-bar a {
  display: grid;
  min-height: 56px;
  place-items: center;
  align-content: center;
  gap: 2px;
  color: var(--muted);
  font-size: 0.66rem;
  font-weight: 700;
  text-decoration: none;
}

.mobile-tab-bar a[aria-current="page"] {
  color: var(--brand-ink);
}

.mobile-tab-bar a:focus-visible {
  outline-offset: -3px;
}

@media (max-width: 639px) {
  body:has(.mobile-tab-bar) {
    --mobile-tab-bar-height: calc(56px + env(safe-area-inset-bottom));
    padding-bottom: var(--mobile-tab-bar-height);
  }
}

@media (min-width: 640px) {
  .mobile-tab-bar {
    display: none;
  }
}
```

- [ ] **Step 7: Keep the sticky bars above the tab bar.** Add one class to each of these three elements and change nothing else:

1. `src/features/predictions/prediction-form.tsx`. In the sticky action wrapper's template string, change `"sticky bottom-0"` to `"sticky bottom-0 max-sm:bottom-[var(--mobile-tab-bar-height,0px)]"`. Keep `bottom-0`, because an existing test asserts it.
2. `src/features/predictions/searchable-prediction-select.tsx`. In the listbox className, change `z-40` to `z-50`. Leave `sm:z-30` as it is.
3. `src/features/win-streak/win-streak-entry-panel.tsx`. In the `CardFooter` className of the pick card (`bg-surface/95 sticky bottom-0 …`), add `max-sm:bottom-[var(--mobile-tab-bar-height,0px)]` after `bottom-0`.

- [ ] **Step 8: Run the tests**

Run: `npx vitest run tests/components/site-shell.test.tsx tests/components/prediction-form.test.tsx -t "mobile tab bar|site header|site footer|page heading|league time|snapshot status|shared site chrome|safe-area-aware sticky action"`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/mobile-tab-bar.tsx src/components/site-navigation.tsx src/components/site-header.tsx src/app/layout.tsx src/app/globals.css src/features/predictions/prediction-form.tsx src/features/predictions/searchable-prediction-select.tsx src/features/win-streak/win-streak-entry-panel.tsx
git commit -m "Add mobile bottom tab bar and owner-aware header navigation"
```

---

### Task 4: Season table: diverging gaps, zone legend, one meta line, word-safe names

**Files:**

- Modify: `src/features/standings/season-table-page.tsx`
- Test: `tests/components/season-table-page.test.tsx`

**Interfaces:** Consumes `LeagueTime` and `SnapshotStatus` (Task 2) and the gap tokens (Task 1). Produces `SEASON_TABLE_ZONES` (exported constant).

- [ ] **Step 1: Run the failing test**

Run: `npx vitest run tests/components/season-table-page.test.tsx`
Expected: 4 failures ("shows one short meta line…", "labels the zone rails…", "bands gaps…", and "never lets club names break…").

- [ ] **Step 2: Add the zone legend constant** below `zoneFor`:

```tsx
export const SEASON_TABLE_ZONES = [
  { className: "bg-accent", label: "Champions League" },
  { className: "bg-accent-blue", label: "Europa League" },
  { className: "bg-accent-pink", label: "Relegation" },
] as const;
```

- [ ] **Step 3: Replace the band logic in `DeltaChip`.** Replace everything from `const roundedDelta` through the `data-band={band}` attribute with this code (the `visible` and `description` strings stay the same):

```tsx
  const roundedDelta = Number(formatConsensusValue(delta));
  const magnitude = Math.abs(roundedDelta);
  const direction =
    roundedDelta === 0 ? "neutral" : roundedDelta > 0 ? "positive" : "negative";
  const band =
    magnitude < 1
      ? "neutral"
      : magnitude < 3
        ? "slight"
        : magnitude < 8
          ? "clear"
          : "far";
  const visible = `${direction === "neutral" ? "‒" : direction === "positive" ? "▲" : "▼"} ${formatConsensusValue(magnitude)}`;
  const description =
    direction === "neutral"
      ? `${formatConsensusValue(magnitude)} places from the league's average prediction`
      : `${direction === "positive" ? "overachieving" : "underachieving"} by ${formatConsensusValue(magnitude)} places vs the league's average prediction`;

  return (
    <span
      className="consensus-delta inline-flex min-h-7 items-center rounded-lg px-2 text-xs font-black whitespace-nowrap"
      data-band={band}
      data-direction={direction}
    >
```

- [ ] **Step 4: Change the page heading.**

- `status`: `view.snapshot ? <SnapshotStatus isFinal={view.snapshot.isFinal} /> : undefined`
- children, in this order: `{view.snapshot ? <LeagueTime prefix="Updated" value={view.snapshot.capturedAt} /> : null}`, then the existing `Matchweek N` span, then `<span>Submissions closed · predictions revealed</span>`
- Delete the `<span>{view.seasonName}</span>` child, and remove the now-unused `Badge` and `formatChicagoUtcDateTime` imports.

- [ ] **Step 5: Add the legend** as the first child of the fragment that renders the table, before the consensus-waiting card, only when `view.snapshot` exists:

```tsx
<ul
  aria-label="Table zones"
  className="text-muted flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs font-semibold"
>
  {SEASON_TABLE_ZONES.map((zone) => (
    <li className="flex items-center gap-1.5" key={zone.label}>
      <span
        aria-hidden="true"
        className={`block h-3 w-1 rounded-full ${zone.className}`}
      />
      {zone.label}
    </li>
  ))}
</ul>
```

- [ ] **Step 6: Make the columns wide enough at 320px and wrap only between words.**

- `colgroup`: `<col className="w-2" />`, `<col className="w-7 sm:w-9" />`, `<col />`, `<col className="w-8 sm:w-11" />`, the Group avg. col unchanged, and the Gap col `w-[4.25rem] sm:w-20`.
- The club-name span: replace `[overflow-wrap:anywhere]` with `break-words` and add the attribute `data-club-name`. The final className is `min-w-0 text-xs leading-4 break-words sm:text-sm`.
- `Callout` `strong`: replace `[overflow-wrap:anywhere]` with `break-words`.
- After this step, `grep -n "overflow-wrap:anywhere" src/features/standings/season-table-page.tsx` must print nothing.

- [ ] **Step 7: Run the test**

Run: `npx vitest run tests/components/season-table-page.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 8: Commit**

```bash
git add src/features/standings/season-table-page.tsx
git commit -m "Season table: diverging gap bands, zone legend, one meta line, word-safe names"
```

---

### Task 5: Leaderboard: compact podium, 56px rows, breakdown bar, instant filter

**Files:**

- Modify: `src/features/leaderboard/leaderboard-board.tsx`, `src/features/leaderboard/podium.tsx`, `src/app/leaderboard/page.tsx`, `src/app/globals.css` (podium block)
- Create: `src/features/leaderboard/leaderboard-explorer.tsx`
- Test: `tests/components/leaderboard-board.test.tsx`

**Interfaces:**

- Produces `matchesParticipantQuery(name: string, query: string): boolean` (exported from `leaderboard-board.tsx`).
- Produces `LeaderboardExplorer({ initialQuery: string; predictionsRevealed: boolean; rosterEntries: readonly LeaderboardRosterEntry[]; scoredEntries: readonly ScoredLeaderboardEntry[] | null })`.
- `ScoredLeaderboardBoard({ entries, query? })` and `LeaderboardRosterTable({ entries, predictionsRevealed })` keep their signatures.

- [ ] **Step 1: Run the failing test**

Run: `npx vitest run tests/components/leaderboard-board.test.tsx`
Expected: FAIL with `Failed to resolve import "@/features/leaderboard/leaderboard-explorer"`.

- [ ] **Step 2: Rewrite `src/features/leaderboard/leaderboard-board.tsx`** as follows:

```tsx
import { ScoreBreakdownBar } from "@/components/score-breakdown-bar";
import { TeamMark } from "@/components/team-mark";
import { Card } from "@/components/ui/card";

import { LeaderboardEntryLink } from "./entry-link";
import { Podium } from "./podium";
import type { LeaderboardRosterEntry, ScoredLeaderboardEntry } from "./queries";

export function matchesParticipantQuery(name: string, query: string) {
  return name
    .toLocaleLowerCase("en-GB")
    .includes(query.trim().toLocaleLowerCase("en-GB"));
}

function Movement({ value }: { value: number | null }) {
  const climbed = value !== null && value > 0;
  const dropped = value !== null && value < 0;
  const label =
    value === null
      ? "no previous table"
      : climbed
        ? `climbed ${value} ${value === 1 ? "place" : "places"}`
        : dropped
          ? `dropped ${Math.abs(value)} ${value === -1 ? "place" : "places"}`
          : "no rank change";
  return (
    <span
      className={`mt-0.5 block text-[0.68rem] font-black whitespace-nowrap ${
        climbed ? "text-mint-ink" : dropped ? "text-danger" : "text-muted"
      }`}
    >
      <span aria-hidden="true">
        {climbed ? `▲${value}` : dropped ? `▼${Math.abs(value!)}` : "–"}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function Champion({
  champion,
}: {
  champion: LeaderboardRosterEntry["champion"];
}) {
  return (
    <span
      aria-label={`Predicted champion: ${champion.displayName}`}
      className="text-brand-ink inline-flex min-w-0 items-center gap-1.5 text-xs font-bold"
    >
      <TeamMark
        decorative
        initials={champion.shortName}
        name={champion.displayName}
        size="sm"
        src={champion.assetPath}
      />
      <span className="min-w-0 break-words max-sm:sr-only">
        {champion.displayName}
      </span>
    </span>
  );
}

const rowClassName =
  "border-surface-lilac-border hover:bg-surface-subtle border-b align-middle last:border-b-0 max-sm:grid max-sm:min-h-14 max-sm:grid-cols-[2.5rem_minmax(0,1fr)_2rem_3rem] max-sm:grid-rows-[auto_auto] max-sm:items-center max-sm:gap-x-2 max-sm:px-3 max-sm:py-2";

export function ScoredLeaderboardBoard({
  entries,
  query = "",
}: {
  entries: readonly ScoredLeaderboardEntry[];
  query?: string;
}) {
  const visibleEntries = entries.filter((entry) =>
    matchesParticipantQuery(entry.participantName, query),
  );
  const hasMovement = entries.some((entry) => entry.movement !== null);

  return (
    <section aria-label="Scored leaderboard" className="grid gap-4">
      <Podium entries={entries} />
      {hasMovement ? (
        <p className="text-muted px-1 text-xs">
          ▲▼ Movement since the previous published table.
        </p>
      ) : null}
      {visibleEntries.length === 0 ? (
        <p className="text-muted py-4 text-sm" role="status">
          No matching participant. Try a different name.
        </p>
      ) : null}
      <Card className="overflow-hidden">
        <table className="w-full border-collapse text-sm max-sm:block">
          <caption className="sr-only">
            Table leaderboard with shared ranks, movement, champion picks,
            scoring breakdowns, and points out of 100.
          </caption>
          <thead className="max-sm:sr-only">
            <tr className="border-border text-muted border-b-2 text-left text-[0.62rem] font-black tracking-wider uppercase">
              <th className="w-20 px-3 py-3" scope="col">
                Rank
              </th>
              <th className="px-3 py-3" scope="col">
                Entry
              </th>
              <th className="px-3 py-3" scope="col">
                Breakdown
              </th>
              <th className="px-3 py-3" scope="col">
                Champion
              </th>
              <th className="w-28 px-3 py-3 text-right" scope="col">
                Table points
              </th>
            </tr>
          </thead>
          <tbody className="max-sm:block">
            {visibleEntries.map((entry) => (
              <tr
                aria-label={`${entry.participantName} leaderboard entry`}
                className={rowClassName}
                key={entry.id}
              >
                <td className="px-3 py-2 max-sm:col-start-1 max-sm:row-span-2 max-sm:row-start-1 max-sm:p-0 max-sm:text-center">
                  <span
                    aria-label={`Rank ${entry.rank}`}
                    className="bg-brand mx-auto grid size-8 place-items-center rounded-lg text-sm font-black text-white tabular-nums sm:mx-0 sm:size-9 sm:rounded-xl"
                  >
                    {entry.rank}
                  </span>
                  <Movement value={entry.movement} />
                </td>
                <td className="min-w-0 px-3 py-2 max-sm:col-start-2 max-sm:row-start-1 max-sm:p-0">
                  <LeaderboardEntryLink
                    entryId={entry.id}
                    participantName={entry.participantName}
                  />
                </td>
                <td className="px-3 py-2 max-sm:col-start-2 max-sm:row-start-2 max-sm:p-0">
                  <ScoreBreakdownBar
                    className="max-w-40"
                    correctHalf={entry.correctHalfCount}
                    exact={entry.exactCount}
                    withinThree={entry.withinThreeCount}
                  />
                  <span className="text-muted mt-1 block text-[0.68rem] font-semibold">
                    {entry.exactCount} exact · {entry.withinThreeCount} within 3
                    · {entry.correctHalfCount} half
                  </span>
                </td>
                <td className="px-3 py-2 max-sm:col-start-3 max-sm:row-span-2 max-sm:row-start-1 max-sm:p-0">
                  <Champion champion={entry.champion} />
                </td>
                <td className="px-3 py-2 text-right max-sm:col-start-4 max-sm:row-span-2 max-sm:row-start-1 max-sm:p-0">
                  <strong className="text-brand-ink-strong block text-xl font-black tabular-nums">
                    {entry.totalScore}
                  </strong>
                  <span className="sr-only">of 100 table points</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}

export function LeaderboardRosterTable({
  entries,
  predictionsRevealed,
}: {
  entries: readonly LeaderboardRosterEntry[];
  predictionsRevealed: boolean;
}) {
  return (
    <section aria-label="Submission roster">
      <Card className="overflow-hidden">
        <table className="w-full border-collapse text-sm max-sm:block">
          <caption className="sr-only">
            Active prediction entries and their public champion picks.
          </caption>
          <thead className="max-sm:sr-only">
            <tr className="border-border text-muted border-b-2 text-left text-[0.62rem] font-black tracking-wider uppercase">
              <th className="w-16 px-3 py-3" scope="col">
                Rank
              </th>
              <th className="px-3 py-3" scope="col">
                Entry
              </th>
              <th className="px-3 py-3" scope="col">
                Champion
              </th>
              <th className="w-28 px-3 py-3 text-right" scope="col">
                Table points
              </th>
            </tr>
          </thead>
          <tbody className="max-sm:block">
            {entries.map((entry) => (
              <tr
                aria-label={`${entry.participantName} leaderboard entry`}
                className="border-surface-lilac-border border-b last:border-b-0 max-sm:grid max-sm:min-h-14 max-sm:grid-cols-[2.5rem_minmax(0,1fr)_2rem_3rem] max-sm:items-center max-sm:gap-x-2 max-sm:px-3 max-sm:py-2"
                key={entry.publicKey}
              >
                <td className="px-3 py-2 max-sm:p-0">
                  <span
                    aria-label="Rank pending"
                    className="bg-brand grid size-8 place-items-center rounded-lg font-black text-white sm:size-9 sm:rounded-xl"
                  >
                    —
                  </span>
                </td>
                <td className="min-w-0 px-3 py-2 max-sm:p-0">
                  {predictionsRevealed && entry.id ? (
                    <LeaderboardEntryLink
                      entryId={entry.id}
                      participantName={entry.participantName}
                    />
                  ) : (
                    <span className="text-foreground font-black break-words">
                      {entry.participantName}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 max-sm:p-0">
                  <Champion champion={entry.champion} />
                </td>
                <td className="px-3 py-2 text-right max-sm:p-0">
                  <strong className="text-brand-ink-strong block text-xl font-black tabular-nums">
                    {entry.totalScore}
                  </strong>
                  <span className="sr-only">of 100 table points</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}
```

- [ ] **Step 3: Edit `src/features/leaderboard/podium.tsx`.** Change only the detail span className from `text-muted block text-xs` to `podium-detail text-muted text-xs`.

- [ ] **Step 4: Replace the podium CSS.** In `src/app/globals.css`, delete every rule whose selector starts with `.podium` (from `.podium {` through `.podium-score span { … }`). Also delete the `@media (min-width: 900px)` podium padding block and the podium rules inside the `@media (max-width: 899px)` and `@media (max-width: 479px)` blocks. Keep `.season-layout` inside the 899px block. Append:

```css
.podium {
  border-block: 1px solid var(--border);
  padding-block: 0.75rem;
}
.podium-tiers {
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  align-items: end;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
.podium-tier {
  min-width: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px 12px 8px 8px;
}
.podium-tier[data-rank="1"] {
  border-color: var(--accent-lilac);
}
.podium-place {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.4rem 0.5rem;
  background: var(--brand-soft);
  border-radius: 11px 11px 0 0;
}
.podium-place strong {
  font-size: 0.95rem;
  color: var(--brand-ink);
}
.podium-place span {
  font-size: 0.65rem;
  color: var(--muted);
}
.podium-tier[data-rank="1"] .podium-place {
  background: var(--brand);
}
.podium-tier[data-rank="1"] .podium-place strong {
  color: var(--accent);
}
.podium-tier[data-rank="1"] .podium-place span {
  color: #decae2;
}
.podium-people {
  display: grid;
}
.podium-person {
  display: grid;
  min-width: 0;
  justify-items: center;
  gap: 0.15rem;
  padding: 0.5rem 0.4rem;
  text-align: center;
}
.podium-person + .podium-person {
  border-top: 1px solid var(--border);
}
.podium-mascot {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  color: var(--brand-ink);
  background: var(--brand-soft);
  border-radius: 50% 50% 35% 35%;
}
.podium-mascot svg {
  width: 22px;
  height: 22px;
}
.podium-score {
  color: var(--brand-ink);
  font-size: 1.15rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.podium-score span {
  color: var(--muted);
  font-size: 0.65rem;
  font-weight: 500;
}
.podium-detail {
  display: none;
}
@media (min-width: 900px) {
  .podium-person {
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    justify-items: start;
    gap: 0.65rem;
    padding: 0.75rem;
    text-align: left;
  }
  .podium-mascot {
    width: 48px;
    height: 48px;
  }
  .podium-mascot svg {
    width: 32px;
    height: 32px;
  }
  .podium-detail {
    display: block;
  }
  .podium-tier[data-rank="1"] {
    padding-bottom: 1rem;
  }
  .podium-tier[data-rank="2"] {
    padding-bottom: 0.5rem;
  }
}
```

- [ ] **Step 5: Create `src/features/leaderboard/leaderboard-explorer.tsx`**

```tsx
"use client";

import { useState } from "react";

import {
  LeaderboardRosterTable,
  matchesParticipantQuery,
  ScoredLeaderboardBoard,
} from "./leaderboard-board";
import type { LeaderboardRosterEntry, ScoredLeaderboardEntry } from "./queries";

export function LeaderboardExplorer({
  initialQuery,
  predictionsRevealed,
  rosterEntries,
  scoredEntries,
}: {
  initialQuery: string;
  predictionsRevealed: boolean;
  rosterEntries: readonly LeaderboardRosterEntry[];
  scoredEntries: readonly ScoredLeaderboardEntry[] | null;
}) {
  const [query, setQuery] = useState(initialQuery);
  const count = scoredEntries?.length ?? rosterEntries.length;

  return (
    <div className="grid gap-4">
      <form
        action="/leaderboard"
        aria-label="Participant filter"
        className="flex items-center gap-2"
        onSubmit={(event) => event.preventDefault()}
        role="search"
      >
        <label className="sr-only" htmlFor="leaderboard-filter">
          Find a participant
        </label>
        <input
          autoComplete="off"
          className="border-border bg-surface min-h-11 w-full max-w-sm rounded-lg border px-3 text-base sm:text-sm"
          id="leaderboard-filter"
          maxLength={80}
          name="q"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Filter ${count} ${count === 1 ? "name" : "names"}`}
          type="search"
          value={query}
        />
        {query ? (
          <button
            className="text-brand-ink inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold underline"
            onClick={() => setQuery("")}
            type="button"
          >
            Clear
          </button>
        ) : null}
      </form>
      {scoredEntries ? (
        <ScoredLeaderboardBoard entries={scoredEntries} query={query} />
      ) : (
        <LeaderboardRosterTable
          entries={rosterEntries.filter((entry) =>
            matchesParticipantQuery(entry.participantName, query),
          )}
          predictionsRevealed={predictionsRevealed}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Edit `src/app/leaderboard/page.tsx`.**

- `status`: `view.snapshot ? <SnapshotStatus isFinal={view.snapshot.isFinal} /> : undefined`
- The "Updated" child becomes `<LeagueTime prefix="Updated" value={view.snapshot.capturedAt} />` (still conditional on `view.snapshot`). Keep the entries-count span, the Matchweek span, and the `View separate spotlight accuracy` link.
- Delete the whole `<form action="/leaderboard" …>…</form>` block.
- Replace the final ternary (`view.entries.length === 0 ? … : scoringStarted && view.scoredEntries ? … : …`) with the following. Keep the existing empty-state `Card` exactly as it is.

```tsx
{view.entries.length === 0 ? (
  /* existing "No entries yet" Card, unchanged */
) : (
  <LeaderboardExplorer
    initialQuery={query}
    predictionsRevealed={view.predictionsRevealed}
    rosterEntries={view.entries.map((entry) => ({
      ...entry,
      spotlightPicks: null,
    }))}
    scoredEntries={
      scoringStarted && view.scoredEntries ? view.scoredEntries : null
    }
  />
)}
```

The `spotlightPicks: null` mapping keeps pick data out of the client payload. Leave it in.

- Remove the now-unused imports: `Badge`, `formatChicagoUtcDateTime`, `LeaderboardRosterTable`, and `ScoredLeaderboardBoard`.

- [ ] **Step 7: Run the test**

Run: `npx vitest run tests/components/leaderboard-board.test.tsx`
Expected: PASS (16 tests).

- [ ] **Step 8: Commit**

```bash
git add src/features/leaderboard/leaderboard-board.tsx src/features/leaderboard/podium.tsx src/features/leaderboard/leaderboard-explorer.tsx src/app/leaderboard/page.tsx src/app/globals.css
git commit -m "Leaderboard: compact podium, 56px rows with breakdown bar, instant filter"
```

---

### Task 6: Entry detail: score summary, filters, compare, previous/next

**Files:**

- Create: `src/features/entries/navigation.ts`, `src/features/entries/entry-pager.tsx`, `src/features/entries/entry-compare-picker.tsx`, `src/features/entries/entry-comparison-table.tsx`
- Modify: `src/app/entries/[id]/page.tsx`, `src/app/globals.css` (two rules)
- Test: `tests/components/entry-comparison.test.tsx`

**Interfaces produced:**

- `type EntryReference = { id: string; participantName: string }`
- `type AdjacentEntries = { next: EntryReference | null; position: number; previous: EntryReference | null; total: number }`
- `findAdjacentEntries(ordered: readonly EntryReference[], currentId: string): AdjacentEntries | null`
- `EntryPager({ navigation: AdjacentEntries })`
- `EntryComparePicker({ activeCompareId: string | null; entryId: string; others: readonly EntryReference[] })`
- `type EntryCompare = { participantName: string; positions: Readonly<Record<string, number>> }`
- `summarizeEntryTiers(items)` returns `{ correctHalf, exact, miss, scored, withinThree }`
- `EntryComparisonTable({ compare: EntryCompare | null; items: readonly EntryComparisonItem[]; participantName: string; totalScore: number | null })`

- [ ] **Step 1: Run the failing test**

Run: `npx vitest run tests/components/entry-comparison.test.tsx`
Expected: FAIL with `Failed to resolve import "@/features/entries/entry-compare-picker"`.

- [ ] **Step 2: Create `src/features/entries/navigation.ts`**

```ts
export type EntryReference = Readonly<{ id: string; participantName: string }>;

export type AdjacentEntries = Readonly<{
  next: EntryReference | null;
  position: number;
  previous: EntryReference | null;
  total: number;
}>;

export function findAdjacentEntries(
  ordered: readonly EntryReference[],
  currentId: string,
): AdjacentEntries | null {
  const index = ordered.findIndex((entry) => entry.id === currentId);
  if (index < 0) return null;
  return {
    next: ordered[index + 1] ?? null,
    position: index + 1,
    previous: ordered[index - 1] ?? null,
    total: ordered.length,
  };
}
```

- [ ] **Step 3: Create `src/features/entries/entry-pager.tsx`**

Implementation correction: put the space after each screen-reader label outside the span (`<span className="sr-only">Previous entry:</span>{" "}`, likewise Next). The accessibility-name library trims each child element; the original trailing space was lost. The owner supplied this correction, and all 11 entry-comparison tests passed.

```tsx
import Link from "next/link";

import type { AdjacentEntries } from "./navigation";

const linkClassName =
  "text-brand-ink inline-flex min-h-11 min-w-0 items-center gap-1 font-semibold underline underline-offset-4";

export function EntryPager({ navigation }: { navigation: AdjacentEntries }) {
  return (
    <nav
      aria-label="Entry navigation"
      className="flex items-center justify-between gap-3 text-sm"
    >
      {navigation.previous ? (
        <Link
          className={linkClassName}
          href={`/entries/${navigation.previous.id}`}
        >
          <span aria-hidden="true">‹</span>
          <span className="sr-only">Previous entry: </span>
          <span className="min-w-0 break-words">
            {navigation.previous.participantName}
          </span>
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted shrink-0 text-xs">
        {navigation.position} of {navigation.total}
      </span>
      {navigation.next ? (
        <Link
          className={`${linkClassName} justify-end text-right`}
          href={`/entries/${navigation.next.id}`}
        >
          <span className="sr-only">Next entry: </span>
          <span className="min-w-0 break-words">
            {navigation.next.participantName}
          </span>
          <span aria-hidden="true">›</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
```

- [ ] **Step 4: Create `src/features/entries/entry-compare-picker.tsx`**

```tsx
import Link from "next/link";

import type { EntryReference } from "./navigation";

export function EntryComparePicker({
  activeCompareId,
  entryId,
  others,
}: {
  activeCompareId: string | null;
  entryId: string;
  others: readonly EntryReference[];
}) {
  return (
    <details
      className="border-border bg-surface rounded-xl border"
      open={activeCompareId !== null}
    >
      <summary className="text-brand-ink flex min-h-11 cursor-pointer items-center px-3 text-sm font-black">
        Compare with…
      </summary>
      <ul className="border-border grid gap-1 border-t p-2 sm:grid-cols-3">
        {others.map((other) => (
          <li key={other.id}>
            <Link
              aria-current={other.id === activeCompareId ? "true" : undefined}
              className="hover:bg-surface-subtle aria-[current=true]:bg-brand-soft aria-[current=true]:text-brand-ink flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold break-words"
              href={`/entries/${entryId}?compare=${other.id}`}
            >
              {other.participantName}
            </Link>
          </li>
        ))}
      </ul>
      {activeCompareId ? (
        <Link
          className="text-brand-ink border-border flex min-h-11 items-center border-t px-3 text-sm font-semibold underline"
          href={`/entries/${entryId}`}
        >
          Stop comparing
        </Link>
      ) : null}
    </details>
  );
}
```

- [ ] **Step 5: Create `src/features/entries/entry-comparison-table.tsx`**

```tsx
"use client";

import { useState } from "react";

import { ScoreBreakdownBar } from "@/components/score-breakdown-bar";
import { ScorePill } from "@/components/score-pill";
import { TeamMark } from "@/components/team-mark";
import type { ScoreTier } from "@/features/scoring";
import { ordinal } from "@/shared/format";

import type { EntryComparisonItem } from "./queries";

export type EntryCompare = Readonly<{
  participantName: string;
  positions: Readonly<Record<string, number>>;
}>;

type Filter = "all" | ScoreTier;

export function summarizeEntryTiers(
  items: readonly Pick<EntryComparisonItem, "tier">[],
) {
  const summary = {
    correctHalf: 0,
    exact: 0,
    miss: 0,
    scored: false,
    withinThree: 0,
  };
  for (const item of items) {
    if (item.tier === null) continue;
    summary.scored = true;
    if (item.tier === "exact") summary.exact += 1;
    else if (item.tier === "within-three") summary.withinThree += 1;
    else if (item.tier === "correct-half") summary.correctHalf += 1;
    else summary.miss += 1;
  }
  return summary;
}

const rowColumns =
  "grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 px-3 py-2 sm:grid-cols-[2.25rem_minmax(0,1fr)_3rem_3rem_5.5rem]";
const rowColumnsWithCompare =
  "grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 px-3 py-2 sm:grid-cols-[2.25rem_minmax(0,1fr)_3rem_3rem_3rem_5.5rem]";

export function EntryComparisonTable({
  compare,
  items,
  participantName,
  totalScore,
}: {
  compare: EntryCompare | null;
  items: readonly EntryComparisonItem[];
  participantName: string;
  totalScore: number | null;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const summary = summarizeEntryTiers(items);
  const showSummary = totalScore !== null && summary.scored;
  const columns = compare ? rowColumnsWithCompare : rowColumns;
  const filters: readonly { label: string; value: Filter }[] = [
    { label: `All ${items.length}`, value: "all" },
    { label: `Exact · ${summary.exact}`, value: "exact" },
    { label: `Within 3 · ${summary.withinThree}`, value: "within-three" },
    { label: `Half · ${summary.correctHalf}`, value: "correct-half" },
    { label: `Missed · ${summary.miss}`, value: "miss" },
  ];
  const visible =
    filter === "all" ? items : items.filter((item) => item.tier === filter);

  return (
    <div className="grid gap-4">
      {showSummary ? (
        <section aria-label="Score summary" className="grid gap-3">
          <p className="flex items-end gap-2">
            <strong className="text-brand-ink-strong text-4xl leading-none font-black tabular-nums">
              {totalScore}
            </strong>
            <span className="text-muted pb-1 text-sm font-semibold">
              / 100 table points
            </span>
          </p>
          <ScoreBreakdownBar
            correctHalf={summary.correctHalf}
            exact={summary.exact}
            missed={summary.miss}
            size="lg"
            withinThree={summary.withinThree}
          />
          <div
            aria-label="Filter clubs"
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
            role="group"
          >
            {filters.map((option) => {
              const active = filter === option.value;
              return (
                <button
                  aria-pressed={active}
                  className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-3.5 text-xs font-black whitespace-nowrap ${
                    active
                      ? "border-brand bg-brand dark:ring-accent-blue text-white dark:ring-1"
                      : "border-border bg-surface text-muted hover:bg-surface-subtle"
                  }`}
                  key={option.value}
                  onClick={() => setFilter(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <div
        aria-hidden="true"
        className={`text-muted hidden text-[0.62rem] font-black tracking-wide uppercase sm:grid ${columns}`}
      >
        <span>Pred</span>
        <span>Club</span>
        <span className="text-center">Actual</span>
        <span className="text-center">Off</span>
        {compare ? (
          <span className="truncate text-center">
            {compare.participantName}
          </span>
        ) : null}
        <span className="text-right">Pts</span>
      </div>

      <ol
        aria-label={`${participantName}'s predicted table`}
        className="entry-comparison"
      >
        {visible.map((item) => (
          <li
            className={columns}
            data-tier={item.tier ?? "unscored"}
            key={item.teamId}
          >
            <span
              aria-label={`Predicted ${ordinal(item.predictedPosition)}`}
              className="bg-brand row-span-2 grid size-8 place-items-center rounded-lg text-xs font-black text-white tabular-nums sm:row-span-1"
            >
              {item.predictedPosition}
            </span>
            <span className="col-start-2 row-start-1 flex min-w-0 items-center gap-2 sm:col-start-auto sm:row-start-auto">
              <TeamMark
                initials={item.shortName}
                name={item.displayName}
                size="sm"
                src={item.assetPath}
              />
              <span className="text-foreground min-w-0 text-sm font-black break-words">
                {item.displayName}
              </span>
            </span>
            <span className="text-muted col-start-2 row-start-2 flex flex-wrap gap-x-3 text-xs font-bold tabular-nums sm:contents">
              <span className="sm:text-foreground sm:text-center sm:text-sm">
                <span aria-hidden="true" className="sm:hidden">
                  Act{" "}
                </span>
                <span className="sr-only">Actual position </span>
                {item.actualPosition ?? "—"}
              </span>
              <span className="sm:text-center">
                <span aria-hidden="true" className="sm:hidden">
                  Off{" "}
                </span>
                <span className="sr-only">Places off </span>
                {item.difference ?? "—"}
              </span>
              {compare ? (
                <span className="sm:text-foreground sm:text-center sm:text-sm">
                  <span aria-hidden="true" className="sm:hidden">
                    {compare.participantName}{" "}
                  </span>
                  <span className="sr-only">
                    {compare.participantName} predicted{" "}
                  </span>
                  {compare.positions[item.teamId] ?? "—"}
                </span>
              ) : null}
            </span>
            <span className="col-start-3 row-span-2 row-start-1 text-right sm:col-start-auto sm:row-span-1 sm:row-start-auto">
              {item.tier && item.points !== null ? (
                <ScorePill points={item.points} tier={item.tier} />
              ) : (
                <span className="text-muted text-xs font-bold">Not scored</span>
              )}
            </span>
          </li>
        ))}
      </ol>
      {visible.length === 0 ? (
        <p className="text-muted text-sm" role="status">
          No clubs in this group.
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 6: CSS.** In `src/app/globals.css`, delete the rules `.entry-comparison > li > div { … }` and `.entry-comparison > li > div > div { … }`. Keep `.entry-comparison` and `.entry-comparison > li + li`.

- [ ] **Step 7: Rewrite the data flow in `src/app/entries/[id]/page.tsx`.**

JSX correction: when embedding the replacement markup, omit the snippet’s semicolon after `null` inside `{…}` and the semicolon after `<EntryComparisonTable … />`. They are not part of the rendered JSX.

1. Change the signature to `export default async function EntryPage({ params, searchParams }: PageProps<"/entries/[id]">)` and read both: `const [{ id }, query] = await Promise.all([params, searchParams]);` then `const entry = await getEntryComparison(id);`.
2. After `if (!entry) notFound();` add:

```tsx
const board = entry.predictionsRevealed ? await getLeaderboardView() : null;
const boardEntries: readonly { id: string | null; participantName: string }[] =
  board ? (board.scoredEntries ?? board.entries) : [];
const ordered = boardEntries.flatMap((candidate) =>
  candidate.id
    ? [{ id: candidate.id, participantName: candidate.participantName }]
    : [],
);
const navigation = findAdjacentEntries(ordered, entry.id);
const compareId = typeof query.compare === "string" ? query.compare : null;
const compareEntry =
  entry.predictionsRevealed && compareId && compareId !== entry.id
    ? await getEntryComparison(compareId)
    : null;
const compare = compareEntry?.predictionsRevealed
  ? {
      participantName: compareEntry.participantName,
      positions: Object.fromEntries(
        compareEntry.comparisonItems.map((item) => [
          item.teamId,
          item.predictedPosition,
        ]),
      ),
    }
  : null;
```

3. PageHeading children become: `<LeagueTime prefix="Submitted" value={entry.createdAt} />` and `{entry.snapshot ? <SnapshotStatus isFinal={entry.snapshot.isFinal} /> : null}`. Delete the `totalScore` strong from the heading; the score now lives in the summary.
4. Directly after `PageHeading`, add `{navigation ? <EntryPager navigation={navigation} /> : null}`.
5. In the snapshot line, replace `Standings snapshot {formatChicagoUtcDateTime(...)}` with `<LeagueTime prefix="Standings from" value={entry.snapshot.capturedAt} />`, keeping the `· Matchweek N` suffix.
6. Replace the entire `<ol className="entry-comparison" …>…</ol>` block with:

```tsx
{
  entry.predictionsRevealed && ordered.length > 1 ? (
    <EntryComparePicker
      activeCompareId={compare ? compareId : null}
      entryId={entry.id}
      others={ordered.filter((other) => other.id !== entry.id)}
    />
  ) : null;
}
<EntryComparisonTable
  compare={compare}
  items={entry.comparisonItems}
  participantName={entry.participantName}
  totalScore={entry.totalScore}
/>;
```

7. Delete the `tierPresentation` constant and the imports it alone used (`TeamMark`, `ordinal`, and `formatChicagoUtcDateTime` if unused). Add the imports `getLeaderboardView` (from `@/features/leaderboard/queries`), `findAdjacentEntries`, `EntryPager`, `EntryComparePicker`, `EntryComparisonTable`, `LeagueTime`, and `SnapshotStatus`. Keep the Spotlight picks card unchanged.

- [ ] **Step 8: Run the test**

Run: `npx vitest run tests/components/entry-comparison.test.tsx`
Expected: PASS (11 tests).

- [ ] **Step 9: Commit**

```bash
git add src/features/entries src/app/entries src/app/globals.css
git commit -m "Entry detail: score summary with filters, compare column, previous and next"
```

---

### Task 7: Spotlight: one-tap categories, leader line, lone-picker names, mobile matrix cards

**Files:**

- Modify: `src/features/leaderboard/spotlight-views.tsx`, `src/app/spotlight/page.tsx`
- Test: `tests/components/spotlight-views.test.tsx`

**Interfaces produced:** `SpotlightCategoryNav({ selected: PredictionCategory })` and `SpotlightViewNav({ selected: SpotlightView })`, both exported from `spotlight-views.tsx`.

- [ ] **Step 1: Run the failing test**

Run: `npx vitest run tests/components/spotlight-views.test.tsx`
Expected: 8 failures.

- [ ] **Step 2: Edit `ResultChip`.** Replace only the ranked return value (the last `return` in `ResultChip`) with:

```tsx
return (
  <span
    className={`rounded-lg px-2 py-1 text-[0.68rem] font-black whitespace-nowrap ${
      rank === 1
        ? "bg-mint text-mint-ink"
        : rank <= 5
          ? "bg-sky-soft text-brand-ink"
          : "bg-surface-subtle text-muted"
    }`}
  >
    <span aria-hidden="true">
      #{rank} · {accuracyPoints ?? 0} pts
    </span>
    <span className="sr-only">
      Result rank {rank}, {accuracyPoints ?? 0} accuracy points
    </span>
  </span>
);
```

- [ ] **Step 3: Replace the leader block.** In `SpotlightCategoriesView`, replace the whole `<div className="border-surface-lilac-border flex min-h-20 …">…</div>` (both the leader and no-leader branches) with:

```tsx
<p
  className="border-surface-lilac-border text-muted border-b border-dashed px-4 py-2 text-xs"
  data-testid="category-leader"
>
  <span className="text-[0.62rem] font-black tracking-wider uppercase">
    Current leader
  </span>{" "}
  {leader ? (
    <>
      <strong className="text-brand-ink-strong break-words">
        {leader.displayName}
      </strong>{" "}
      · {leader.metricLabel}
    </>
  ) : (
    <strong className="text-muted">Awaiting results publication</strong>
  )}
</p>
```

The `SubjectMark` import stays in use because the rows still use it.

- [ ] **Step 4: Update the row summary text.**

- In the row `strong`, replace `[overflow-wrap:anywhere]` with `break-words`.
- Replace `{row.count} of {entryCount} · Select to see names` with `{row.count === 1 ? row.pickers[0]?.participantName : `${row.count} of ${entryCount}`}` (use a JSX expression, not a nested template string).

- [ ] **Step 5: Add the two navigation components** to `spotlight-views.tsx`. Add `import Link from "next/link";` and `import type { SpotlightView } from "./spotlight-board";`.

```tsx
const activeChipClassName =
  "border-brand bg-brand text-white dark:ring-1 dark:ring-accent-blue";
const idleChipClassName =
  "border-border bg-surface text-muted hover:bg-surface-subtle";

export function SpotlightCategoryNav({
  selected,
}: {
  selected: PredictionCategory;
}) {
  return (
    <nav
      aria-label="Choose a spotlight category"
      className="-mx-1 overflow-x-auto px-1 pb-1"
    >
      <ul className="flex w-max gap-2">
        {PREDICTION_CATEGORY_DEFINITIONS.map((definition) => {
          const active = definition.category === selected;
          return (
            <li key={definition.category}>
              <Link
                aria-current={active ? "page" : undefined}
                className={`focus-visible:ring-accent-blue inline-flex min-h-11 items-center rounded-full border px-3.5 text-xs font-black whitespace-nowrap outline-none focus-visible:ring-2 ${active ? activeChipClassName : idleChipClassName}`}
                href={`/spotlight?category=${definition.category}`}
                scroll={false}
              >
                {definition.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const viewOptions: readonly {
  href: string;
  label: string;
  value: SpotlightView;
}[] = [
  { href: "/spotlight", label: "Categories", value: "categories" },
  { href: "/spotlight?view=entries", label: "Entries", value: "entries" },
  { href: "/spotlight?view=matrix", label: "Matrix", value: "matrix" },
];

export function SpotlightViewNav({ selected }: { selected: SpotlightView }) {
  return (
    <nav aria-label="Spotlight views">
      <ul className="bg-surface-subtle grid grid-cols-3 gap-1 rounded-xl p-1">
        {viewOptions.map((option) => {
          const active = option.value === selected;
          return (
            <li key={option.value}>
              <Link
                aria-current={active ? "page" : undefined}
                className={`focus-visible:ring-accent-blue inline-flex min-h-11 w-full items-center justify-center rounded-lg px-2 text-xs font-black outline-none focus-visible:ring-2 ${
                  active
                    ? "bg-brand dark:ring-accent-blue text-white dark:ring-1"
                    : "text-muted hover:bg-surface"
                }`}
                href={option.href}
              >
                {option.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 6: Add mobile matrix cards to `SpotlightMatrixView`.**

1. Add this near `matrixResult`:

```tsx
const MATRIX_ABBREVIATIONS: Record<PredictionCategory, string> = {
  most_clean_sheets: "CS",
  overrated_player: "OP",
  overrated_team: "OT",
  top_assister: "TA",
  top_scorer: "TS",
  underdog_player: "UP",
  underdog_team: "UT",
};

function compactMatrixResult(pick: SpotlightPickDisplay): string {
  if (pick.resultStatus === "outside-range") return "Out";
  if (pick.resultRank === undefined || pick.resultRank === null) {
    return pick.category === "underdog_player" ||
      pick.category === "overrated_player"
      ? "N/A"
      : "…";
  }
  return `#${pick.resultRank}`;
}
```

2. Wrap the existing `<Card className="overflow-hidden">…</Card>` (the table) in `<div className="max-sm:hidden">…</div>`.
3. After that wrapper, still inside the section, add:

```tsx
<ul aria-label="Picks by entry" className="grid gap-2 sm:hidden">
  {entries.map((entry) => (
    <li
      aria-label={`${entry.participantName} spotlight picks`}
      className="border-border bg-surface rounded-xl border p-3"
      key={entry.id}
    >
      <div className="flex items-center justify-between gap-2">
        <LeaderboardEntryLink
          entryId={entry.id}
          participantName={entry.participantName}
        />
        <span className="text-muted shrink-0 text-xs font-semibold">
          {entry.availableCategoryCount} of 7 live · {entry.accuracyScore} pts
        </span>
      </div>
      <ul
        aria-label={`${entry.participantName} picks`}
        className="mt-2 grid grid-cols-4 gap-1"
      >
        {PREDICTION_CATEGORY_DEFINITIONS.map((definition) => {
          const pick = entry.picksByCategory.get(definition.category);
          return (
            <li
              className={`flex min-h-9 items-center justify-center gap-1 rounded-lg px-1 text-[0.68rem] font-black ${pick ? matrixCellClass(pick) : "bg-surface-subtle text-muted"}`}
              key={definition.category}
            >
              <abbr
                aria-hidden="true"
                className="no-underline"
                title={definition.label}
              >
                {MATRIX_ABBREVIATIONS[definition.category]}
              </abbr>
              <span aria-hidden="true">
                {pick ? compactMatrixResult(pick) : "—"}
              </span>
              <span className="sr-only">
                {pick
                  ? `${definition.label}: ${pick.displayName}, ${matrixResult(pick)}`
                  : `${definition.label}: no pick`}
              </span>
            </li>
          );
        })}
      </ul>
    </li>
  ))}
</ul>
```

4. In the table's Accuracy cell, change `text-rose-score` to `text-brand-ink-strong`. Replace the table's `[overflow-wrap:anywhere]` with `break-words`.

- [ ] **Step 7: Edit `src/app/spotlight/page.tsx`.**

- Remove the `view.seasonName` meta span.
- Replace the whole `<nav aria-label="Spotlight views">…</nav>` block with `<SpotlightViewNav selected={selectedView} />`, and delete the page's `viewOptions` constant.
- Replace the whole `<form action="/spotlight" …>…</form>` with `<SpotlightCategoryNav selected={selectedCategory} />`.
- In the aside, delete the sentence `Select a player or club to see everyone who backed them. Spotlight accuracy stays separate from table points.` and replace it with `Spotlight accuracy stays separate from table points.`
- In the Entries view sort nav, add `dark:ring-1 dark:ring-accent-blue` to the active class string (`border-brand bg-brand text-white`).
- In the Entries view score `strong`, change `text-rose-score` to `text-brand-ink-strong`.
- Import `SpotlightCategoryNav` and `SpotlightViewNav`.

- [ ] **Step 8: Run the test**

Run: `npx vitest run tests/components/spotlight-views.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 9: Commit**

```bash
git add src/features/leaderboard/spotlight-views.tsx src/app/spotlight/page.tsx
git commit -m "Spotlight: one-tap category chips, leader line, and mobile matrix cards"
```

---

### Task 8: Win Streak: countdown, day-grouped fixtures, used-club reasons, inline board picks

**Files:**

- Create: `src/features/win-streak/fixture-days.ts`, `used-club-reason.ts`, `round-countdown.tsx`, `round-outcomes.tsx`, `win-streak-layout.tsx`
- Modify: `src/features/win-streak/view-model.ts`, `queries.ts`, `win-streak-entry-panel.tsx`, `win-streak-leaderboard.tsx`, and `src/app/win-streak/page.tsx`
- Test: `tests/unit/win-streak-production-ui.test.tsx`

**Interfaces produced:**

- `WinStreakActiveRoundView` gains `secondsUntilDeadline: number`.
- `groupFixturesByLeagueDay<T extends { kickoffAt: string }>(fixtures: readonly T[]): { dayLabel: string; fixtures: (T & { timeLabel: string })[] }[]`
- `usedClubReason(history: readonly WinStreakHistoryView[], teamSlug: WinStreakTeamSlug): string`
- `formatRoundCountdownLabel(totalSeconds: number, matchweek: number): string`
- `RoundCountdown({ deadlineIso: string; initialRemainingSeconds: number; matchweek: number })`
- `WIN_STREAK_ROUND_OUTCOMES` and `RoundOutcomeChips()`
- `WinStreakLayout({ leaderboard: ReactNode; panel: ReactNode; viewerPresent: boolean })`

- [ ] **Step 1: Run the failing test**

Run: `npx vitest run tests/unit/win-streak-production-ui.test.tsx`
Expected: FAIL with `Failed to resolve import "@/features/win-streak/fixture-days"`.

- [ ] **Step 2: View model and query.** In `view-model.ts`, add `secondsUntilDeadline: number;` to `WinStreakActiveRoundView`. In `queries.ts` `activeRoundView`, add this to the returned object:

```ts
    secondsUntilDeadline: Math.max(
      0,
      Math.floor((deadline.getTime() - databaseNow.getTime()) / 1_000),
    ),
```

- [ ] **Step 3: Create `src/features/win-streak/fixture-days.ts`**

```ts
import { formatLeagueDay, formatLeagueTime } from "@/shared/format";

export type FixtureDayGroup<T extends { kickoffAt: string }> = {
  dayLabel: string;
  fixtures: (T & { timeLabel: string })[];
};

export function groupFixturesByLeagueDay<T extends { kickoffAt: string }>(
  fixtures: readonly T[],
): FixtureDayGroup<T>[] {
  const groups: FixtureDayGroup<T>[] = [];
  const sorted = [...fixtures].sort(
    (left, right) => Date.parse(left.kickoffAt) - Date.parse(right.kickoffAt),
  );
  for (const fixture of sorted) {
    const dayLabel = formatLeagueDay(fixture.kickoffAt);
    const withTime = {
      ...fixture,
      timeLabel: formatLeagueTime(fixture.kickoffAt),
    };
    const current = groups.at(-1);
    if (current?.dayLabel === dayLabel) current.fixtures.push(withTime);
    else groups.push({ dayLabel, fixtures: [withTime] });
  }
  return groups;
}
```

- [ ] **Step 4: Create `src/features/win-streak/used-club-reason.ts`**

```ts
import type { WinStreakTeamSlug } from "./fixtures";
import type { WinStreakHistoryView } from "./view-model";

export function usedClubReason(
  history: readonly WinStreakHistoryView[],
  teamSlug: WinStreakTeamSlug,
): string {
  const latestWin = history
    .filter((entry) => entry.outcome === "win" && entry.teamSlug === teamSlug)
    .sort((left, right) => right.matchweek - left.matchweek)[0];
  return latestWin
    ? `Won in MW${latestWin.matchweek} · unlocks when your streak resets`
    : "Used in this streak";
}
```

- [ ] **Step 5: Create `src/features/win-streak/round-outcomes.tsx`**

```tsx
export const WIN_STREAK_ROUND_OUTCOMES = [
  "Win → +1, club used",
  "Draw or loss → reset",
  "Missed → held",
] as const;

export function RoundOutcomeChips() {
  return (
    <ul aria-label="How a round scores" className="flex flex-wrap gap-1.5">
      {WIN_STREAK_ROUND_OUTCOMES.map((outcome, index) => (
        <li
          className={`rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${index === 0 ? "bg-mint text-mint-ink" : "bg-brand-soft text-brand-ink"}`}
          key={outcome}
        >
          {outcome}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 6: Create `src/features/win-streak/round-countdown.tsx`.** The timing logic is copied from `SubmissionCountdown` on purpose; that pattern already passes lint.

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  normalizeRemainingSeconds,
  splitCountdown,
} from "@/components/submission-countdown";

function unit(value: number, singular: string) {
  return `${value} ${singular}${value === 1 ? "" : "s"}`;
}

export function formatRoundCountdownLabel(
  totalSeconds: number,
  matchweek: number,
) {
  const parts = splitCountdown(totalSeconds);
  return `${unit(parts.days, "day")}, ${unit(parts.hours, "hour")}, ${unit(parts.minutes, "minute")} until Matchweek ${matchweek} picks lock`;
}

const units = [
  { key: "days", label: "days" },
  { key: "hours", label: "hrs" },
  { key: "minutes", label: "min" },
] as const;

export function RoundCountdown({
  deadlineIso,
  initialRemainingSeconds,
  matchweek,
}: {
  deadlineIso: string;
  initialRemainingSeconds: number;
  matchweek: number;
}) {
  const router = useRouter();
  const initialRemaining = normalizeRemainingSeconds(initialRemainingSeconds);
  const [remainingSeconds, setRemainingSeconds] = useState(initialRemaining);
  const refreshedAtZero = useRef(false);

  useEffect(() => {
    const startedAt = performance.now();

    function updateCountdown() {
      const elapsedSeconds = Math.floor(
        Math.max(0, performance.now() - startedAt) / 1_000,
      );
      setRemainingSeconds(Math.max(0, initialRemaining - elapsedSeconds));
    }

    updateCountdown();
    const boundaryDelay = 1_000 - (performance.now() % 1_000);
    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      updateCountdown();
      intervalId = window.setInterval(updateCountdown, 1_000);
    }, boundaryDelay);
    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [initialRemaining]);

  useEffect(() => {
    if (
      initialRemaining > 0 &&
      remainingSeconds === 0 &&
      !refreshedAtZero.current
    ) {
      refreshedAtZero.current = true;
      router.refresh();
    }
  }, [initialRemaining, remainingSeconds, router]);

  const parts = useMemo(
    () => splitCountdown(remainingSeconds),
    [remainingSeconds],
  );

  return (
    <time
      aria-label={formatRoundCountdownLabel(remainingSeconds, matchweek)}
      aria-live="off"
      className="flex gap-1.5"
      dateTime={deadlineIso}
      role="timer"
    >
      {units.map((part) => (
        <span
          className="bg-brand grid min-w-11 rounded-lg px-1.5 py-1 text-center text-white"
          key={part.key}
        >
          <strong className="text-base leading-5 font-black tabular-nums">
            {String(parts[part.key]).padStart(2, "0")}
          </strong>
          <span className="text-[0.55rem] leading-3 font-bold text-white/70 uppercase">
            {part.label}
          </span>
        </span>
      ))}
    </time>
  );
}
```

- [ ] **Step 7: Create `src/features/win-streak/win-streak-layout.tsx`**

```tsx
import type { ReactNode } from "react";

export function WinStreakLayout({
  leaderboard,
  panel,
  viewerPresent,
}: {
  leaderboard: ReactNode;
  panel: ReactNode;
  viewerPresent: boolean;
}) {
  const panelSlot = (
    <div
      className="min-w-0 lg:sticky lg:top-5 lg:col-start-1 lg:row-start-1"
      data-testid="win-streak-panel-slot"
    >
      {panel}
    </div>
  );
  const leaderboardSlot = (
    <div
      className="min-w-0 lg:col-start-2 lg:row-start-1"
      data-testid="win-streak-leaderboard-slot"
    >
      {leaderboard}
    </div>
  );

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(20rem,0.82fr)_minmax(0,1.18fr)] lg:items-start lg:gap-7">
      {viewerPresent ? (
        <>
          {panelSlot}
          {leaderboardSlot}
        </>
      ) : (
        <>
          {leaderboardSlot}
          {panelSlot}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Edit `win-streak-entry-panel.tsx`.**

1. **`TeamChoice`:** add the prop `unavailableReason: string`. Replace the hard-coded `Used in this streak` text in the reason span with `{unavailableReason}`. Change the reason span color from `text-danger` to `text-muted`.
2. **Streak summary card (`ProfilePanel`):** directly after the paragraph that says `All clubs are available.` / `N winning clubs are unavailable…`, add `<div className="mt-3"><RoundOutcomeChips /></div>`.
3. **Pick card header:** replace `<p className="text-muted mt-1 text-sm leading-5">Locks {formatChicagoUtcDateTime(activeRound.deadlineAt)}</p>` with:

```tsx
                <p className="text-muted mt-1 text-sm leading-5">
                  Locks {formatChicagoUtcDateTime(activeRound.deadlineAt)}
                </p>
                <div className="mt-2">
                  <RoundCountdown
                    deadlineIso={activeRound.deadlineAt}
                    initialRemainingSeconds={activeRound.secondsUntilDeadline}
                    matchweek={activeRound.matchweek}
                  />
                </div>
```

4. **Fixture grid:** replace the `<div className="grid gap-2">{activeRound.fixtures.map(…)}</div>` inside the fieldset with:

```tsx
<div className="grid gap-4">
  {groupFixturesByLeagueDay(activeRound.fixtures).map((group) => (
    <div className="grid gap-2" key={group.dayLabel}>
      <h4 className="text-muted px-1 text-[0.68rem] font-black tracking-wider uppercase">
        {group.dayLabel}
      </h4>
      {group.fixtures.map((fixture) => (
        <div
          className="border-border bg-surface-lilac grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 rounded-2xl border p-1.5 sm:gap-3 sm:p-2"
          key={`${fixture.homeTeamSlug}:${fixture.awayTeamSlug}`}
        >
          <TeamChoice
            available={!used.has(fixture.homeTeamSlug)}
            checked={selectedTeamSlug === fixture.homeTeamSlug}
            side="Home"
            teamSlug={fixture.homeTeamSlug}
            unavailableReason={usedClubReason(
              viewer.history,
              fixture.homeTeamSlug,
            )}
            onSelect={(teamSlug) => {
              setSelectedTeamSlug(teamSlug);
              setMessage(null);
            }}
          />
          <span className="text-muted px-0.5 text-center text-[0.68rem] leading-4 font-black whitespace-nowrap">
            {fixture.timeLabel}
          </span>
          <TeamChoice
            available={!used.has(fixture.awayTeamSlug)}
            checked={selectedTeamSlug === fixture.awayTeamSlug}
            side="Away"
            teamSlug={fixture.awayTeamSlug}
            unavailableReason={usedClubReason(
              viewer.history,
              fixture.awayTeamSlug,
            )}
            onSelect={(teamSlug) => {
              setSelectedTeamSlug(teamSlug);
              setMessage(null);
            }}
          />
        </div>
      ))}
    </div>
  ))}
</div>
```

5. **`PickReviewDialog`:** add the prop `currentStreak: number`, and pass `currentStreak={viewer.currentStreak}` where it is rendered. After the team card (`<div className="border-border bg-surface-lilac mt-5 …">…</div>`), add:

```tsx
<ul
  aria-label="What happens next"
  className="text-foreground mt-4 grid gap-1.5 text-sm leading-5"
>
  <li>
    {`If ${team.displayName} win: streak ${currentStreak} → ${currentStreak + 1}. ${team.displayName} is then unavailable until your streak resets.`}
  </li>
  <li>Draw or loss: streak resets to 0 and every club unlocks.</li>
</ul>
```

6. **Dialog content becomes a mobile bottom sheet.** In the `Dialog.Content` className, replace `fixed inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] bottom-[max(0.5rem,env(safe-area-inset-bottom))]` with `fixed inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]`. Add `sm:inset-x-auto sm:rounded-2xl`, and keep the existing `sm:top-1/2 sm:bottom-auto sm:left-1/2 …` classes. Keep the title, description, buttons, and the `t-modal t-modal-centered-responsive` classes.
7. Add the imports: `groupFixturesByLeagueDay`, `usedClubReason`, `RoundCountdown`, and `RoundOutcomeChips`.

- [ ] **Step 9: Edit `win-streak-leaderboard.tsx` (mobile list and table).**

Replace each mobile `<li>` with:

```tsx
<li
  className="border-border grid min-h-14 min-w-0 grid-cols-[2.25rem_minmax(0,1fr)_auto_auto] items-center gap-x-3 border-b px-3 py-2 last:border-b-0"
  key={`${entry.displayName}-${index}`}
>
  <span className="bg-brand-soft text-brand-ink grid size-8 place-items-center rounded-lg text-sm font-black tabular-nums">
    {entry.rank}
  </span>
  <div className="grid min-w-0 gap-1">
    <strong className="text-brand-ink-strong block leading-5 font-black break-words">
      {entry.displayName}
    </strong>
    {entry.isViewer ? (
      <Badge className="justify-self-start" variant="accent">
        You
      </Badge>
    ) : null}
    <PickSummary pick={entry.currentPick} />
  </div>
  <span className="text-center">
    <span className="text-muted block text-[0.58rem] font-black tracking-wide uppercase">
      Current
    </span>
    <strong className="text-brand-ink-strong text-lg font-black tabular-nums">
      {entry.currentStreak}
    </strong>
  </span>
  <span className="text-center">
    <span className="text-muted block text-[0.58rem] font-black tracking-wide uppercase">
      Best
    </span>
    <strong className="text-brand-ink text-lg font-black tabular-nums">
      {entry.bestStreak}
    </strong>
  </span>
</li>
```

In the desktop table:

- Remove `font-mono` from the rank `td` and the current `td`.
- Change the best `td` from `text-rose-score … font-mono font-black` to `text-brand-ink … font-black`.
- In the row `th`, replace `[overflow-wrap:anywhere]` with `break-words`.

After this step, `grep -nE "font-mono|rose-score|overflow-wrap:anywhere" src/features/win-streak/win-streak-leaderboard.tsx` must print nothing.

- [ ] **Step 10: Edit `src/app/win-streak/page.tsx`.** Replace the two-column `div` (the one containing the panel and the leaderboard) with:

```tsx
<WinStreakLayout
  leaderboard={<WinStreakLeaderboard entries={view.leaderboard} />}
  panel={
    <WinStreakEntryPanel
      activeRound={view.activeRound}
      createProfileAction={createWinStreakProfileAction}
      submitPickAction={submitWinStreakPickAction}
      viewer={view.viewer}
    />
  }
  viewerPresent={view.viewer !== null}
/>
```

Keep the Hero (including `Picks close …` with `formatChicagoUtcDateTime` and the `Matchweeks 2–38 · Public picks · No account or password` text) and `SourceNote` unchanged.

- [ ] **Step 11: Run the test**

Run: `npx vitest run tests/unit/win-streak-production-ui.test.tsx`
Expected: PASS (21 tests).

- [ ] **Step 12: Commit**

```bash
git add src/features/win-streak src/app/win-streak/page.tsx
git commit -m "Win Streak: round countdown, day-grouped kickoffs, used-club reasons, inline board picks"
```

---

### Task 9: Rules: three tabs, participant language, deep links

**Files:**

- Create: `src/app/rules/rules-tabs.tsx`
- Modify: `src/app/rules/page.tsx` (full rewrite below), `src/components/how-to-play.tsx` (one string)
- Test: `tests/components/rules-page.test.tsx`; must still pass: `tests/components/how-to-play.test.tsx`, `tests/components/scoring-example.test.tsx`, `tests/unit/public-copy.test.ts`

**Interfaces produced:** `type RulesTab = { content: ReactNode; label: string; panelId: string; value: string }` and `RulesTabs({ tabs: readonly RulesTab[] })`.

- [ ] **Step 1: Run the failing test**

Run: `npx vitest run tests/components/rules-page.test.tsx`
Expected: 6 failures (`Unable to find … role "tablist"` plus the forbidden-language test).

- [ ] **Step 2: Create `src/app/rules/rules-tabs.tsx`**

```tsx
"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type RulesTab = Readonly<{
  content: ReactNode;
  label: string;
  panelId: string;
  value: string;
}>;

export function RulesTabs({ tabs }: { tabs: readonly RulesTab[] }) {
  const [selected, setSelected] = useState(tabs[0]!.value);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();

  useEffect(() => {
    const match = tabs.find(
      (tab) => tab.panelId === window.location.hash.slice(1),
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL hash is browser-only state that is read after hydration.
    if (match) setSelected(match.value);
  }, [tabs]);

  function focusTab(index: number) {
    const wrapped = (index + tabs.length) % tabs.length;
    setSelected(tabs[wrapped]!.value);
    tabRefs.current[wrapped]?.focus();
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const next =
      event.key === "ArrowRight"
        ? index + 1
        : event.key === "ArrowLeft"
          ? index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    focusTab(next);
  }

  return (
    <div className="grid gap-5">
      <div
        aria-label="Rules sections"
        className="bg-surface-subtle grid grid-cols-3 gap-1 rounded-xl p-1"
        role="tablist"
      >
        {tabs.map((tab, index) => {
          const active = tab.value === selected;
          return (
            <button
              aria-controls={tab.panelId}
              aria-selected={active}
              className={`focus-visible:ring-accent-blue min-h-11 rounded-lg px-2 text-sm font-black outline-none focus-visible:ring-2 ${
                active
                  ? "bg-surface text-brand-ink dark:ring-accent-blue shadow-sm dark:ring-1"
                  : "text-muted"
              }`}
              id={`${baseId}-${tab.value}-tab`}
              key={tab.value}
              onClick={() => setSelected(tab.value)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              role="tab"
              tabIndex={active ? 0 : -1}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <section
          aria-labelledby={`${baseId}-${tab.value}-tab`}
          className="grid gap-5"
          hidden={tab.value !== selected}
          id={tab.panelId}
          key={tab.value}
          role="tabpanel"
          tabIndex={0}
        >
          {tab.content}
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Replace `src/app/rules/page.tsx` completely**

```tsx
import { EyeOff, Search, Sparkles, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { HowToPlay } from "@/components/how-to-play";
import { PageHeading } from "@/components/page-heading";
import { ScoringExample } from "@/components/scoring-example";
import { Card, CardContent } from "@/components/ui/card";
import { RULES_PENDING_RESULTS_MESSAGE } from "@/content/public-copy";
import { RoundOutcomeChips } from "@/features/win-streak/round-outcomes";

import { RulesTabs } from "./rules-tabs";

export const metadata: Metadata = { title: "How to play & scoring" };

const tableRules = [
  { label: "Exact finishing position", points: 5 },
  { label: "Within three places", points: 3 },
  { label: "Correct top or bottom half", points: 1 },
  { label: "Everything else", points: 0 },
] as const;

const spotlightCategories = [
  ["Top scorer", "The player who finishes highest in the league goals list."],
  [
    "Top assister",
    "The player who finishes highest in the league assists list.",
  ],
  ["Most clean sheets", "The club that keeps the most clean sheets."],
  [
    "Underdog team",
    "The club that beats the group’s average prediction by the most. Only clubs picked for this category are ranked.",
  ],
  [
    "Overrated team",
    "The club that falls furthest below the group’s average prediction. Only clubs picked for this category are ranked.",
  ],
  [
    "Underdog player",
    "Picked players ranked by reviewed average season rating, highest first. A player without a rating shows N/A and scores nothing.",
  ],
  [
    "Overrated player",
    "Picked players ranked by reviewed average season rating, lowest first. A player without a rating shows N/A and scores nothing.",
  ],
] as const;

function TableRules() {
  return (
    <>
      <Card>
        <CardContent>
          <div className="flex items-start gap-3">
            <span className="bg-brand-soft text-brand-ink grid size-11 shrink-0 place-items-center rounded-xl">
              <Trophy aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="text-brand-ink-strong text-xl font-black">
                League-table points
              </h2>
              <p className="text-muted mt-1 text-sm leading-6">
                Each club earns only its highest matching tier. Your champion is
                the club placed first in your table; it uses the same scoring,
                with no separate bonus. The most anyone can score is 100.
              </p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {tableRules.map((rule) => (
              <div
                className="bg-brand-soft ring-border rounded-xl p-3 text-center ring-1"
                key={rule.label}
              >
                <dt className="text-muted text-xs leading-4 font-semibold">
                  {rule.label}
                </dt>
                <dd className="text-brand-ink mt-1 text-2xl font-black">
                  {rule.points}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <ScoringExample />
      <details className="border-border border-y py-4">
        <summary className="min-h-11 cursor-pointer font-bold">
          How you enter
        </summary>
        <div className="mt-4">
          <HowToPlay />
        </div>
      </details>
      <Card>
        <CardContent className="flex items-start gap-3">
          <EyeOff
            aria-hidden="true"
            className="text-brand-ink size-6 shrink-0"
          />
          <div>
            <h2 className="text-brand-ink-strong text-lg font-black">
              Privacy and reveal
            </h2>
            <p className="text-muted mt-1 text-sm leading-6">
              Before the reveal, everyone sees only each entry’s name, 0 points,
              and champion. The other 19 positions and all seven spotlight picks
              stay private until the season opens.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function SpotlightRules() {
  return (
    <>
      <div className="flex items-start gap-3">
        <span className="bg-rose-soft text-rose-ink grid size-11 shrink-0 place-items-center rounded-xl">
          <Sparkles aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="text-brand-ink-strong text-xl font-black">
            Pick seven outcomes. Closer calls score more.
          </h2>
          <p className="text-muted mt-1 text-sm leading-6">
            Each category is ranked once its result list is published. The
            best-placed pick earns one point per entry, the next earns one
            fewer, and so on. With 14 entries, 1st earns 14 points, 2nd earns
            13, and so on down to 0. Ties share the higher place. Spotlight
            points never change your 100-point table score.
          </p>
        </div>
      </div>
      <Card>
        <CardContent>
          <h3 className="text-brand-ink-strong text-sm font-black">
            Worked example · Top scorer
          </h3>
          <ul className="mt-2 grid gap-1.5 text-sm">
            <li className="flex items-center justify-between gap-3">
              <span>Your pick finished 1st</span>
              <span className="score-pill" data-tier="exact">
                +14
              </span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>Your pick finished 13th</span>
              <span className="score-pill" data-tier="miss">
                +2
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
      <div className="grid gap-2 sm:grid-cols-2">
        {spotlightCategories.map(([label, description]) => (
          <div
            className="border-border bg-surface-lilac rounded-xl border p-3"
            key={label}
          >
            <h3 className="text-brand-ink-strong text-sm font-black">
              {label}
            </h3>
            <p className="text-muted mt-1 text-xs leading-5">{description}</p>
          </div>
        ))}
      </div>
      <p className="text-muted text-sm leading-6">
        Example: if the group expected Manchester United to finish 2.4th on
        average and they finish 10th, they are 7.6 places below expectations.
        That is a strong overrated pick and a poor underdog pick.
      </p>
      <p className="text-muted text-sm leading-6">
        {RULES_PENDING_RESULTS_MESSAGE}
      </p>
      <Card>
        <CardContent className="flex items-start gap-3">
          <Search
            aria-hidden="true"
            className="text-brand-ink size-6 shrink-0"
          />
          <div>
            <h3 className="text-brand-ink-strong text-lg font-black">
              Can’t find a player?
            </h3>
            <p className="text-muted mt-1 text-sm leading-6">
              Search by first or last name. If someone is missing, choose Other
              player and type their name. The owner matches it to the right
              player before results count.
            </p>
          </div>
        </CardContent>
      </Card>
      <Link
        className="bg-brand text-accent focus-visible:ring-accent-blue hover:bg-brand-hover inline-flex min-h-11 items-center justify-self-start rounded-xl px-4 text-sm font-black outline-none focus-visible:ring-2"
        href="/spotlight"
      >
        Open spotlight accuracy
      </Link>
    </>
  );
}

function WinStreakRules() {
  return (
    <>
      <div>
        <h2 className="text-brand-ink-strong text-xl font-black">
          One club per matchweek. Keep winning.
        </h2>
        <p className="text-muted mt-1 text-sm leading-6">
          Matchweeks 2–38. Pick one club to win before the round’s first
          kickoff. Picks are final and everyone can see them.
        </p>
      </div>
      <RoundOutcomeChips />
      <p className="text-muted text-sm leading-6">
        A club that wins for you can’t be picked again until your streak resets.
        Your best streak decides your rank, and equal bests share a place. Lost
        your cookie? Enter the same display name to pick up where you left off.
      </p>
      <Link
        className="text-brand-ink inline-flex min-h-11 items-center justify-self-start text-sm font-semibold underline"
        href="/win-streak"
      >
        Play Win Streak
      </Link>
    </>
  );
}

export default function RulesPage() {
  return (
    <main id="main-content" className="page-shell w-full flex-1 py-6 sm:py-10">
      <div className="mx-auto grid max-w-4xl gap-5 sm:gap-7">
        <PageHeading
          title="The rules, without the guesswork."
          description="The season game and Win Streak run independently."
        />
        <RulesTabs
          tabs={[
            {
              content: <TableRules />,
              label: "Table",
              panelId: "table-rules",
              value: "table",
            },
            {
              content: <SpotlightRules />,
              label: "Spotlight",
              panelId: "spotlight-scoring",
              value: "spotlight",
            },
            {
              content: <WinStreakRules />,
              label: "Win Streak",
              panelId: "win-streak-rules",
              value: "win-streak",
            },
          ]}
        />
      </div>
    </main>
  );
}
```

Implementation correction for the walkthrough: the existing browser contract counts three images named `Mobile … screen`. Change the review image alt text from `Mobile final-review page` to `Mobile final-review screen`; this keeps the description truthful and consistent.

- [ ] **Step 4: Edit `src/components/how-to-play.tsx`.** In step 1, change the first callout label to exactly: `Enter your display name first, then drag the handles, tap a position number, or use Arrow, Page Up, Page Down, Home, and End.`

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/components/rules-page.test.tsx tests/components/how-to-play.test.tsx tests/components/scoring-example.test.tsx tests/unit/public-copy.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/rules src/components/how-to-play.tsx
git commit -m "Rules: Table, Spotlight, and Win Streak tabs in participant language"
```

---

### Task 10: Next-season entry flow: tap-a-position sheet, compact Stage 1, Stage 2 progress

**Files:**

- Create: `src/features/predictions/spotlight-completeness.ts`, `src/features/predictions/spotlight-progress.tsx`
- Modify: `src/features/predictions/prediction-sorter.tsx`, `src/features/predictions/prediction-form.tsx`, `src/features/predictions/spotlight-predictions-form.tsx`
- Test: `tests/components/prediction-sorter-move.test.tsx`, `tests/components/spotlight-progress.test.tsx`, `tests/components/prediction-form.test.tsx` (whole file must pass)

**Interfaces produced:**

- `SpotlightProgress({ picks: SpotlightPicksDraft })`
- `spotlightIncompleteCategories` and `spotlightPicksAreComplete` move to `spotlight-completeness.ts`, and `spotlight-predictions-form.tsx` re-exports them under the same names.

- [ ] **Step 1: Run the failing tests**

Run: `npx vitest run tests/components/prediction-sorter-move.test.tsx tests/components/spotlight-progress.test.tsx tests/components/prediction-form.test.tsx`
Expected: all 4 sorter tests fail, the progress file fails to import, and the prediction-form test "asks for the display name before the A–Z blank-slate table" fails on `Why?`.

- [ ] **Step 2: Move the completeness helpers.** Create `src/features/predictions/spotlight-completeness.ts`. Move `normalizedCustomName`, `normalizedCustomNameKey`, `spotlightPicksAreComplete`, and `spotlightIncompleteCategories` into it verbatim, importing `PREDICTION_CATEGORY_DEFINITIONS` and `PredictionCategory` from `./categories` and `import type { SpotlightPicksDraft } from "./spotlight-predictions-form";`. Export all four. In `spotlight-predictions-form.tsx`:

- delete those four definitions;
- add `import { normalizedCustomName, normalizedCustomNameKey, spotlightIncompleteCategories, spotlightPicksAreComplete } from "./spotlight-completeness";`
- add `export { spotlightIncompleteCategories, spotlightPicksAreComplete } from "./spotlight-completeness";`

Every existing importer continues to work.

Implementation correction: import only `normalizedCustomName` and `spotlightPicksAreComplete` into the form. The other two local imports are unused and fail the zero-warning lint gate; keep the specified exports and re-exports unchanged.

- [ ] **Step 3: Create `src/features/predictions/spotlight-progress.tsx`**

```tsx
import { cn } from "@/components/ui/cn";

import { PREDICTION_CATEGORY_DEFINITIONS } from "./categories";
import { spotlightIncompleteCategories } from "./spotlight-completeness";
import type { SpotlightPicksDraft } from "./spotlight-predictions-form";

export function SpotlightProgress({ picks }: { picks: SpotlightPicksDraft }) {
  const incomplete = new Set(spotlightIncompleteCategories(picks));
  const done = PREDICTION_CATEGORY_DEFINITIONS.length - incomplete.size;
  const next =
    PREDICTION_CATEGORY_DEFINITIONS.find((definition) =>
      incomplete.has(definition.category),
    )?.category ?? null;

  return (
    <div
      aria-label="Spotlight progress"
      className="flex items-center gap-1.5"
      role="group"
    >
      {PREDICTION_CATEGORY_DEFINITIONS.map((definition) => {
        const state = !incomplete.has(definition.category)
          ? "done"
          : definition.category === next
            ? "next"
            : "todo";
        return (
          <span
            aria-hidden="true"
            className={cn(
              "h-2.5 rounded-full",
              state === "done"
                ? "bg-mint-ink w-2.5"
                : state === "next"
                  ? "bg-brand w-6"
                  : "bg-border w-2.5",
            )}
            data-state={state}
            key={definition.category}
          />
        );
      })}
      <span className="text-muted ml-1.5 text-xs font-bold">
        {done} of 7 picked
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Stage 2 header** in `spotlight-predictions-form.tsx`. Replace the intro `Card` (the one with the `Sparkles` icon) with the markup below. Remove the `Sparkles` import if it becomes unused.

```tsx
<div className="grid gap-2">
  <p className="text-rose-ink text-xs font-black tracking-[0.12em] uppercase">
    Step 2 of 3
  </p>
  <h2
    className="text-brand-ink-strong text-2xl font-black tracking-tight outline-none"
    id="spotlight-picks-heading"
    tabIndex={-1}
  >
    Make your spotlight picks
  </h2>
  <SpotlightProgress picks={picks} />
  <p className="text-muted text-sm leading-6">
    {players.length > 0
      ? `Search ${players.length.toLocaleString("en-GB")} ${players.length === 1 ? "player" : "players"} by name (2+ letters). Other player is always available.`
      : "No player catalogue is loaded yet. Other player remains available in every player category."}
  </p>
</div>
```

- [ ] **Step 5: Tap-a-position sheet** in `prediction-sorter.tsx`.

Implementation correction from the production-build browser run: import `Feedback` from `@dnd-kit/dom` and extend each sortable row’s default plugins with `Feedback.configure({ dropAnimation: null })`. The library’s default 250ms drop cleanup replaces the dragged DOM node after the test has focused its keyboard handle; the trace showed focus at 130ms and ArrowDown at 274ms after mouse-up, with no move received. Removing that delayed drop animation keeps the settled row available for immediate keyboard input. Keep all default sortable plugins.

1. Add `import * as Dialog from "@radix-ui/react-dialog";`.
2. Add the prop `onChoosePosition: (teamId: string) => void;` to `SortableTeamRowProps`, and destructure it.
3. Replace the position `<span aria-label={`${positionKind === "predicted" ? …} position ${position}`} …>{position}</span>` with:

```tsx
<button
  aria-label={`Choose a new position for ${team.displayName}, currently ${position} of ${count}`}
  className={cn(
    "focus-visible:ring-accent-blue grid size-11 shrink-0 place-items-center rounded-lg font-mono text-xs font-black tabular-nums outline-none focus-visible:ring-2 disabled:cursor-not-allowed",
    position <= 10 ? "bg-brand text-white" : "bg-brand-soft text-brand-ink",
  )}
  disabled={disabled}
  onClick={() => onChoosePosition(team.id)}
  type="button"
>
  {position}
</button>
```

4. In `PredictionSorter`, refactor the index math into an absolute mover, and derive the keyboard mover from it. Replace `handleKeyboardMove` with:

```tsx
const moveTeamToIndex = useCallback(
  (teamId: string, requestedIndex: number) => {
    const currentIndex = teams.findIndex((team) => team.id === teamId);
    if (currentIndex < 0) return;
    const nextIndex = Math.min(teams.length - 1, Math.max(0, requestedIndex));
    const source = teams[currentIndex];
    if (!source) return;

    if (nextIndex === currentIndex) {
      setAnnouncement(
        `${source.displayName} is already at position ${currentIndex + 1} of ${teams.length}.`,
      );
      return;
    }

    const nextTeams = [...teams];
    nextTeams.splice(currentIndex, 1);
    nextTeams.splice(nextIndex, 0, source);
    onChange(nextTeams);
    navigator.vibrate?.(8);
    setAnnouncement(
      `${source.displayName} moved to position ${nextIndex + 1} of ${teams.length}.`,
    );
  },
  [onChange, teams],
);

const handleKeyboardMove = useCallback(
  (teamId: string, destination: -5 | -1 | 1 | 5 | "start" | "end") => {
    const currentIndex = teams.findIndex((team) => team.id === teamId);
    if (currentIndex < 0) return;
    moveTeamToIndex(
      teamId,
      destination === "start"
        ? 0
        : destination === "end"
          ? teams.length - 1
          : currentIndex + destination,
    );
  },
  [moveTeamToIndex, teams],
);
```

5. Add this state near the other state: `const [moveTeamId, setMoveTeamId] = useState<string | null>(null);` and `const moveDescriptionId = useId();`. Then derive:

```tsx
const moveTeam = moveTeamId
  ? (teams.find((team) => team.id === moveTeamId) ?? null)
  : null;
const moveTeamIndex = moveTeam
  ? teams.findIndex((team) => team.id === moveTeam.id)
  : -1;

function chooseIndex(index: number) {
  if (!moveTeam) return;
  moveTeamToIndex(moveTeam.id, index);
  setMoveTeamId(null);
}
```

6. Pass `onChoosePosition={setMoveTeamId}` to every `SortableTeamRow`.
7. Render the sheet as the last child of the `<section>`:

```tsx
<Dialog.Root
  onOpenChange={(open) => {
    if (!open) setMoveTeamId(null);
  }}
  open={moveTeam !== null}
>
  <Dialog.Portal>
    <Dialog.Overlay className="t-modal-overlay bg-brand-strong/60 fixed inset-0 z-50" />
    <Dialog.Content
      aria-describedby={moveDescriptionId}
      className="border-border bg-surface text-foreground fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl outline-none sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[min(26rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
    >
      {moveTeam ? (
        <>
          <Dialog.Title className="text-brand-ink-strong text-lg font-black">
            Move {moveTeam.displayName}
          </Dialog.Title>
          <Dialog.Description
            className="text-muted mt-1 text-sm"
            id={moveDescriptionId}
          >
            Currently {positionKind} position {moveTeamIndex + 1} of{" "}
            {teams.length}.
          </Dialog.Description>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {teams.map((team, index) => (
              <button
                aria-label={`Position ${index + 1}`}
                className="border-border bg-surface text-brand-ink-strong hover:border-accent-lilac disabled:bg-surface-subtle disabled:text-muted min-h-11 rounded-lg border text-sm font-black tabular-nums disabled:line-through"
                disabled={index === moveTeamIndex}
                key={team.id}
                onClick={() => chooseIndex(index)}
                type="button"
              >
                {index + 1}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              disabled={moveTeamIndex === 0}
              onClick={() => chooseIndex(0)}
              variant="secondary"
            >
              Move to top
            </Button>
            <Button
              disabled={moveTeamIndex === teams.length - 1}
              onClick={() => chooseIndex(teams.length - 1)}
              variant="secondary"
            >
              Move to bottom
            </Button>
          </div>
          <Dialog.Close asChild>
            <Button className="mt-2 w-full" variant="ghost">
              Cancel
            </Button>
          </Dialog.Close>
        </>
      ) : null}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

8. Change the helper paragraph under the sorter heading to: `Drag the handle, tap a position number, or use Arrow, Page Up, Page Down, Home, and End.`

- [ ] **Step 6: Compact Stage 1** in `prediction-form.tsx`.

JSX correction: omit the A–Z banner snippet’s semicolon after `null` inside the JSX expression.

1. **Name card:** change `CardContent className="grid gap-4"` to `className="grid gap-3 p-3 sm:p-4"`. Delete the whole icon-and-description block (the `div.flex.items-start.gap-3` containing the `ShieldCheck` icon, the `h2`, and the description `p`), and put `<h2 className="sr-only">Who is making this prediction?</h2>` as the first child instead. Keep the label, input, help text, honeypot, disabled notice, and error exactly as they are. Remove the `ShieldCheck` import if it becomes unused.
2. **A–Z banner:** replace the whole `isAlphabetical ? (<aside …>…</aside>) : null` with:

```tsx
{
  isAlphabetical ? (
    <aside
      aria-labelledby="alphabetical-blank-slate-heading"
      className="border-warning/35 bg-warning-soft text-warning rounded-xl border px-3 py-2"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
        <h2
          className="min-w-0 grow text-sm font-black"
          id="alphabetical-blank-slate-heading"
        >
          The table starts A–Z as a blank slate
        </h2>
      </div>
      <details className="text-sm leading-5">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-bold underline underline-offset-4">
          Why?
        </summary>
        <p className="pb-1">
          This is not last season’s table or a suggested prediction. Reorder the
          clubs, or confirm the A–Z order when you continue if it is really your
          prediction.
        </p>
      </details>
    </aside>
  ) : null;
}
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run tests/components/prediction-sorter-move.test.tsx tests/components/spotlight-progress.test.tsx tests/components/prediction-form.test.tsx tests/components/searchable-prediction-select.test.tsx tests/components/standings-paste-panel.test.tsx tests/components/manual-standings-form.test.tsx`
Expected: PASS. The last three confirm that the admin standings sorter and the selector are unaffected.

- [ ] **Step 8: Commit**

```bash
git add src/features/predictions
git commit -m "Entry flow: tap-a-position sheet, compact Stage 1, Stage 2 progress"
```

---

### Task 11: Owner desk: dataset status board, plain intro, admin header

**Files:**

- Create: `src/features/admin/status-board.tsx`
- Modify: `src/app/admin/page.tsx`, `src/app/admin/results/page.tsx` (intro copy only), `src/app/admin/admin-nav.tsx` (one class)
- Test: `tests/components/admin-status-board.test.tsx`; must still pass: `tests/unit/admin-controls.test.tsx`, `tests/unit/admin-win-streak-route.test.ts`

**Interfaces produced:** `AdminStatusInput`, `AdminStatusRow`, `AdminDatasetKey`, `buildAdminStatusRows(input: AdminStatusInput): AdminStatusRow[]`, and `AdminStatusBoard({ rows: readonly AdminStatusRow[] })`.

- [ ] **Step 1: Run the failing test**

Run: `npx vitest run tests/components/admin-status-board.test.tsx`
Expected: FAIL with `Failed to resolve import "@/features/admin/status-board"`.

- [ ] **Step 2: Create `src/features/admin/status-board.tsx`**

Implementation correction: add `relative` to the status-board scrolling wrapper. Temporary browser measurements found the absolutely positioned `sr-only` attention labels extending to 435.75px on a 390px page, outside the scroll container’s containing block. Positioning the wrapper contains those labels while keeping the table scrollable and accessible. A `min-w-0` attempt did not change the failure and was removed; the temporary measurements were also removed.

```tsx
import Link from "next/link";

import { formatLeagueDateTime } from "@/shared/format";

export type AdminDatasetKey =
  "goals" | "assists" | "clean_sheets" | "player_ratings";

export type AdminStatusInput = Readonly<{
  datasets: readonly Readonly<{
    active: Readonly<{
      capturedAt: Date;
      coveredThroughRank: number | null;
    }> | null;
    dataset: AdminDatasetKey;
    hasUnpublishedDraft: boolean;
    isFinal: boolean;
  }>[];
  standings: Readonly<{ capturedAt: Date; isFinal: boolean }> | null;
  winStreak: Readonly<{ matchweek: number; readyToResolve: boolean }> | null;
}>;

export type AdminStatusRow = Readonly<{
  actionLabel: string;
  attention: boolean;
  draft: string;
  href: string;
  key: string;
  label: string;
  publicVersion: string;
}>;

const DATASET_LABELS: Record<AdminDatasetKey, string> = {
  assists: "Assists",
  clean_sheets: "Clean sheets",
  goals: "Goals",
  player_ratings: "Player ratings",
};

const DATASET_ORDER: readonly AdminDatasetKey[] = [
  "goals",
  "assists",
  "clean_sheets",
  "player_ratings",
];

export function buildAdminStatusRows(
  input: AdminStatusInput,
): AdminStatusRow[] {
  const rows: AdminStatusRow[] = [
    {
      actionLabel: "Import standings",
      attention: input.standings === null,
      draft: "—",
      href: "/admin/standings",
      key: "standings",
      label: "Standings",
      publicVersion: input.standings
        ? `${formatLeagueDateTime(input.standings.capturedAt)}${input.standings.isFinal ? " · Final" : ""}`
        : "None",
    },
  ];

  for (const key of DATASET_ORDER) {
    const dataset = input.datasets.find(
      (candidate) => candidate.dataset === key,
    );
    const active = dataset?.active ?? null;
    const hasDraft = dataset?.hasUnpublishedDraft ?? false;
    rows.push({
      actionLabel: hasDraft
        ? "Review & publish"
        : active
          ? "Update"
          : "Enter results",
      attention: hasDraft || active === null,
      draft: hasDraft ? "Saved draft not published" : "—",
      href: "/admin/results",
      key,
      label: DATASET_LABELS[key],
      publicVersion: active
        ? [
            formatLeagueDateTime(active.capturedAt),
            active.coveredThroughRank
              ? `to rank ${active.coveredThroughRank}`
              : null,
            dataset?.isFinal ? "Final" : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : "Not published",
    });
  }

  rows.push(
    input.winStreak
      ? {
          actionLabel: input.winStreak.readyToResolve
            ? "Resolve round"
            : "Waiting for kickoffs",
          attention: input.winStreak.readyToResolve,
          draft: "—",
          href: "/admin/win-streak",
          key: "win-streak",
          label: `Win Streak MW${input.winStreak.matchweek}`,
          publicVersion: "Unresolved",
        }
      : {
          actionLabel: "Open",
          attention: false,
          draft: "—",
          href: "/admin/win-streak",
          key: "win-streak",
          label: "Win Streak",
          publicVersion: "All rounds resolved",
        },
  );

  return rows;
}

export function AdminStatusBoard({
  rows,
}: {
  rows: readonly AdminStatusRow[];
}) {
  return (
    <section aria-labelledby="dataset-status-heading" className="grid gap-3">
      <h2 className="text-xl font-bold" id="dataset-status-heading">
        Dataset status
      </h2>
      <div className="border-border bg-surface overflow-x-auto rounded-xl border">
        <table
          aria-label="Dataset status"
          className="w-full min-w-[34rem] text-left text-sm"
        >
          <thead className="text-muted text-[0.65rem] font-black tracking-wide uppercase">
            <tr>
              <th className="px-3 py-2" scope="col">
                Dataset
              </th>
              <th className="px-3 py-2" scope="col">
                Public version
              </th>
              <th className="px-3 py-2" scope="col">
                Draft
              </th>
              <th className="px-3 py-2" scope="col">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-border border-t" key={row.key}>
                <th className="px-3 py-2.5 font-bold" scope="row">
                  {row.label}
                </th>
                <td className="text-muted px-3 py-2.5">{row.publicVersion}</td>
                <td className="text-muted px-3 py-2.5">{row.draft}</td>
                <td className="px-3 py-2.5">
                  {row.attention ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="bg-warning mr-2 inline-block size-2 rounded-full"
                      />
                      <span className="sr-only">Needs attention</span>
                    </>
                  ) : null}
                  <Link
                    className="text-brand-ink inline-flex min-h-11 items-center font-semibold underline"
                    href={row.href}
                  >
                    {row.actionLabel}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Query and render on `src/app/admin/page.tsx`** (read-only).

1. Add these imports: `and, asc, isNull, max` from `drizzle-orm`; `spotlightResultSnapshots, spotlightResultStates, winStreakFixtures, winStreakRounds` from `@/db/schema`; `isSpotlightResultDataset` from `@/features/results`; `AdminStatusBoard, buildAdminStatusRows, type AdminDatasetKey` from `@/features/admin/status-board`.
2. Extend the existing `Promise.all` with two more reads:

```ts
    db
      .select({
        activeCapturedAt: spotlightResultSnapshots.capturedAt,
        activeCoveredThroughRank: spotlightResultSnapshots.coveredThroughRank,
        activeSnapshotId: spotlightResultStates.activeSnapshotId,
        dataset: spotlightResultStates.dataset,
        finalSnapshotId: spotlightResultStates.finalSnapshotId,
        workingSnapshotId: spotlightResultStates.workingSnapshotId,
      })
      .from(spotlightResultStates)
      .leftJoin(
        spotlightResultSnapshots,
        eq(spotlightResultSnapshots.id, spotlightResultStates.activeSnapshotId),
      )
      .where(eq(spotlightResultStates.seasonId, season.id)),
    db
      .select({
        lastKickoffAt: max(winStreakFixtures.kickoffAt),
        matchweek: winStreakRounds.matchweek,
      })
      .from(winStreakRounds)
      .leftJoin(winStreakFixtures, eq(winStreakFixtures.roundId, winStreakRounds.id))
      .where(
        and(
          eq(winStreakRounds.seasonId, season.id),
          isNull(winStreakRounds.resolvedAt),
        ),
      )
      .groupBy(winStreakRounds.id, winStreakRounds.matchweek)
      .orderBy(asc(winStreakRounds.matchweek))
      .limit(1),
```

Destructure them as `resultStates` and `nextRounds`.

3. After `const latestRun = …`, build the rows:

```ts
const nextRound = nextRounds[0];
const statusRows = buildAdminStatusRows({
  datasets: resultStates.flatMap((state) =>
    isSpotlightResultDataset(state.dataset)
      ? [
          {
            active:
              state.activeSnapshotId && state.activeCapturedAt
                ? {
                    capturedAt: state.activeCapturedAt,
                    coveredThroughRank: state.activeCoveredThroughRank,
                  }
                : null,
            dataset: state.dataset as AdminDatasetKey,
            hasUnpublishedDraft:
              state.workingSnapshotId !== null &&
              state.workingSnapshotId !== state.activeSnapshotId,
            isFinal:
              state.finalSnapshotId !== null &&
              state.finalSnapshotId === state.activeSnapshotId,
          },
        ]
      : [],
  ),
  standings: activeSnapshot
    ? {
        capturedAt:
          season.standingsAcceptedThrough ?? activeSnapshot.capturedAt,
        isFinal: activeSnapshot.isFinal,
      }
    : null,
  winStreak: nextRound
    ? {
        matchweek: nextRound.matchweek,
        readyToResolve:
          nextRound.lastKickoffAt !== null &&
          new Date(nextRound.lastKickoffAt).getTime() <= databaseNow.getTime(),
      }
    : null,
});
```

4. Render `<AdminStatusBoard rows={statusRows} />` directly after the `Season status` section.

- [ ] **Step 4: Plain intro on `src/app/admin/results/page.tsx`.** Replace the paragraph text `Enter reviewed season outcomes row by row. Draft snapshots stay private; publishing moves one exact immutable snapshot into public scoring, and final status can only be undone against that same active pointer.` with `Enter a result list, check it against everyone’s picks, then publish it. Drafts stay private until you publish.` Change nothing else in that file.

- [ ] **Step 5: `src/app/admin/admin-nav.tsx`.** In the active link class `bg-brand text-white`, append `dark:ring-1 dark:ring-accent-blue`. Change nothing else.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/components/admin-status-board.test.tsx tests/unit/admin-controls.test.tsx tests/unit/admin-win-streak-route.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/admin/status-board.tsx src/app/admin/page.tsx src/app/admin/results/page.tsx src/app/admin/admin-nav.tsx
git commit -m "Owner desk: dataset status board and plain-language results intro"
```

---

### Task 12: Browser-test contract updates (the only permitted test edits)

**Files:** Modify `tests/e2e/post-kickoff-leaderboard.spec.ts` only.

- [ ] **Step 1: Add a helper** directly after the existing `expectNoHorizontalOverflow` function (around line 119):

```ts
async function expectNoMidWordBreaks(
  locator: import("@playwright/test").Locator,
) {
  const broken = await locator.evaluateAll((elements) => {
    const failures: string[] = [];
    for (const element of elements) {
      for (const node of Array.from(element.childNodes)) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        const text = node.textContent ?? "";
        for (const match of text.matchAll(/\S+/gu)) {
          const range = document.createRange();
          range.setStart(node, match.index ?? 0);
          range.setEnd(node, (match.index ?? 0) + match[0].length);
          const lineTops = new Set(
            Array.from(range.getClientRects()).map((rect) =>
              Math.round(rect.top),
            ),
          );
          if (lineTops.size > 1) failures.push(match[0]);
        }
      }
    }
    return failures;
  });
  expect(broken, "Club names must wrap between words only.").toEqual([]);
}
```

- [ ] **Step 2: Use the helper on the season table.** Directly after the `expectNoHorizontalOverflow(page);` that follows `page.getByRole("table", { name: "Premier League season table" })` (around line 462), add:

```ts
await expectNoMidWordBreaks(page.locator("[data-club-name]"));
```

- [ ] **Step 3: Replace the category switch.** Replace these four lines:

```ts
await page
  .getByRole("combobox", { name: "Category", exact: true })
  .selectOption("underdog_team");
await page.getByRole("button", { name: "Show category" }).click();
```

with:

```ts
await page
  .getByRole("navigation", { name: "Choose a spotlight category" })
  .getByRole("link", { name: "Underdog team", exact: true })
  .click();
await page.waitForURL(/[?&]category=underdog_team(?:&|$)/u);
```

- [ ] **Step 4: Replace the matrix row count.** Replace:

```ts
await expect(
  page.getByRole("table", { name: /seven spotlight picks/i }).getByRole("row"),
).toHaveCount(3);
```

with:

```ts
if ((page.viewportSize()?.width ?? 1280) < 640) {
  await expect(
    page
      .getByRole("list", { name: "Picks by entry" })
      .getByRole("listitem", { name: /spotlight picks$/u }),
  ).toHaveCount(2);
} else {
  await expect(
    page
      .getByRole("table", { name: /seven spotlight picks/i })
      .getByRole("row"),
  ).toHaveCount(3);
}
```

- [ ] **Step 5: Replace the leaderboard search.** Replace:

```ts
await page.getByLabel("Find a participant").fill(swappedName);
await page.getByRole("button", { name: "Find", exact: true }).click();
```

with:

```ts
await page.getByLabel("Find a participant").fill(swappedName);
```

Then, a few lines below, replace:

```ts
await page.getByRole("link", { name: "Clear", exact: true }).click();
```

with:

```ts
await page.getByRole("button", { name: "Clear", exact: true }).click();
```

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/post-kickoff-leaderboard.spec.ts
git commit -m "Update post-kickoff browser contract for one-tap filters and mobile matrix"
```

---

### Task 13: Documentation, walkthrough captures, full verification, release

**Files:** `DESIGN.md`, `AGENTS.md`, `docs/QA.md`, the generated `*.html` peers, `public/how-to-play/step-1-table-mobile.png`, and `public/how-to-play/step-2-spotlight-mobile.png`.

- [ ] **Step 1: Update `DESIGN.md`.** Edit these sections in place and do not add others.

- **Layout.** Replace the sentence "The header contains a compact brand row and a separate row of five navigation links." with: "From 640px the header contains a compact brand row and a row of five text links. Below 640px the header is one brand row and a fixed bottom tab bar (Table, Leaderboard, Spotlight, Streak, Rules; 56px targets; safe-area padded) replaces the text links. Sticky action bars offset themselves by `--mobile-tab-bar-height`."
- **Semantic colors.** Replace the comparison-gap sentence with: "Comparison gaps use a diverging scale: neutral under one place, then slight (1–3), clear (3–8), and far (8+), green above expectation and crimson below. Table points use one ordinal scale everywhere: Exact (strong green), Within 3 (mint), Correct half (lilac), No points (neutral). Danger red is reserved for errors and negative movement. The tokens are `--gap-*` and `--score-*` in `globals.css`."
- **Podium.** Add: "The podium is a compact side-by-side strip on every width; the full ranked table below it remains the complete accessible list."
- **Components → Navigation.** Add the bottom tab bar, and note that the owner pages show only a "View public site" link.

- [ ] **Step 2: Update `AGENTS.md` → "Interface direction".** Append one sentence: "The September 22 UX refresh adds a mobile bottom tab bar, one-tap Spotlight category chips, an instant leaderboard filter, a scored entry summary with compare and previous/next, tabbed Rules, and a Win Streak countdown with day-grouped kickoffs; `docs/superpowers/specs/2026-09-22-ux-audit.html` records the approved direction." Change nothing else.

- [ ] **Step 3: Add a section at the top of `docs/QA.md`** titled `## September 22 UX refresh`. Include one paragraph linking the spec, and a table with exactly these gates: Red-green tests, Full unit and component suite, Isolated integration, Static checks, Production build, Browser journeys, Walkthrough captures, Accessibility, and Production release. **Fill each cell with the real command output from Steps 5–9 below (counts, pass or fail, commit and deployment IDs). Do not write a result you did not observe.** Leave a gate's cell as `Not run: <reason>` if you could not run it.

- [ ] **Step 4: Regenerate documentation peers**

Run: `npm run docs:generate && npm run docs:check`
Expected: `docs:check` exits 0.

- [ ] **Step 5: Run the finish-line test command** (from "The tests" above).
      Expected: every listed file passes, with no failures.

- [ ] **Step 6: Run the static gates and the full unit suite**

```bash
npm run format:check && npm run lint && npm run typecheck && npm test
```

Expected: all exit 0. If `format:check` fails, run `npx prettier --write` on **only the files you changed**, then re-run. Do not reformat unrelated files.

- [ ] **Step 7: Run the isolated integration suite and the production build**

```bash
npm run test:integration && npm run build:verify
```

Expected: both exit 0. Integration needs `TEST_DATABASE_URL` or `TEST_DATABASE_NAME` in `.env.local`. If neither is configured, stop and ask the owner; do not point it at production.

- [ ] **Step 8: Refresh the walkthrough images and run every browser journey**

Implementation correction from exact-width browser verification: track and cancel the searchable selector’s delayed pointer-selection timer when a click completes, the picker opens or closes, or the component unmounts. The 320px journey selected Other player and immediately opened the next club picker, but the old 100ms callback then focused the Other-name field again and closed the club picker. Keep the immediate pointer-down selection and delayed fallback for browsers that cancel click. The tests stay unchanged.

Verification sequencing: after the pre-kickoff phase failed, run the existing `npm run test:e2e:post-kickoff` script separately through the same isolated-database wrapper to complete its independent checks. No browser test is skipped or weakened.

Contract conflict resolved by owner authorization on 2026-09-22: the owner approved a one-time addition to Task 12’s edit allowlist for two browser tests. In `tests/e2e/app-journey.spec.ts`, select the Spotlight tab and assert its selected state before checking its heading and participant-facing 14-entry scoring example; assert that the old `max(0, N + 1` formula is absent. Preserve the default Table tab checks, three screenshots, automation-text exclusion, and overflow check. In `tests/e2e/mobile-reflow-privacy.spec.ts`, change both entry-club and leaderboard-name expectations from `overflowWrap: "anywhere"` to `"break-word"`; preserve the other style and overflow assertions. No other edits under `tests/` are authorized. Re-run the complete check and the separate post-kickoff suite; stop and report any additional failure.

Follow-up fixes confirmed by the owner on 2026-09-22, beyond the allowlist above: the desktop Rules locator gained `exact: true` because “Worked example · Top scorer” also matched. The 320px reflow test then exposed a 342px entry page: `break-words` does not lower min-content width, so `PageHeading`’s `<header>` now has `min-w-0`, and the unit test in `tests/components/site-shell.test.tsx` checks for that class.

```bash
QA_SCREENSHOT_DIR=output/qa/ux-refresh-2026-09 LOCAL_HTTP_E2E=1 npm run test:e2e
```

Expected: every project passes (existing intentional skips remain skipped). This rewrites `public/how-to-play/step-1-table-mobile.png`, `step-2-spotlight-mobile.png`, and `step-3-review-mobile.png` from the new UI. Open each image and confirm it shows the compact Stage 1 (name field, one-line A–Z banner, several clubs visible) and the Stage 2 progress dots. Record the cleanup evidence the suites print in `docs/QA.md`.

- [ ] **Step 9: Run `npm run check`**

Invocation note: use `npm run check` without a global `LOCAL_HTTP_E2E=1` prefix. The npm script already scopes that flag to its browser phase. Applying it to the whole command changes the production-cookie/CSP unit-test environment and caused four unrelated security assertions to fail; do not change those tests or security code.
Expected: exit 0. This is the repository's complete Definition-of-Done gate from `AGENTS.md`.

- [ ] **Step 10: Commit**

```bash
git add DESIGN.md DESIGN.html AGENTS.md AGENTS.html docs/QA.md docs/QA.html docs/superpowers public/how-to-play
git commit -m "Record September 22 UX refresh design, QA evidence, and walkthrough captures"
```

- [ ] **Step 11: Release, following `AGENTS.md`.** Push `vishal/ux-refresh-2026-09`, open a PR to `main` titled `September 22 UX refresh`, and wait for the Vercel checks to pass. Merge, then wait for the production deployment to be Ready on `pl-predictions-2026.vercel.app`. Run the read-only production smoke:

```bash
npm run test:production-smoke
```

Expected: all five projects pass. Then run `git checkout main && git pull --ff-only`, confirm local `main` equals the merge commit, and fill the "Production release" row in `docs/QA.md` in a follow-up commit on a new branch using the same PR flow. Never run `test:production-write-smoke`.

---

## Win conditions (all must be true)

1. Every test file in "The tests" passes, and no test file anywhere was added, removed, renamed, skipped, or edited, apart from the Task 12 edits.
2. `npm run check` exits 0 on the final branch head.
3. `grep -rn "overflow-wrap:anywhere" src/features/standings/season-table-page.tsx src/features/leaderboard src/app/entries src/features/win-streak/win-streak-leaderboard.tsx src/components/page-heading.tsx` prints nothing.
4. `grep -rn "Show category\|Select to see names\|Current data status\|max(0, N" src` prints nothing.
5. `git diff main --stat -- drizzle src/db scripts src/features/scoring src/features/results src/app/actions` prints nothing.
6. The production smoke passes against the merged deployment, and `docs/QA.md` records the real results.

## Out of scope (do not build)

- A "You" pin on the leaderboard and a "Your prediction" season-table column. These need the `/entries`-scoped receipt cookie widened, which is a privacy decision for the owner.
- Any change to scoring, ranking, tie rules, deadlines, the Win Streak rules, or data publication.
- New analytics, animations, themes, fonts, or icons beyond the lucide icons named here.
