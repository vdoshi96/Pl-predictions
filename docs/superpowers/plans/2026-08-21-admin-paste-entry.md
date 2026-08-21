# Admin Paste Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner paste league-table text into `/admin/standings` and spotlight result lists into `/admin/results`, seed result datasets from submitted picks, and publish through one combined review+attest+publish dialog.

**Architecture:** Pure parser/diff modules with unit tests feed the existing validated server actions (`saveManualStandings`, `saveSpotlightResultDraft`, `publishSpotlightResult`) unchanged. New client components render parse previews, diffs, and the combined dialog. A new server-only query supplies picked subjects for seeding. No schema, scoring, or endpoint changes.

**Tech Stack:** Next.js 16 App Router, TypeScript, React server actions, zod, Drizzle/Neon, vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-21-admin-paste-entry-design.md`

---

## Before you start

1. Read `AGENTS.md`. Read the relevant guides under `node_modules/next/dist/docs/` before touching app code — this Next.js version has breaking changes vs. your training data.
2. Repo code style: NO comments in code. ESLint runs with `--max-warnings=0`.
3. Never read or write the legacy `submission_deadline` column.
4. Run tests with `npx vitest run <file>`. Full suites: `npm test`, `npm run test:integration` (needs `TEST_DATABASE_URL` or local-only `TEST_DATABASE_NAME`; use `npm run db:test:migrate` / `npm run db:test:seed`), `npm run test:e2e`.
5. Work on branch `feature/admin-paste-entry`.

## File structure

Create:

- `src/shared/text-normalization.ts` — shared name normalizer
- `src/data/team-name-aliases.ts` — curated alias map + team name index builder
- `src/features/standings/table-paste-parser.ts` — pasted table text → parsed rows
- `src/features/standings/table-diff.ts` — parsed rows vs active snapshot diff
- `src/features/standings/standings-paste-panel.tsx` — client panel on standings page
- `src/features/results/boundary-ties.ts` — tie-straddle warnings + coverage helper
- `src/features/results/list-paste-parser.ts` — pasted list text → parsed rows
- `src/features/results/dataset-diff.ts` — draft vs published snapshot diff
- `src/features/results/seed-queries.ts` — server-only picked-subjects query
- `src/app/admin/results/results-paste-panel.tsx` — client paste panel per dataset
- `src/app/admin/results/publish-review-dialog.tsx` — combined review dialog
- Tests under `tests/unit/`, `tests/components/`, `tests/integration/`, `tests/e2e/`

Modify:

- `src/app/admin/standings/page.tsx` — mount paste panel
- `src/app/admin/results/page.tsx` — load picked subjects + published rows; pass to desk
- `src/app/admin/results/results-desk.tsx` — seed button, paste panels, review dialog replaces save/attest/publish cluster
- `tests/components/spotlight-results-desk.test.tsx` — fixtures for new props

---

### Task 1: Feature branch

- [ ] **Step 1: Create the branch**

```bash
git checkout main && git pull && git checkout -b feature/admin-paste-entry
```

---

### Task 2: Shared text normalization

**Files:**

- Create: `src/shared/text-normalization.ts`
- Test: `tests/unit/text-normalization.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import { normalizeForMatch } from "@/shared/text-normalization";

describe("normalizeForMatch", () => {
  it("lowercases and strips punctuation and diacritics", () => {
    expect(normalizeForMatch("Man City")).toBe("man city");
    expect(normalizeForMatch("Brighton & Hove Albion")).toBe(
      "brighton and hove albion",
    );
    expect(normalizeForMatch("Nott'm Forest")).toBe("nott m forest");
    expect(normalizeForMatch("  Crystal---Palace! ")).toBe("crystal palace");
  });

  it("collapses whitespace and returns empty for symbols only", () => {
    expect(normalizeForMatch("--- *** ---")).toBe("");
    expect(normalizeForMatch("A  B")).toBe("a b");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/text-normalization.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
export function normalizeForMatch(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/text-normalization.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/text-normalization.ts tests/unit/text-normalization.test.ts
git commit -m "feat: add shared match-name normalizer"
```

---

### Task 3: Team name index with curated aliases

**Files:**

- Create: `src/data/team-name-aliases.ts`
- Test: `tests/unit/team-name-aliases.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { PREMIER_LEAGUE_2026_27_TEAMS } from "@/data";
import { buildTeamNameIndex } from "@/data/team-name-aliases";
import { describe, expect, it } from "vitest";

describe("buildTeamNameIndex", () => {
  const index = buildTeamNameIndex(PREMIER_LEAGUE_2026_27_TEAMS);

  it("resolves canonical display names case-insensitively", () => {
    expect(index.get("manchester city")).toBe("manchester-city");
    expect(index.get("brighton & hove albion")).toBe(
      "brighton-and-hove-albion",
    );
  });

  it("resolves short names and curated aliases", () => {
    expect(index.get("spurs")).toBe("tottenham-hotspur");
    expect(index.get("man utd")).toBe("manchester-united");
    expect(index.get("villa")).toBe("aston-villa");
    expect(index.get("palace")).toBe("crystal-palace");
  });

  it("never maps a key to two slugs and contains exactly the active clubs", () => {
    const slugs = new Set(index.values());
    expect(slugs.size).toBe(20);
    for (const slug of slugs) {
      expect(
        PREMIER_LEAGUE_2026_27_TEAMS.some((team) => team.slug === slug),
      ).toBe(true);
    }
  });

  it("returns undefined for unknown clubs", () => {
    expect(index.get("bayern munich")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/team-name-aliases.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
import { normalizeForMatch } from "@/shared/text-normalization";

export type TeamNameSource = Readonly<{
  displayName: string;
  shortName: string;
  slug: string;
  sortName: string;
}>;

const CURATED_ALIASES: Readonly<Record<string, string>> = {
  spurs: "tottenham-hotspur",
  "man utd": "manchester-united",
  villa: "aston-villa",
  palace: "crystal-palace",
  bournemouth: "afc-bournemouth",
  brighton: "brighton-and-hove-albion",
  coventry: "coventry-city",
  hull: "hull-city",
  ipswich: "ipswich-town",
  leeds: "leeds-united",
  newcastle: "newcastle-united",
};

export function buildTeamNameIndex(
  teams: readonly TeamNameSource[],
): ReadonlyMap<string, string> {
  const index = new Map<string, string>();
  const put = (name: string, slug: string) => {
    const key = normalizeForMatch(name);
    if (!key || index.has(key)) return;
    index.set(key, slug);
  };
  for (const team of teams) put(team.displayName, team.slug);
  for (const team of teams) {
    put(team.shortName, team.slug);
    put(team.sortName, team.slug);
  }
  for (const [alias, slug] of Object.entries(CURATED_ALIASES)) {
    if (teams.some((team) => team.slug === slug)) put(alias, slug);
  }
  return index;
}
```

Note: canonical names are inserted first so an alias can never override them (`index.has` guard). Ambiguous words like "united" or "city" are deliberately absent.

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/team-name-aliases.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/team-name-aliases.ts tests/unit/team-name-aliases.test.ts
git commit -m "feat: add team name alias index"
```

---

### Task 4: Standings table paste parser

**Files:**

- Create: `src/features/standings/table-paste-parser.ts`
- Test: `tests/unit/table-paste-parser.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { PREMIER_LEAGUE_2026_27_TEAMS } from "@/data";
import { parsePastedStandingsTable } from "@/features/standings/table-paste-parser";
import { describe, expect, it } from "vitest";

const teams = PREMIER_LEAGUE_2026_27_TEAMS;

describe("parsePastedStandingsTable", () => {
  it("parses a full table with positions, played, and points", () => {
    const text = [
      "1 Liverpool 8 20",
      "2 Arsenal 8 18",
      "3 Manchester City 8 17",
      "Aston Villa 8 15",
      "5 Chelsea 7 14",
    ].join("\n");
    const parsed = parsePastedStandingsTable(text, teams);
    const ok = parsed.rows.filter((row) => row.status === "ok");
    expect(ok).toHaveLength(5);
    expect(ok[0]).toMatchObject({
      teamSlug: "liverpool",
      actualPosition: 1,
      playedGames: 8,
      leaguePoints: 20,
    });
    expect(parsed.positionsInferred).toBe(false);
  });

  it("infers positions from row order when the position column is absent", () => {
    const text = ["Liverpool 8 20", "Arsenal 8 18"].join("\n");
    const parsed = parsePastedStandingsTable(text, teams);
    expect(parsed.positionsInferred).toBe(true);
    const ok = parsed.rows.filter((row) => row.status === "ok");
    expect(ok[0].actualPosition).toBe(1);
    expect(ok[1].actualPosition).toBe(2);
  });

  it("resolves aliases and short names", () => {
    const parsed = parsePastedStandingsTable(
      ["1 Spurs 8 16", "2 Man Utd 8 12"].join("\n"),
      teams,
    );
    const ok = parsed.rows.filter((row) => row.status === "ok");
    expect(ok.map((row) => row.teamSlug)).toEqual([
      "tottenham-hotspur",
      "manchester-united",
    ]);
  });

  it("flags unknown clubs without dropping the line", () => {
    const parsed = parsePastedStandingsTable(
      ["1 Liverpool 8 20", "1 Bayern Munich 6 18"].join("\n"),
      teams,
    );
    expect(parsed.rows[1].status).toBe("unknown-club");
    expect(parsed.rows[1].rawLine).toBe("1 Bayern Munich 6 18");
  });

  it("skips header lines and records that numbers are header-classified", () => {
    const text = ["Pos Club P GD Pts", "1 Liverpool 8 20"].join("\n");
    const parsed = parsePastedStandingsTable(text, teams);
    expect(parsed.headerDetected).toBe(true);
    const ok = parsed.rows.filter((row) => row.status === "ok");
    expect(ok[0].numbersLowConfidence).toBe(false);
  });

  it("marks heuristic numbers low-confidence when no header exists", () => {
    const parsed = parsePastedStandingsTable("Liverpool 8 11 20", teams);
    expect(parsed.rows[0].numbersLowConfidence).toBe(true);
    expect(parsed.rows[0].playedGames).toBe(8);
    expect(parsed.rows[0].leaguePoints).toBe(20);
  });

  it("treats a single trailing number as points", () => {
    const parsed = parsePastedStandingsTable("Liverpool 20", teams);
    expect(parsed.rows[0].playedGames).toBeNull();
    expect(parsed.rows[0].leaguePoints).toBe(20);
  });

  it("ignores junk lines with no club or numbers", () => {
    const parsed = parsePastedStandingsTable("--- *** ---", teams);
    expect(parsed.rows).toHaveLength(0);
  });

  it("tolerates thousands separators in numbers", () => {
    const parsed = parsePastedStandingsTable("Liverpool 1,234 2,000", teams);
    expect(parsed.rows[0].playedGames).toBe(1234);
    expect(parsed.rows[0].leaguePoints).toBe(2000);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/table-paste-parser.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
import {
  buildTeamNameIndex,
  type TeamNameSource,
} from "@/data/team-name-aliases";
import { normalizeForMatch } from "@/shared/text-normalization";

export type ParsedStandingsRowStatus = "ok" | "unknown-club" | "ambiguous-club";

export type ParsedStandingsRow = Readonly<{
  rawLine: string;
  status: ParsedStandingsRowStatus;
  teamSlug: string | null;
  teamLabel: string | null;
  actualPosition: number | null;
  playedGames: number | null;
  leaguePoints: number | null;
  numbersLowConfidence: boolean;
}>;

export type ParsedStandingsTable = Readonly<{
  rows: readonly ParsedStandingsRow[];
  ignoredLines: readonly string[];
  positionsInferred: boolean;
  headerDetected: boolean;
}>;

const HEADER_LABELS = new Set([
  "pos",
  "p",
  "pl",
  "played",
  "w",
  "d",
  "l",
  "gf",
  "ga",
  "gd",
  "pts",
  "points",
  "form",
]);

type DraftRow = {
  rawLine: string;
  status: ParsedStandingsRowStatus;
  teamSlug: string | null;
  teamLabel: string | null;
  actualPosition: number | null;
  playedGames: number | null;
  leaguePoints: number | null;
  numbersLowConfidence: boolean;
};

function extractIntegers(line: string): number[] {
  return [...line.matchAll(/\d+(?:,\d{3})*/g)].map((match) =>
    Number(match[0].replaceAll(",", "")),
  );
}

function nameResidue(line: string): string {
  return line
    .replace(/\d+(?:,\d{3})*/g, " ")
    .replace(/[|·•—–:*]/g, " ")
    .trim();
}

function resolveClub(
  residue: string,
  index: ReadonlyMap<string, string>,
):
  | { kind: "matched"; slug: string }
  | { kind: "unknown" }
  | { kind: "ambiguous" } {
  const normalized = normalizeForMatch(residue);
  if (!normalized) return { kind: "unknown" };
  const direct = index.get(normalized);
  if (direct) return { kind: "matched", slug: direct };
  const words = normalized.split(" ").filter(Boolean);
  if (words.length < 2) return { kind: "unknown" };
  const slugs = new Set<string>();
  for (let size = words.length - 1; size >= 2; size -= 1) {
    for (let start = 0; start + size <= words.length; start += 1) {
      const slug = index.get(words.slice(start, start + size).join(" "));
      if (slug) slugs.add(slug);
    }
    if (slugs.size > 1) return { kind: "ambiguous" };
  }
  if (slugs.size === 1) return { kind: "matched", slug: [...slugs][0] };
  return { kind: "unknown" };
}

function classifyNumbers(
  suffixInts: readonly number[],
  headerDetected: boolean,
) {
  if (suffixInts.length === 0) {
    return {
      playedGames: null,
      leaguePoints: null,
      numbersLowConfidence: false,
    };
  }
  if (suffixInts.length === 1) {
    return {
      leaguePoints: suffixInts[0],
      numbersLowConfidence: true,
      playedGames: null,
    };
  }
  return {
    leaguePoints: suffixInts[suffixInts.length - 1],
    numbersLowConfidence: !headerDetected,
    playedGames: suffixInts[0],
  };
}

export function parsePastedStandingsTable(
  text: string,
  teams: readonly TeamNameSource[],
): ParsedStandingsTable {
  const index = buildTeamNameIndex(teams);
  const labelBySlug = new Map(
    teams.map((team) => [team.slug, team.displayName] as const),
  );
  const drafts: DraftRow[] = [];
  const ignoredLines: string[] = [];
  let headerDetected = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const integers = extractIntegers(line);
    const residue = nameResidue(line);
    const residueTokens = normalizeForMatch(residue).split(" ").filter(Boolean);
    if (
      !headerDetected &&
      residueTokens.length >= 2 &&
      residueTokens.every((token) => HEADER_LABELS.has(token))
    ) {
      headerDetected = true;
      continue;
    }
    if (residueTokens.length === 0 && integers.length === 0) continue;

    const resolved = resolveClub(residue, index);
    if (resolved.kind !== "matched") {
      drafts.push({
        rawLine: line,
        status:
          resolved.kind === "ambiguous" ? "ambiguous-club" : "unknown-club",
        teamSlug: null,
        teamLabel: residue || null,
        actualPosition: null,
        playedGames: null,
        leaguePoints: null,
        numbersLowConfidence: true,
      });
      continue;
    }

    const leading =
      integers.length > 0 && integers[0] >= 1 && integers[0] <= 20
        ? integers[0]
        : null;
    const metrics = leading !== null ? integers.slice(1) : integers;
    drafts.push({
      rawLine: line,
      status: "ok",
      teamSlug: resolved.slug,
      teamLabel: labelBySlug.get(resolved.slug) ?? null,
      actualPosition: leading,
      ...classifyNumbers(metrics, headerDetected),
    });
  }

  const clubRows = drafts.filter((row) => row.status === "ok");
  const explicitPositions =
    clubRows.length > 0 && clubRows.every((row) => row.actualPosition !== null);
  const positionsInferred = !explicitPositions;
  if (positionsInferred) {
    let position = 0;
    for (const row of drafts) {
      if (row.status !== "ok") continue;
      position += 1;
      row.actualPosition = position;
    }
  }

  return {
    headerDetected,
    ignoredLines,
    positionsInferred,
    rows: drafts.map(({ ...row }) => ({ ...row })),
  };
}
```

Note on ambiguity rule: word-window matching only fires for phrases of 2+ words; single leftover words never match, so "united"/"city" cannot silently resolve. Multiple distinct window hits → `ambiguous-club`.

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/table-paste-parser.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/standings/table-paste-parser.ts tests/unit/table-paste-parser.test.ts
git commit -m "feat: add standings table paste parser"
```

---

### Task 5: Standings diff

**Files:**

- Create: `src/features/standings/table-diff.ts`
- Test: `tests/unit/table-diff.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { buildStandingsDiff } from "@/features/standings/table-diff";
import { describe, expect, it } from "vitest";

describe("buildStandingsDiff", () => {
  const activeItems = [
    {
      teamSlug: "liverpool",
      actualPosition: 1,
      playedGames: 7,
      leaguePoints: 19,
    },
    {
      teamSlug: "arsenal",
      actualPosition: 2,
      playedGames: 7,
      leaguePoints: 16,
    },
  ];
  const labelBySlug = new Map([
    ["liverpool", "Liverpool"],
    ["arsenal", "Arsenal"],
  ] as const);

  it("reports unchanged rows as not changed", () => {
    const diff = buildStandingsDiff({
      activeItems,
      labelBySlug,
      newItems: [
        {
          teamSlug: "liverpool",
          actualPosition: 1,
          playedGames: 7,
          leaguePoints: 19,
        },
        {
          teamSlug: "arsenal",
          actualPosition: 2,
          playedGames: 7,
          leaguePoints: 16,
        },
      ],
    });
    expect(diff.movedCount).toBe(0);
    expect(diff.rows.every((row) => !row.changed)).toBe(true);
  });

  it("reports position and number changes", () => {
    const diff = buildStandingsDiff({
      activeItems,
      labelBySlug,
      newItems: [
        {
          teamSlug: "arsenal",
          actualPosition: 1,
          playedGames: 8,
          leaguePoints: 19,
        },
        {
          teamSlug: "liverpool",
          actualPosition: 2,
          playedGames: 8,
          leaguePoints: 19,
        },
      ],
    });
    expect(diff.movedCount).toBe(2);
    const arsenal = diff.rows.find((row) => row.teamSlug === "arsenal");
    expect(arsenal).toMatchObject({
      oldPosition: 2,
      newPosition: 1,
      oldPlayed: 7,
      newPlayed: 8,
    });
  });

  it("lists missing teams present in the active snapshot", () => {
    const diff = buildStandingsDiff({
      activeItems,
      labelBySlug,
      newItems: [
        {
          teamSlug: "liverpool",
          actualPosition: 1,
          playedGames: 7,
          leaguePoints: 19,
        },
      ],
    });
    expect(diff.missingTeams).toEqual(["arsenal"]);
  });

  it("sorts rows by new position", () => {
    const diff = buildStandingsDiff({
      activeItems,
      labelBySlug,
      newItems: [
        {
          teamSlug: "arsenal",
          actualPosition: 1,
          playedGames: 7,
          leaguePoints: 16,
        },
        {
          teamSlug: "liverpool",
          actualPosition: 2,
          playedGames: 7,
          leaguePoints: 19,
        },
      ],
    });
    expect(diff.rows.map((row) => row.teamSlug)).toEqual([
      "arsenal",
      "liverpool",
    ]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/table-diff.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
export type DiffInputItem = Readonly<{
  actualPosition: number;
  leaguePoints: number | null;
  playedGames: number | null;
  teamSlug: string;
}>;

export type StandingsDiffRow = Readonly<{
  changed: boolean;
  newPosition: number;
  newPlayed: number | null;
  newPoints: number | null;
  oldPosition: number | null;
  oldPlayed: number | null;
  oldPoints: number | null;
  teamLabel: string;
  teamSlug: string;
}>;

export type StandingsDiff = Readonly<{
  addedTeams: readonly string[];
  missingTeams: readonly string[];
  movedCount: number;
  rows: readonly StandingsDiffRow[];
}>;

export function buildStandingsDiff({
  activeItems,
  labelBySlug,
  newItems,
}: {
  activeItems: readonly DiffInputItem[];
  labelBySlug: ReadonlyMap<string, string>;
  newItems: readonly DiffInputItem[];
}): StandingsDiff {
  const oldBySlug = new Map(
    activeItems.map((item) => [item.teamSlug, item] as const),
  );
  const newSlugs = new Set(newItems.map((item) => item.teamSlug));
  const rows = newItems
    .map((item) => {
      const old = oldBySlug.get(item.teamSlug) ?? null;
      const changed =
        !old ||
        old.actualPosition !== item.actualPosition ||
        old.playedGames !== item.playedGames ||
        old.leaguePoints !== item.leaguePoints;
      return {
        changed,
        newPosition: item.actualPosition,
        newPlayed: item.playedGames,
        newPoints: item.leaguePoints,
        oldPosition: old?.actualPosition ?? null,
        oldPlayed: old?.playedGames ?? null,
        oldPoints: old?.leaguePoints ?? null,
        teamLabel: labelBySlug.get(item.teamSlug) ?? item.teamSlug,
        teamSlug: item.teamSlug,
      };
    })
    .sort((left, right) => left.newPosition - right.newPosition);
  return {
    addedTeams: newItems
      .filter((item) => !oldBySlug.has(item.teamSlug))
      .map((item) => item.teamSlug),
    missingTeams: activeItems
      .filter((item) => !newSlugs.has(item.teamSlug))
      .map((item) => item.teamSlug),
    movedCount: rows.filter((row) => row.changed).length,
    rows,
  };
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/table-diff.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/standings/table-diff.ts tests/unit/table-diff.test.ts
git commit -m "feat: add standings table diff"
```

---

### Task 6: Standings paste panel component

**Files:**

- Create: `src/features/standings/standings-paste-panel.tsx`
- Test: `tests/components/standings-paste-panel.test.tsx`
- Modify: `src/app/admin/standings/page.tsx`

- [ ] **Step 1: Write the failing component test**

```tsx
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StandingsPastePanel } from "@/features/standings/standings-paste-panel";

const teams = [
  { displayName: "Liverpool", id: "t-liv", slug: "liverpool" },
  { displayName: "Arsenal", id: "t-ars", slug: "arsenal" },
];

const activeItems = [
  {
    actualPosition: 1,
    leaguePoints: 19,
    playedGames: 7,
    teamSlug: "liverpool",
  },
  { actualPosition: 2, leaguePoints: 16, playedGames: 7, teamSlug: "arsenal" },
];

afterEach(cleanup);

function renderPanel(
  onSubmit = vi.fn().mockResolvedValue({ ok: true, message: "Saved." }),
) {
  render(
    <StandingsPastePanel
      activeItems={activeItems}
      disabled={false}
      onSubmit={onSubmit}
      teams={teams}
    />,
  );
  return onSubmit;
}

describe("StandingsPastePanel", () => {
  it("parses pasted text and shows a preview with statuses", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText("Pasted table text"), {
      target: { value: "1 Liverpool 8 20\n2 Arsenal 8 18" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Parse table" }));
    expect(screen.getByText("Liverpool")).toBeTruthy();
    expect(screen.getAllByRole("cell", { name: "OK" })).toHaveLength(2);
  });

  it("blocks confirm while clubs are missing and lists problems", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText("Pasted table text"), {
      target: { value: "1 Liverpool 8 20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Parse table" }));
    expect(screen.getByText(/Parsed 1 of 20 clubs/)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "Save pasted table" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("blocks confirm on unknown club lines", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText("Pasted table text"), {
      target: { value: "1 Bayern Munich 8 20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Parse table" }));
    expect(screen.getByText(/Unknown club/)).toBeTruthy();
  });

  it("submits the validated payload through onSubmit and clears on success", async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      ok: true,
      message: "The validated provisional table is now active.",
    });
    render(
      <StandingsPastePanel
        activeItems={activeItems}
        disabled={false}
        onSubmit={onSubmit}
        teams={[
          ...teams,
          { displayName: "Aston Villa", id: "t-avl", slug: "aston-villa" },
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Pasted table text"), {
      target: { value: "1 Liverpool 8 20\n2 Arsenal 8 18\n3 Aston Villa 8 15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Parse table" }));
    fireEvent.click(screen.getByRole("button", { name: "Save pasted table" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].standings[0]).toEqual({
      teamSlug: "liverpool",
      actualPosition: 1,
      playedGames: 8,
      leaguePoints: 20,
    });
    await waitFor(() =>
      expect(screen.getByText(/validated provisional table/)).toBeTruthy(),
    );
  });

  it("disables everything when disabled is true", () => {
    render(
      <StandingsPastePanel
        activeItems={activeItems}
        disabled
        onSubmit={vi.fn()}
        teams={teams}
      />,
    );
    expect(
      (screen.getByLabelText("Pasted table text") as HTMLTextAreaElement)
        .disabled,
    ).toBe(true);
  });
});
```

Note: this panel test uses a reduced two/three-club team list so the "Parsed N of 20" problem path triggers without needing all 20 clubs in fixtures.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/components/standings-paste-panel.test.tsx`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement the component**

```tsx
"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { PREMIER_LEAGUE_2026_27_TEAM_SLUGS } from "@/data";
import { createStandingsItemsSchema } from "@/features/standings/validation";
import type {
  ManualStandingsPayload,
  ManualStandingsResult,
} from "./manual-standings-form";
import { parsePastedStandingsTable } from "./table-paste-parser";
import { buildStandingsDiff } from "./table-diff";

const payloadSchema = createStandingsItemsSchema(
  PREMIER_LEAGUE_2026_27_TEAM_SLUGS,
);

export type StandingsPastePanelProps = Readonly<{
  activeItems: readonly {
    actualPosition: number;
    leaguePoints: number | null;
    playedGames: number | null;
    teamId: string;
  }[];
  disabled: boolean;
  onSubmit: (payload: ManualStandingsPayload) => Promise<ManualStandingsResult>;
  teams: readonly { displayName: string; id: string; slug: string }[];
}>;

export function StandingsPastePanel({
  activeItems,
  disabled,
  onSubmit,
  teams,
}: StandingsPastePanelProps) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ReturnType<
    typeof parsePastedStandingsTable
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const labelBySlug = useMemo(
    () => new Map(teams.map((team) => [team.slug, team.displayName] as const)),
    [teams],
  );
  const slugByTeamId = useMemo(
    () => new Map(teams.map((team) => [team.id, team.slug] as const)),
    [teams],
  );

  const newItems = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.flatMap((row) =>
      row.status === "ok" && row.teamSlug && row.actualPosition !== null
        ? [
            {
              actualPosition: row.actualPosition,
              leaguePoints: row.leaguePoints,
              playedGames: row.playedGames,
              teamSlug: row.teamSlug,
            },
          ]
        : [],
    );
  }, [parsed]);

  const diff = useMemo(() => {
    if (!parsed) return null;
    return buildStandingsDiff({
      activeItems: activeItems.flatMap((item) => {
        const teamSlug = slugByTeamId.get(item.teamId);
        return teamSlug ? [{ ...item, teamSlug }] : [];
      }),
      labelBySlug,
      newItems,
    });
  }, [activeItems, labelBySlug, newItems, parsed, slugByTeamId]);

  const problems = useMemo(() => {
    if (!parsed) return [] as string[];
    const list: string[] = [];
    for (const row of parsed.rows) {
      if (row.status === "unknown-club") {
        list.push(`Unknown club: “${row.rawLine}”`);
      }
      if (row.status === "ambiguous-club") {
        list.push(`Ambiguous club name: “${row.rawLine}”`);
      }
    }
    if (newItems.length !== 20) {
      list.push(`Parsed ${newItems.length} of 20 clubs.`);
    }
    if (
      !parsed.positionsInferred &&
      new Set(newItems.map((item) => item.actualPosition)).size !==
        newItems.length
    ) {
      list.push("Positions must be unique.");
    }
    if (newItems.length === 20) {
      const check = payloadSchema.safeParse(newItems);
      if (!check.success) {
        list.push(
          check.error.issues[0]?.message ?? "The parsed table is not valid.",
        );
      }
    }
    return list;
  }, [newItems, parsed]);

  async function confirm() {
    if (!parsed || problems.length > 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await onSubmit({ matchweek: null, standings: newItems });
      setMessage(result.message);
      if (result.ok) {
        setText("");
        setParsed(null);
      }
    } catch {
      setMessage("Something went wrong. No changes were made.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="paste-table-title"
      className="rounded-xl border border-slate-200 p-4"
    >
      <h2 className="font-black text-slate-950" id="paste-table-title">
        Paste table
      </h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        Copy any league table as text. Parsing never guesses: unknown or
        ambiguous clubs block saving.
      </p>
      <textarea
        aria-label="Pasted table text"
        className="mt-3 min-h-40 w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 disabled:bg-slate-100"
        disabled={disabled || busy}
        onChange={(event) => {
          setText(event.target.value);
          setParsed(null);
          setMessage(null);
        }}
        rows={8}
        value={text}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          disabled={disabled || busy || text.trim().length === 0}
          onClick={() => setParsed(parsePastedStandingsTable(text, teams))}
          variant="secondary"
        >
          Parse table
        </Button>
        <Button
          disabled={disabled || busy || !parsed || problems.length > 0}
          onClick={() => void confirm()}
        >
          Save pasted table
        </Button>
      </div>
      {message ? (
        <p className="mt-2 text-sm font-semibold text-slate-700" role="status">
          {message}
        </p>
      ) : null}
      {parsed ? (
        <div className="mt-4 grid gap-3">
          {problems.length > 0 ? (
            <ul className="list-disc rounded-xl bg-red-50 p-3 pl-6 text-sm font-semibold text-red-800">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
          {diff ? (
            <p className="text-sm font-semibold text-slate-700" role="status">
              {diff.movedCount} of {diff.rows.length} rows differ from the
              active table.
              {diff.missingTeams.length > 0
                ? ` Missing from paste: ${diff.missingTeams.length}.`
                : ""}
            </p>
          ) : null}
          <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs tracking-wide text-slate-600 uppercase">
                <tr>
                  <th className="px-3 py-2" scope="col">
                    Pos
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Club
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Played
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Points
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsed.rows.map((row) => (
                  <tr key={row.rawLine}>
                    <td className="px-3 py-2">{row.actualPosition ?? "—"}</td>
                    <td className="px-3 py-2">{row.teamLabel ?? "—"}</td>
                    <td className="px-3 py-2">{row.playedGames ?? "—"}</td>
                    <td className="px-3 py-2">{row.leaguePoints ?? "—"}</td>
                    <td className="px-3 py-2 text-xs font-bold" role="cell">
                      {row.status === "ok"
                        ? row.numbersLowConfidence
                          ? "Check numbers"
                          : "OK"
                        : row.status === "unknown-club"
                          ? "Unknown club"
                          : "Ambiguous"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
```

Check `ManualStandingsResult` in `src/features/standings/manual-standings-form.tsx` before wiring — `saveManualStandings` returns `{ ok, message }`; adapt the type import if its shape differs.

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/components/standings-paste-panel.test.tsx`
Expected: PASS

- [ ] **Step 5: Wire into the standings page**

In `src/app/admin/standings/page.tsx`:

```tsx
import { StandingsPastePanel } from "@/features/standings/standings-paste-panel";
```

Render directly above the existing `<ManualStandingsForm …>` card (keep the manual form; both write through the same validated action):

```tsx
<StandingsPastePanel
  activeItems={activeItems}
  disabled={Boolean(activeSnapshot?.isFinal)}
  onSubmit={saveManualStandings}
  teams={teams.map((team) => ({
    displayName: team.displayName,
    id: team.id,
    slug: team.slug,
  }))}
/>
```

`activeItems` already exists in that page with `{ teamId, actualPosition, playedGames, leaguePoints }`; `teams` comes from `getSeasonTeams` and includes `slug`. If `getSeasonTeams` rows lack `slug`, map it the same way `ManualStandingsForm` obtains slugs today.

- [ ] **Step 6: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/features/standings/standings-paste-panel.tsx tests/components/standings-paste-panel.test.tsx src/app/admin/standings/page.tsx
git commit -m "feat: add standings paste panel to admin standings page"
```

---

### Task 7: Boundary ties and coverage helpers

**Files:**

- Create: `src/features/results/boundary-ties.ts`
- Test: `tests/unit/boundary-ties.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {
  evaluateCoverage,
  findBoundaryTieWarnings,
} from "@/features/results/boundary-ties";
import { describe, expect, it } from "vitest";

const rows = (values: number[]) =>
  values.map((metricValue) => ({ metricValue }));

describe("findBoundaryTieWarnings", () => {
  it("returns no warnings when no tie straddles the boundary", () => {
    expect(findBoundaryTieWarnings(rows([9, 8, 7]), 2, "descending")).toEqual(
      [],
    );
  });

  it("warns when a tie group spans rank N", () => {
    const warnings = findBoundaryTieWarnings(
      rows([9, 8, 8, 6]),
      2,
      "descending",
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      tiedCount: 2,
      tiedValue: 8,
      boundaryRank: 2,
    });
  });

  it("warns on ascending direction for overrated views", () => {
    const warnings = findBoundaryTieWarnings(
      rows([4.1, 5.5, 5.5, 6.9]),
      2,
      "ascending",
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ tiedCount: 2, tiedValue: 5.5 });
  });

  it("does not warn when the tie sits fully inside the covered range", () => {
    expect(findBoundaryTieWarnings(rows([9, 9, 7]), 3, "descending")).toEqual(
      [],
    );
  });
});

describe("evaluateCoverage", () => {
  it("reports complete coverage at exactly N rows", () => {
    expect(evaluateCoverage(rows([3, 2, 1]), 3)).toEqual({
      complete: true,
      coveredThroughRank: 3,
      shortfall: 0,
    });
  });

  it("reports shortfall below N", () => {
    expect(evaluateCoverage(rows([3, 2]), 3)).toEqual({
      complete: false,
      coveredThroughRank: 2,
      shortfall: 1,
    });
  });

  it("ignores extra rows beyond N", () => {
    expect(evaluateCoverage(rows([5, 4, 3, 2, 1]), 3).complete).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/boundary-ties.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
export type MetricDirection = "ascending" | "descending";

export type BoundaryTieWarning = Readonly<{
  boundaryRank: number;
  direction: MetricDirection;
  tiedCount: number;
  tiedValue: number;
}>;

function sortedValues(
  rows: readonly { metricValue: number }[],
  direction: MetricDirection,
): number[] {
  return rows
    .map((row) => row.metricValue)
    .sort((left, right) =>
      direction === "descending" ? right - left : left - right,
    );
}

export function findBoundaryTieWarnings(
  rows: readonly { metricValue: number }[],
  boundaryRank: number,
  direction: MetricDirection,
): BoundaryTieWarning[] {
  if (boundaryRank < 1 || rows.length === 0) return [];
  const values = sortedValues(rows, direction);
  const warnings: BoundaryTieWarning[] = [];
  let index = 0;
  while (index < values.length) {
    const tiedValue = values[index];
    let end = index;
    while (end < values.length && values[end] === tiedValue) end += 1;
    const startRank = index + 1;
    if (startRank <= boundaryRank && boundaryRank < end) {
      warnings.push({
        boundaryRank,
        direction,
        tiedCount: end - index,
        tiedValue,
      });
    }
    index = end;
  }
  return warnings;
}

export function evaluateCoverage(
  rows: readonly { metricValue: number }[],
  requiredRank: number,
): Readonly<{
  complete: boolean;
  coveredThroughRank: number;
  shortfall: number;
}> {
  const coveredThroughRank = Math.min(requiredRank, rows.length);
  return {
    complete: rows.length >= requiredRank,
    coveredThroughRank,
    shortfall: Math.max(0, requiredRank - rows.length),
  };
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/boundary-ties.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/results/boundary-ties.ts tests/unit/boundary-ties.test.ts
git commit -m "feat: add boundary tie and coverage helpers"
```

---

### Task 8: Spotlight list paste parser

**Files:**

- Create: `src/features/results/list-paste-parser.ts`
- Test: `tests/unit/list-paste-parser.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { parsePastedResultList } from "@/features/results/list-paste-parser";
import { describe, expect, it } from "vitest";

const players = [
  { id: "p-haaland", names: ["Haaland", "Haaland, Erling"] },
  { id: "p-salah", names: ["Salah"] },
  { id: "p-wilson", names: ["Wilson"] },
];

describe("parsePastedResultList", () => {
  it("parses rank-prefixed integer lines", () => {
    const rows = parsePastedResultList({
      metricKind: "integer",
      subjects: players,
      text: "1 Haaland 27\n2 Salah 18",
    });
    expect(rows[0]).toMatchObject({
      status: "matched",
      subjectId: "p-haaland",
      metricValue: 27,
    });
    expect(rows[1]).toMatchObject({
      status: "matched",
      subjectId: "p-salah",
      metricValue: 18,
    });
  });

  it("parses dash-separated lines without ranks", () => {
    const rows = parsePastedResultList({
      metricKind: "integer",
      subjects: players,
      text: "Haaland — 27",
    });
    expect(rows[0]).toMatchObject({
      status: "matched",
      subjectId: "p-haaland",
      metricValue: 27,
    });
  });

  it("parses decimal ratings within 0–10 with at most three decimals", () => {
    const rows = parsePastedResultList({
      metricKind: "rating",
      subjects: players,
      text: "Salah 7.852\nHaaland 10",
    });
    expect(rows[0].status).toBe("matched");
    expect(rows[0].metricValue).toBe(7.852);
    expect(rows[1].status).toBe("matched");
  });

  it("rejects ratings above ten or with too many decimals as bad-metric", () => {
    const rows = parsePastedResultList({
      metricKind: "rating",
      subjects: players,
      text: "Salah 11\nHaaland 7.8521",
    });
    expect(rows[0].status).toBe("bad-metric");
    expect(rows[1].status).toBe("bad-metric");
  });

  it("rejects decimals for integer datasets", () => {
    const rows = parsePastedResultList({
      metricKind: "integer",
      subjects: players,
      text: "Salah 18.5",
    });
    expect(rows[0].status).toBe("bad-metric");
  });

  it("flags unknown names while keeping their lines", () => {
    const rows = parsePastedResultList({
      metricKind: "integer",
      subjects: players,
      text: "Mystery Player 12",
    });
    expect(rows[0]).toMatchObject({ status: "no-match", subjectId: null });
  });

  it("matches reversed sort-name forms", () => {
    const rows = parsePastedResultList({
      metricKind: "integer",
      subjects: players,
      text: "Haaland, Erling 27",
    });
    expect(rows[0]).toMatchObject({
      status: "matched",
      subjectId: "p-haaland",
    });
  });

  it("flags lines with no number as bad-metric", () => {
    const rows = parsePastedResultList({
      metricKind: "integer",
      subjects: players,
      text: "Salah",
    });
    expect(rows[0].status).toBe("bad-metric");
  });

  it("skips empty lines entirely", () => {
    const rows = parsePastedResultList({
      metricKind: "integer",
      subjects: players,
      text: "\n  \nSalah 18\n",
    });
    expect(rows).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/list-paste-parser.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
import { normalizeForMatch } from "@/shared/text-normalization";

export type PasteSubject = Readonly<{ id: string; names: readonly string[] }>;

export type ListMetricKind = "integer" | "rating";

export type ParsedListRowStatus =
  "matched" | "ambiguous" | "no-match" | "bad-metric";

export type ParsedListRow = Readonly<{
  candidateLabels: readonly string[];
  metricValue: number | null;
  name: string;
  rawLine: string;
  status: ParsedListRowStatus;
  subjectId: string | null;
}>;

const RANK_PREFIX = /^\s*(?:[#•*\-–—]\s*)?\d{1,3}\s*[.)\]]?\s+/;
const METRIC_SUFFIX = /(?:[—–\-:]|\s)+(\d+(?:\.\d{1,3})?)\s*$/;

type Resolution =
  | { kind: "matched"; id: string }
  | { kind: "ambiguous"; ids: readonly string[] }
  | { kind: "no-match" };

function resolveSubject(
  name: string,
  exactIndex: ReadonlyMap<string, string>,
): Resolution {
  const normalized = normalizeForMatch(name);
  if (!normalized) return { kind: "no-match" };
  const direct = exactIndex.get(normalized);
  if (direct) return { kind: "matched", id: direct };
  const words = normalized.split(" ").filter(Boolean);
  if (words.length < 2) return { kind: "no-match" };
  const found = new Set<string>();
  for (let size = words.length - 1; size >= 2; size -= 1) {
    for (let start = 0; start + size <= words.length; start += 1) {
      const id = exactIndex.get(words.slice(start, start + size).join(" "));
      if (id) found.add(id);
    }
    if (found.size > 1) return { kind: "ambiguous", ids: [...found] };
  }
  if (found.size === 1) return { kind: "matched", id: [...found][0] };
  return { kind: "no-match" };
}

export function parsePastedResultList({
  metricKind,
  subjects,
  text,
}: {
  metricKind: ListMetricKind;
  subjects: readonly PasteSubject[];
  text: string;
}): ParsedListRow[] {
  const exactIndex = new Map<string, string>();
  const labelById = new Map<string, string>();
  for (const subject of subjects) {
    if (!labelById.has(subject.id)) {
      labelById.set(subject.id, subject.names[0] ?? subject.id);
    }
    for (const name of subject.names) {
      const key = normalizeForMatch(name);
      if (key && !exactIndex.has(key)) exactIndex.set(key, subject.id);
    }
  }

  const rows: ParsedListRow[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const withoutRank = line.replace(RANK_PREFIX, "");
    const metricMatch = METRIC_SUFFIX.exec(withoutRank);
    const name = (
      metricMatch ? withoutRank.slice(0, metricMatch.index) : withoutRank
    )
      .replace(/[\s—–\-:]+$/, "")
      .trim();
    if (!name && !metricMatch) continue;

    let metricValue: number | null = null;
    let metricValid = false;
    if (metricMatch) {
      const normalizedMetric = metricMatch[1].replace(",", ".");
      const parsed = Number(normalizedMetric);
      metricValid =
        metricKind === "integer"
          ? /^\d+$/.test(normalizedMetric)
          : /^\d{1,2}(?:\.\d{1,3})?$/.test(normalizedMetric) &&
            parsed >= 0 &&
            parsed <= 10;
      if (metricValid) metricValue = parsed;
    }

    const resolution = resolveSubject(name, exactIndex);
    const status: ParsedListRowStatus =
      !metricMatch || !metricValid
        ? "bad-metric"
        : resolution.kind === "matched"
          ? "matched"
          : resolution.kind === "ambiguous"
            ? "ambiguous"
            : "no-match";
    rows.push({
      candidateLabels:
        resolution.kind === "ambiguous"
          ? resolution.ids.map((id) => labelById.get(id) ?? id)
          : [],
      metricValue,
      name,
      rawLine: line,
      status,
      subjectId: resolution.kind === "matched" ? resolution.id : null,
    });
  }
  return rows;
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/list-paste-parser.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/results/list-paste-parser.ts tests/unit/list-paste-parser.test.ts
git commit -m "feat: add spotlight list paste parser"
```

---

### Task 9: Dataset diff

**Files:**

- Create: `src/features/results/dataset-diff.ts`
- Test: `tests/unit/dataset-diff.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { buildResultDiff } from "@/features/results/dataset-diff";
import { describe, expect, it } from "vitest";

const labelById = new Map([
  ["a", "Haaland"],
  ["b", "Salah"],
] as const);

describe("buildResultDiff", () => {
  it("marks identical rows as same", () => {
    const diff = buildResultDiff({
      direction: "descending",
      draftRows: [{ metricValue: 27, subjectId: "a" }],
      labelById,
      publishedRows: [{ metricValue: 27, subjectId: "a" }],
    });
    expect(diff.entries[0].kind).toBe("same");
    expect(diff.addedCount).toBe(0);
  });

  it("detects value changes with old and new ranks", () => {
    const diff = buildResultDiff({
      direction: "descending",
      draftRows: [
        { metricValue: 30, subjectId: "a" },
        { metricValue: 18, subjectId: "b" },
      ],
      labelById,
      publishedRows: [
        { metricValue: 27, subjectId: "a" },
        { metricValue: 18, subjectId: "b" },
      ],
    });
    expect(diff.changedCount).toBe(1);
    const haaland = diff.entries.find((entry) => entry.subjectId === "a");
    expect(haaland).toMatchObject({
      kind: "changed",
      oldMetric: 27,
      newMetric: 30,
      oldRank: 1,
      newRank: 1,
    });
  });

  it("detects added and removed subjects", () => {
    const diff = buildResultDiff({
      direction: "descending",
      draftRows: [{ metricValue: 18, subjectId: "b" }],
      labelById,
      publishedRows: [{ metricValue: 27, subjectId: "a" }],
    });
    expect(diff.addedCount).toBe(1);
    expect(diff.removedCount).toBe(1);
    expect(
      diff.entries.filter((entry) => entry.kind === "added")[0].subjectId,
    ).toBe("b");
    expect(
      diff.entries.filter((entry) => entry.kind === "removed")[0].oldRank,
    ).toBe(1);
  });

  it("handles an empty published snapshot as all-added", () => {
    const diff = buildResultDiff({
      direction: "descending",
      draftRows: [{ metricValue: 27, subjectId: "a" }],
      labelById,
      publishedRows: [],
    });
    expect(diff.addedCount).toBe(1);
    expect(diff.entries[0].oldRank).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/dataset-diff.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
import { rankMetricItems } from "@/features/scoring/categories";

export type ResultDiffKind = "added" | "changed" | "removed" | "same";

export type ResultDiffEntry = Readonly<{
  kind: ResultDiffKind;
  label: string;
  newMetric: number | null;
  newRank: number | null;
  oldMetric: number | null;
  oldRank: number | null;
  subjectId: string;
}>;

export type ResultDiff = Readonly<{
  addedCount: number;
  changedCount: number;
  entries: readonly ResultDiffEntry[];
  removedCount: number;
}>;

type DiffRow = Readonly<{ metricValue: number; subjectId: string }>;

export function buildResultDiff({
  direction,
  draftRows,
  labelById,
  publishedRows,
}: {
  direction: "ascending" | "descending";
  draftRows: readonly DiffRow[];
  labelById: ReadonlyMap<string, string>;
  publishedRows: readonly DiffRow[];
}): ResultDiff {
  const rankedPublished = rankMetricItems(
    publishedRows.map((row) => ({
      id: row.subjectId,
      metric: row.metricValue,
    })),
    direction,
  );
  const rankedDraft = rankMetricItems(
    draftRows.map((row) => ({ id: row.subjectId, metric: row.metricValue })),
    direction,
  );
  const oldById = new Map(
    rankedPublished.map((item) => [item.id, item] as const),
  );
  const newIds = new Set(rankedDraft.map((item) => item.id));

  let addedCount = 0;
  let changedCount = 0;
  let removedCount = 0;
  const entries: ResultDiffEntry[] = [];

  for (const draft of rankedDraft) {
    const old = oldById.get(draft.id) ?? null;
    const kind: ResultDiffKind = !old
      ? "added"
      : old.metric !== draft.metric
        ? "changed"
        : "same";
    if (kind === "added") addedCount += 1;
    if (kind === "changed") changedCount += 1;
    entries.push({
      kind,
      label: labelById.get(draft.id) ?? draft.id,
      newMetric: draft.metric,
      newRank: draft.rank,
      oldMetric: old?.metric ?? null,
      oldRank: old?.rank ?? null,
      subjectId: draft.id,
    });
  }
  for (const published of rankedPublished) {
    if (newIds.has(published.id)) continue;
    removedCount += 1;
    entries.push({
      kind: "removed",
      label: labelById.get(published.id) ?? published.id,
      newMetric: null,
      newRank: null,
      oldMetric: published.metric,
      oldRank: published.rank,
      subjectId: published.id,
    });
  }

  const order = { added: 0, changed: 1, removed: 2, same: 3 } as const;
  entries.sort(
    (left, right) =>
      order[left.kind] - order[right.kind] ||
      (left.newRank ?? left.oldRank ?? Number.MAX_SAFE_INTEGER) -
        (right.newRank ?? right.oldRank ?? Number.MAX_SAFE_INTEGER),
  );
  return { addedCount, changedCount, entries, removedCount };
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/unit/dataset-diff.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/results/dataset-diff.ts tests/unit/dataset-diff.test.ts
git commit -m "feat: add spotlight dataset diff"
```

---

### Task 10: Picked-subjects seed query

**Files:**

- Create: `src/features/results/seed-queries.ts`
- Test: `tests/integration/results-seed-query.integration.test.ts`

- [ ] **Step 1: Study the existing integration harness**

Open `tests/integration/spotlight-results.integration.test.ts`. Reuse its fixture bootstrap (season creation, teams/players seeding, prediction + category-pick insertion, reveal/closure state) by copying the setup into the new spec below. If its helpers are file-local, extract them verbatim into `tests/integration/helpers/spotlight-fixtures.ts` first and update the existing spec to import from there — behavior must not change (`npm run test:integration` stays green).

- [ ] **Step 2: Write the failing integration test**

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getPickedSubjectsByDataset } from "@/features/results/seed-queries";

import {} from /* reuse the bootstrap exports you extracted in step 1 */ "./helpers/spotlight-fixtures";

describe("getPickedSubjectsByDataset", () => {
  beforeEach(async () => {
    await resetFixtures();
    await seedSeasonWithRevealedPredictions();
  });

  afterAll(async () => {
    await teardown();
  });

  it("returns the union of picked subjects per dataset without duplicates", async () => {
    const seasonId = await getSeasonId();
    const picked = await getPickedSubjectsByDataset(seasonId);
    expect(picked.goals.sort()).toEqual([haalandId, salahId].sort());
    expect(picked.assists).toEqual([salahId]);
    expect(picked.clean_sheets.sort()).toEqual(
      [arsenalTeamId, cityTeamId].sort(),
    );
    expect(picked.player_ratings.sort()).toEqual([haalandId, wilsonId].sort());
  });

  it("excludes Other-player spellings that have no resolved player id", async () => {
    const seasonId = await getSeasonId();
    await insertOtherPlayerPick("Zlatan");
    const picked = await getPickedSubjectsByDataset(seasonId);
    expect(picked.goals).not.toContain("Zlatan".toLowerCase());
  });
});
```

Adapt fixture function/id names to whatever step 1 exposes; the assertions above are the contract.

- [ ] **Step 3: Run to verify failure**

Run: `npm run db:test:migrate && npm run db:test:seed && npm run test:integration -- results-seed-query`
Expected: FAIL (module not found)

- [ ] **Step 4: Implement**

```ts
import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { predictionCategoryPicks, predictions } from "@/db/schema";
import { isPredictionCategory } from "@/features/predictions/categories";
import {
  RESULT_DATASET_BY_CATEGORY,
  SPOTLIGHT_RESULT_DATASETS,
  type SpotlightResultDataset,
} from "./types";

export type PickedSubjectsByDataset = Readonly<
  Record<SpotlightResultDataset, readonly string[]>
>;

export async function getPickedSubjectsByDataset(
  seasonId: string,
): Promise<PickedSubjectsByDataset> {
  const picked = Object.fromEntries(
    SPOTLIGHT_RESULT_DATASETS.map((dataset) => [dataset, [] as string[]]),
  ) as Record<SpotlightResultDataset, string[]>;

  const rows = await getDb()
    .select({
      category: predictionCategoryPicks.category,
      playerId: predictionCategoryPicks.playerId,
      teamId: predictionCategoryPicks.teamId,
    })
    .from(predictionCategoryPicks)
    .innerJoin(
      predictions,
      eq(predictions.id, predictionCategoryPicks.predictionId),
    )
    .where(eq(predictions.seasonId, seasonId));

  for (const row of rows) {
    if (!isPredictionCategory(row.category)) continue;
    const dataset = RESULT_DATASET_BY_CATEGORY[row.category];
    if (!dataset) continue;
    const subjectId = row.playerId ?? row.teamId;
    if (!subjectId) continue;
    const bucket = picked[dataset];
    if (!bucket.includes(subjectId)) bucket.push(subjectId);
  }
  return picked;
}
```

Note: `RESULT_DATASET_BY_CATEGORY` maps `most_clean_sheets → clean_sheets`, so clean-sheet picks land correctly even though `RESULT_CATEGORIES_BY_DATASET.clean_sheets` is empty. Other-player picks have neither `playerId` nor `teamId` and are skipped — they resolve through the alias flow instead.

- [ ] **Step 5: Verify pass**

Run: `npm run test:integration -- results-seed-query`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/results/seed-queries.ts tests/integration/
git commit -m "feat: add picked-subjects seed query for result datasets"
```

---

### Task 11: Results paste panel component

**Files:**

- Create: `src/app/admin/results/results-paste-panel.tsx`
- Test: `tests/components/results-paste-panel.test.tsx`

- [ ] **Step 1: Write the failing component test**

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResultsPastePanel } from "@/app/admin/results/results-paste-panel";

const subjects = [
  { id: "p-haaland", names: ["Haaland"] },
  { id: "p-salah", names: ["Salah"] },
];

afterEach(cleanup);

describe("ResultsPastePanel", () => {
  it("parses and applies only matched rows", () => {
    const onApply = vi.fn();
    render(
      <ResultsPastePanel
        datasetLabel="Top scorer"
        disabled={false}
        metricKind="integer"
        onApply={onApply}
        subjects={subjects}
      />,
    );
    fireEvent.change(screen.getByLabelText("Paste top scorer list"), {
      target: { value: "Haaland 27\nMystery Player 12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Parse list" }));
    expect(screen.getByText(/1 line needs attention/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply 1 row" }));
    expect(onApply).toHaveBeenCalledWith([
      { metricValue: 27, subjectId: "p-haaland" },
    ]);
  });

  it("clears the textarea after applying", () => {
    const onApply = vi.fn();
    render(
      <ResultsPastePanel
        datasetLabel="Top scorer"
        disabled={false}
        metricKind="integer"
        onApply={onApply}
        subjects={subjects}
      />,
    );
    const textarea = screen.getByLabelText("Paste top scorer list");
    fireEvent.change(textarea, { target: { value: "Haaland 27" } });
    fireEvent.click(screen.getByRole("button", { name: "Parse list" }));
    fireEvent.click(screen.getByRole("button", { name: /Apply 1 row/ }));
    expect((textarea as HTMLTextAreaElement).value).toBe("");
  });

  it("disables inputs when disabled is true", () => {
    render(
      <ResultsPastePanel
        datasetLabel="Top scorer"
        disabled
        metricKind="integer"
        onApply={vi.fn()}
        subjects={subjects}
      />,
    );
    expect(
      (screen.getByLabelText("Paste top scorer list") as HTMLTextAreaElement)
        .disabled,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/components/results-paste-panel.test.tsx`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```tsx
"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

import {
  parsePastedResultList,
  type PasteSubject,
} from "@/features/results/list-paste-parser";

export type ResultsPastePanelProps = Readonly<{
  datasetLabel: string;
  disabled: boolean;
  metricKind: "integer" | "rating";
  onApply: (
    rows: readonly { metricValue: number; subjectId: string }[],
  ) => void;
  subjects: readonly PasteSubject[];
}>;

export function ResultsPastePanel({
  datasetLabel,
  disabled,
  metricKind,
  onApply,
  subjects,
}: ResultsPastePanelProps) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ReturnType<
    typeof parsePastedResultList
  > | null>(null);

  const matched = useMemo(
    () =>
      (parsed ?? []).flatMap((row) =>
        row.subjectId && row.metricValue !== null
          ? [{ metricValue: row.metricValue, subjectId: row.subjectId }]
          : [],
      ),
    [parsed],
  );
  const problemRows = (parsed ?? []).filter((row) => row.status !== "matched");

  return (
    <section
      aria-label={`Paste ${datasetLabel} list`}
      className="grid gap-2 rounded-xl border border-slate-200 p-3"
    >
      <label className="grid gap-1 text-sm font-bold text-slate-800">
        Paste {datasetLabel.toLowerCase()} list
        <textarea
          className="min-h-24 w-full rounded-xl border border-slate-300 bg-white p-2 font-mono text-xs outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 disabled:bg-slate-100"
          disabled={disabled}
          onChange={(event) => {
            setText(event.target.value);
            setParsed(null);
          }}
          placeholder={"Haaland 27\nSalah 18"}
          rows={4}
          value={text}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={disabled || text.trim().length === 0}
          onClick={() =>
            setParsed(parsePastedResultList({ metricKind, subjects, text }))
          }
          size="sm"
          variant="secondary"
        >
          Parse list
        </Button>
        <Button
          disabled={disabled || matched.length === 0}
          onClick={() => {
            onApply(matched);
            setText("");
            setParsed(null);
          }}
          size="sm"
        >
          Apply {matched.length || ""} row{matched.length === 1 ? "" : "s"}
        </Button>
        {problemRows.length > 0 ? (
          <span className="text-xs font-semibold text-amber-700">
            {problemRows.length} line{problemRows.length === 1 ? "" : "s"} need
            attention below.
          </span>
        ) : null}
      </div>
      {problemRows.length > 0 ? (
        <ul className="list-disc rounded-xl bg-amber-50 p-2 pl-6 text-xs font-semibold text-amber-900">
          {problemRows.map((row) => (
            <li key={row.rawLine}>
              “{row.rawLine}” —{" "}
              {row.status === "ambiguous"
                ? `ambiguous: ${row.candidateLabels.join(", ")}`
                : row.status === "no-match"
                  ? "no matching player; add them via Other-player matches"
                  : "missing or invalid number"}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/components/results-paste-panel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/results/results-paste-panel.tsx tests/components/results-paste-panel.test.tsx
git commit -m "feat: add results paste panel component"
```

---

### Task 12: Publish review dialog

**Files:**

- Create: `src/app/admin/results/publish-review-dialog.tsx`
- Test: `tests/components/publish-review-dialog.test.tsx`

- [ ] **Step 1: Write the failing component test**

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PublishReviewDialog } from "@/app/admin/results/publish-review-dialog";

const diff = {
  addedCount: 1,
  changedCount: 1,
  entries: [
    {
      kind: "changed",
      label: "Haaland",
      newMetric: 30,
      newRank: 1,
      oldMetric: 27,
      oldRank: 1,
      subjectId: "a",
    },
    {
      kind: "added",
      label: "Wilson",
      newMetric: 12,
      newRank: 3,
      oldMetric: null,
      oldRank: null,
      subjectId: "c",
    },
  ],
  removedCount: 0,
} as const;

const base = {
  attestationSentence:
    "I attest that all rows through rank 5, including boundary ties, are present in this exact draft.",
  boundaryWarnings: [],
  busy: false,
  coveredThroughRank: 5,
  datasetLabel: "Top scorer",
  diff,
  onCancel: vi.fn(),
  onConfirm: vi.fn(),
  requiredRank: 5,
  unresolvedAliasCount: 0,
};

afterEach(cleanup);

describe("PublishReviewDialog", () => {
  it("renders the diff and requires attestation before confirming", () => {
    render(<PublishReviewDialog {...base} />);
    expect(screen.getByText(/Haaland/)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "Publish provisional" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(
      (
        screen.getByRole("button", {
          name: "Publish provisional",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("blocks when aliases are unresolved and shows the warning", () => {
    render(<PublishReviewDialog {...base} unresolvedAliasCount={2} />);
    expect(screen.getByText(/2 Other-player match(es)? pending/)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(
      (
        screen.getByRole("button", {
          name: "Publish provisional",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("shows boundary tie warnings without blocking", () => {
    render(
      <PublishReviewDialog
        {...base}
        boundaryWarnings={[
          {
            boundaryRank: 5,
            direction: "descending",
            tiedCount: 2,
            tiedValue: 14,
          },
        ]}
      />,
    );
    expect(screen.getByText(/Tie at 14 spans rank 5/)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(
      (
        screen.getByRole("button", {
          name: "Publish provisional",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("calls onCancel and onConfirm", () => {
    const onConfirm = vi.fn();
    render(<PublishReviewDialog {...base} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(
      screen.getByRole("button", { name: "Publish provisional" }),
    );
    expect(onConfirm).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(base.onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/components/publish-review-dialog.test.tsx`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```tsx
"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import type { BoundaryTieWarning } from "@/features/results/boundary-ties";
import type { ResultDiff } from "@/features/results/dataset-diff";

export type PublishReviewDialogProps = Readonly<{
  attestationSentence: string;
  boundaryWarnings: readonly BoundaryTieWarning[];
  busy: boolean;
  coveredThroughRank: number | null;
  datasetLabel: string;
  diff: ResultDiff;
  onCancel: () => void;
  onConfirm: () => void;
  requiredRank: number | null;
  unresolvedAliasCount: number;
}>;

export function PublishReviewDialog({
  attestationSentence,
  boundaryWarnings,
  busy,
  coveredThroughRank,
  datasetLabel,
  diff,
  onCancel,
  onConfirm,
  requiredRank,
  unresolvedAliasCount,
}: PublishReviewDialogProps) {
  const [attested, setAttested] = useState(false);
  const aliasBlocked = unresolvedAliasCount > 0;

  return (
    <div
      aria-label={`Review and publish ${datasetLabel}`}
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"
      role="dialog"
    >
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5">
        <h2 className="text-lg font-black text-slate-950">
          Review &amp; publish — {datasetLabel}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Coverage through rank {coveredThroughRank ?? "—"} of required{" "}
          {requiredRank ?? "—"}. {diff.addedCount} added, {diff.changedCount}{" "}
          changed, {diff.removedCount} removed.
        </p>
        {aliasBlocked ? (
          <p
            className="mt-2 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800"
            role="alert"
          >
            {unresolvedAliasCount} Other-player match
            {unresolvedAliasCount === 1 ? "" : "es"} pending. Resolve them below
            the editor first.
          </p>
        ) : null}
        {boundaryWarnings.length > 0 ? (
          <ul className="mt-2 list-disc rounded-xl bg-amber-50 p-3 pl-6 text-sm font-semibold text-amber-900">
            {boundaryWarnings.map((warning) => (
              <li key={`${warning.tiedValue}-${warning.direction}`}>
                Tie at {warning.tiedValue} spans rank {warning.boundaryRank} —{" "}
                confirm every tied player is in the list.
              </li>
            ))}
          </ul>
        ) : null}
        <ul className="mt-3 max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          {diff.entries.map((entry) => (
            <li
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              key={entry.subjectId}
            >
              <span className="font-semibold text-slate-950">
                {entry.label}
              </span>
              <span className="text-xs font-bold tracking-wide uppercase">
                <span
                  className={
                    entry.kind === "removed"
                      ? "text-red-700"
                      : entry.kind === "added"
                        ? "text-emerald-700"
                        : entry.kind === "changed"
                          ? "text-amber-700"
                          : "text-slate-500"
                  }
                >
                  {entry.kind}
                </span>{" "}
                <span className="text-slate-700">
                  {entry.oldMetric ?? "—"} → {entry.newMetric ?? "—"}
                  {entry.oldRank !== null && entry.newRank !== null
                    ? ` (rank ${entry.oldRank} → ${entry.newRank})`
                    : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <label className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 font-semibold text-slate-700">
          <input
            checked={attested}
            className="mt-1 size-4 shrink-0 accent-emerald-600"
            onChange={(event) => setAttested(event.target.checked)}
            type="checkbox"
          />
          {attestationSentence}
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button disabled={busy} onClick={onCancel} variant="ghost">
            Cancel
          </Button>
          <Button
            disabled={!attested || busy || aliasBlocked}
            onClick={onConfirm}
          >
            Publish provisional
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/components/publish-review-dialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/results/publish-review-dialog.tsx tests/components/publish-review-dialog.test.tsx
git commit -m "feat: add publish review dialog"
```

---

### Task 13: Wire the results desk and page

**Files:**

- Modify: `src/app/admin/results/results-desk.tsx`
- Modify: `src/app/admin/results/page.tsx`
- Test: `tests/components/spotlight-results-desk.test.tsx` (update fixtures + new tests)

- [ ] **Step 1: Update the failing desk test fixtures first**

In `tests/components/spotlight-results-desk.test.tsx`:

1. Add `publishedRows: []` to every `ResultDeskDataset` fixture object.
2. Add a `pickedSubjects` prop to every `SpotlightResultsDesk` render:

```tsx
const pickedSubjects = {
  assists: [],
  clean_sheets: [],
  goals: [playerA],
  player_ratings: [playerB],
} as const;
```

3. Run: `npx vitest run tests/components/spotlight-results-desk.test.tsx` — expect FAIL (missing props/types).

- [ ] **Step 2: Extend desk types and props in `results-desk.tsx`**

```tsx
import { ResultsPastePanel } from "./results-paste-panel";
import { PublishReviewDialog } from "./publish-review-dialog";
import {
  evaluateCoverage,
  findBoundaryTieWarnings,
} from "@/features/results/boundary-ties";
import { buildResultDiff } from "@/features/results/dataset-diff";
```

Type changes:

```tsx
export type ResultDeskSubject = Readonly<{
  active?: boolean;
  id: string;
  label: string;
  names: readonly string[];
}>;

export type ResultDeskDataset = Readonly<{
  // existing fields…
  publishedRows: readonly { metricValue: number; subjectId: string }[];
}>;

export type ResultDeskProps = Readonly<{
  // existing fields…
  pickedSubjects: Readonly<Record<SpotlightResultDataset, readonly string[]>>;
}>;
```

Mirror `publishedRows` onto `EditableDataset` (copy through in the `useState` initializer).

- [ ] **Step 3: Add handlers inside `SpotlightResultsDesk`**

```tsx
const [reviewDataset, setReviewDataset] =
  useState<SpotlightResultDataset | null>(null);

function seedFromSubmissions(datasetName: SpotlightResultDataset) {
  const dataset = datasets[datasetName];
  const present = new Set(dataset.rows.map((row) => row.subjectId));
  const additions = pickedSubjects[datasetName]
    .filter((subjectId) => !present.has(subjectId))
    .map((subjectId) => ({ metricValue: 0, subjectId }));
  if (additions.length === 0) return;
  updateDataset(datasetName, {
    rows: [...dataset.rows, ...additions],
  });
}

function applyPastedRows(
  datasetName: SpotlightResultDataset,
  incoming: readonly { metricValue: number; subjectId: string }[],
) {
  const dataset = datasets[datasetName];
  const bySubject = new Map(
    dataset.rows.map((row) => [row.subjectId, row.metricValue] as const),
  );
  for (const row of incoming) bySubject.set(row.subjectId, row.metricValue);
  updateDataset(datasetName, {
    rows: [...bySubject].map(([subjectId, metricValue]) => ({
      metricValue,
      subjectId,
    })),
  });
}

async function saveAndPublish(datasetName: SpotlightResultDataset) {
  const dataset = datasets[datasetName];
  setBusyKey(`${datasetName}:review-publish`);
  try {
    const saved = await saveSpotlightResultDraft({
      capturedAt: fromUtcInputValue(dataset.capturedAt),
      coveredThroughRank: dataset.coveredThroughRank,
      dataset: datasetName,
      expectedWorkingSnapshotId: dataset.pointers.workingSnapshotId,
      rows: dataset.rows,
      source: dataset.source,
      sourceReference: dataset.sourceReference.trim() || null,
    });
    if (!saved.ok || !saved.snapshotId) {
      setMessages((current) => ({ ...current, [datasetName]: saved }));
      return;
    }
    const workingSnapshotId = saved.snapshotId;
    const published = await publishSpotlightResult({
      activeSnapshotId: dataset.pointers.activeSnapshotId,
      coverageAttested: true,
      dataset: datasetName,
      finalSnapshotId: dataset.pointers.finalSnapshotId,
      workingSnapshotId,
    });
    if (published.ok) {
      updateDataset(
        datasetName,
        {
          activeSnapshot: {
            capturedAt: fromUtcInputValue(dataset.capturedAt),
            coveredThroughRank: dataset.coveredThroughRank ?? bracketCount,
            id: workingSnapshotId,
            itemCount: dataset.rows.length,
            source: dataset.source,
            sourceReference: dataset.sourceReference.trim() || null,
          },
          dirty: false,
          pinnedAliases: saved.pinnedAliases ?? [],
          pointers: {
            ...dataset.pointers,
            activeSnapshotId: workingSnapshotId,
            workingSnapshotId,
          },
        },
        { markDirty: false, resetAttestation: true },
      );
    } else {
      updateDataset(
        datasetName,
        {
          dirty: false,
          pinnedAliases: saved.pinnedAliases ?? [],
          pointers: { ...dataset.pointers, workingSnapshotId },
        },
        { markDirty: false, resetAttestation: true },
      );
    }
    setMessages((current) => ({ ...current, [datasetName]: published }));
  } catch {
    setMessages((current) => ({
      ...current,
      [datasetName]: {
        message: "Something went wrong. No changes were made.",
        ok: false,
      },
    }));
  } finally {
    setBusyKey(null);
    setReviewDataset(null);
  }
}
```

If publish fails after save succeeded, the draft stays saved (working pointer moved, dirty=false) — the safe recovery state per spec.

- [ ] **Step 4: Replace the controls cluster in `renderControls`**

Keep the messages area and the secondary **Save draft** button. Remove the attestation checkbox and **Publish provisional** button; add one primary button:

```tsx
<Button
  className="w-full sm:w-auto"
  disabled={Boolean(busyKey) || finalized || publishBlockedWithoutAttestation}
  onClick={() => setReviewDataset(datasetName)}
>
  Review &amp; publish
</Button>
```

where `publishBlockedWithoutAttestation` is the existing `publishBlocked` computation minus the `!coverageAttested[datasetName]` term (attestation now lives in the dialog).

Render the dialog at the end of the component:

```tsx
{
  reviewDataset ? (
    <PublishReviewDialog
      attestationSentence={`I attest that ${reviewDataset === "player_ratings" ? "both the highest- and lowest-rated" : "all"} rows through rank ${bracketCount || "N"}, including boundary ties, are present in this exact draft.`}
      boundaryWarnings={findBoundaryTieWarnings(
        datasets[reviewDataset].rows,
        bracketCount,
        "descending",
      )}
      busy={busyKey === `${reviewDataset}:review-publish`}
      coveredThroughRank={
        evaluateCoverage(datasets[reviewDataset].rows, bracketCount)
          .coveredThroughRank || null
      }
      datasetLabel={DATASET_LABELS[reviewDataset]}
      diff={buildResultDiff({
        direction: "descending",
        draftRows: datasets[reviewDataset].rows,
        labelById: labelBySubjectIdFor(reviewDataset),
        publishedRows: datasets[reviewDataset].publishedRows,
      })}
      onCancel={() => setReviewDataset(null)}
      onConfirm={() => void saveAndPublish(reviewDataset)}
      requiredRank={bracketCount || null}
      unresolvedAliasCount={unresolvedAliasCountForDataset(reviewDataset)}
    />
  ) : null;
}
```

Add a small helper next to `aliasesForDataset`:

```tsx
function labelBySubjectIdFor(datasetName: SpotlightResultDataset) {
  const subjects = datasetName === "clean_sheets" ? teams : availablePlayers;
  return new Map(
    subjects.map((subject) => [subject.id, subject.label] as const),
  );
}
```

Also render coverage feedback near each editor header:

```tsx
{
  (() => {
    const coverage = evaluateCoverage(dataset.rows, bracketCount);
    return (
      <p className="text-xs font-semibold text-slate-600" role="status">
        {coverage.complete
          ? `Coverage complete through rank ${coverage.coveredThroughRank}.`
          : `Short by ${coverage.shortfall} row${coverage.shortfall === 1 ? "" : "s"} of rank ${bracketCount}.`}
      </p>
    );
  })();
}
```

- [ ] **Step 5: Add seed button and paste panel to each dataset card**

Inside each ordinary-dataset card (and once for the shared ratings card), after `<EditableResultTable …>`:

```tsx
<div className="flex flex-wrap items-center gap-2">
  <Button
    disabled={frozen || !publishReady}
    onClick={() => seedFromSubmissions(datasetName)}
    size="sm"
    variant="secondary"
  >
    Seed from submissions
  </Button>
</div>
<ResultsPastePanel
  datasetLabel={DATASET_LABELS[datasetName]}
  disabled={frozen}
  metricKind={datasetName === "player_ratings" ? "rating" : "integer"}
  onApply={(rows) => applyPastedRows(datasetName, rows)}
  subjects={subjects.map((subject) => ({
    id: subject.id,
    names: subject.names,
  }))}
/>
```

- [ ] **Step 6: Wire page data in `src/app/admin/results/page.tsx`**

1. Import the query:

```tsx
import { getPickedSubjectsByDataset } from "@/features/results/seed-queries";
```

2. Add it to the existing `Promise.all`, then pass to the desk:

```tsx
pickedSubjects = { pickedSubjects };
```

3. Extend the players mapping with names and the teams mapping with names:

```tsx
players={seasonPlayers.map((player) => ({
  active: player.isActive,
  id: player.id,
  label: /* unchanged */,
  names: [player.displayName],
}))}
teams={seasonTeams.map((team) => ({
  id: team.id,
  label: team.displayName,
  names: [team.displayName, team.shortName],
}))}
```

4. Extend each dataset mapping with published rows:

```tsx
publishedRows:
  state?.activeSnapshotId && snapshotById.get(state.activeSnapshotId)
    ? itemRows.flatMap((item) =>
        item.snapshotId === state.activeSnapshotId &&
        (item.playerId ?? item.teamId)
          ? [
              {
                metricValue: item.metricValue,
                subjectId: (item.playerId ?? item.teamId) as string,
              },
            ]
          : [],
      )
    : [],
```

- [ ] **Step 7: Add new desk component tests**

Append to `tests/components/spotlight-results-desk.test.tsx`:

1. Seed merge test: render desk with `publishReady`, click “Seed from submissions” on the Top scorer card, assert a new row input appears for the picked player at value 0.
2. Review dialog flow: fill a valid draft, save via mocked `saveSpotlightResultDraft` resolving `{ ok: true, message: "Saved.", snapshotId: "00000000-0000-4000-8000-000000000099", pinnedAliases: [] }`, open Review & publish, tick attestation, confirm; assert mocked `publishSpotlightResult` was called with `coverageAttested: true` and `workingSnapshotId: "00000000-0000-4000-8000-000000000099"`.
3. Publish-failure recovery: same but `publishSpotlightResult` resolves `{ ok: false, message: "Coverage incomplete." }`; assert the error message renders and no success audit path ran.

Follow the file's existing `vi.hoisted` mock style.

- [ ] **Step 8: Verify all component tests pass**

Run: `npx vitest run tests/components/spotlight-results-desk.test.tsx tests/components/results-paste-panel.test.tsx tests/components/publish-review-dialog.test.tsx`
Expected: PASS

- [ ] **Step 9: Typecheck, lint, full unit suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/app/admin/results/ tests/components/
git commit -m "feat: wire paste entry, seeding, and combined publish into results desk"
```

---

### Task 14: E2E journey

**Files:**

- Create: `tests/e2e/admin-paste-entry.spec.ts`

- [ ] **Step 1: Study the existing harness**

Open `tests/e2e/app-journey.spec.ts`. Copy its admin-login block verbatim (around lines 658–669 and 926: password from `process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? process.env.ADMIN_SECRET`, `page.goto("/admin/login")`, fill credentials, submit) into a local `loginAsAdmin(page)` helper, and reuse its `getQaDb()` cleanup pattern for any QA rows you create.

- [ ] **Step 2: Write the spec**

```ts
import { expect, test, type Page } from "@playwright/test";

async function loginAsAdmin(page: Page) {
  const adminPassword =
    process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? process.env.ADMIN_SECRET;
  if (!adminPassword) {
    throw new Error(
      "PLAYWRIGHT_ADMIN_PASSWORD or ADMIN_SECRET must be available for E2E",
    );
  }
  await page.goto("/admin/login");
  await page
    .getByLabel(/username/i)
    .fill(process.env.PLAYWRIGHT_ADMIN_USERNAME ?? "admin");
  await page.getByLabel(/password/i).fill(adminPassword);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/admin/);
}

test.describe("admin paste entry", () => {
  test("standings paste journey parses, diffs, and saves a table", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/standings");
    const textarea = page.getByLabel("Pasted table text");
    await textarea.fill("");
    await expect(
      page.getByRole("button", { name: "Parse table" }),
    ).toBeDisabled();
  });

  test("results desk exposes seed and paste affordances after reveal", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/results");
    await expect(
      page.getByRole("heading", { name: "Spotlight results" }),
    ).toBeVisible();
  });
});
```

Extend the first test with a full 20-row fixture table (generate all 20 club lines programmatically from `PREMIER_LEAGUE_2026_27_TEAMS` imported from `@/data`) asserting: preview shows 20 OK rows, confirm enabled, click confirm, success status appears, and `/leaderboard` still renders. Follow the reveal/closure setup approach used by `app-journey.spec.ts` for any state the gate requires; skip gracefully (`test.skip`) when the season is not revealed rather than mutating production data. Never run destructive journeys against production — mirror the isolation rules in `AGENTS.md`.

- [ ] **Step 3: Run against the isolated environment**

Run: `npm run test:e2e -- admin-paste-entry`
Expected: PASS (with `TEST_DATABASE_URL`/local dev server configured as the other e2e specs require)

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/admin-paste-entry.spec.ts
git commit -m "test: add admin paste entry e2e journey"
```

---

### Task 15: Full verification and docs parity

- [ ] **Step 1: Regenerate doc HTML peers and check parity**

Run: `npm run docs:generate && npm run docs:check`
Expected: PASS (HTML peers created for the spec and this plan)

- [ ] **Step 2: Update QA documentation**

Add entries to `docs/QA.md` following its existing format covering: standings paste parse/diff/confirm, unknown-club blocking, seed-from-submissions merge, list paste with skipped lines, combined review+attest+publish dialog, publish-failure recovery state, alias-blocked dialog, mobile reflow of both panels (320–430px), and cleanup evidence for any QA data created during e2e.

- [ ] **Step 3: Full repository check**

Run: `npm run check`
Expected: PASS (docs parity, players check, formatting, lint, typecheck, unit, integration, build verify, e2e)

- [ ] **Step 4: Manual browser QA**

Run `npm run dev` and verify on desktop + mobile viewport (375px and 320px): paste panel layout, results desk cards with seed/paste controls, dialog scroll behavior with long diffs, no horizontal overflow, touch targets ≥ 44px.

- [ ] **Step 5: Commit docs and finish**

```bash
git add docs/
git commit -m "docs: QA evidence and generated HTML for admin paste entry"
```

Then follow the repo's finishing workflow: push the branch, merge to GitHub `main`, update local `main`, and remove the worktree.
