import {
  buildTeamNameIndex,
  type TeamNameSource,
} from "@/data/team-name-aliases";
import { normalizeForMatch } from "@/shared/text-normalization";

export type ParsedStandingsRowStatus =
  | "ok"
  | "unknown-club"
  | "ambiguous-club";

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
  "club",
  "team",
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

    const leadingMatch = /^(\d{1,2})(?:[.)\]]?)(?=\s)/.exec(line);
    const leadingValue = leadingMatch ? Number(leadingMatch[1]) : null;
    const leading =
      leadingValue !== null && leadingValue >= 1 && leadingValue <= 20
        ? leadingValue
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
  const anyExplicitPosition = clubRows.some(
    (row) => row.actualPosition !== null,
  );
  const positionsInferred = !anyExplicitPosition;
  if (clubRows.some((row) => row.actualPosition === null)) {
    let position = 0;
    for (const row of drafts) {
      if (row.status !== "ok") continue;
      position += 1;
      row.actualPosition ??= position;
    }
  }

  return {
    headerDetected,
    ignoredLines,
    positionsInferred,
    rows: drafts.map(({ ...row }) => ({ ...row })),
  };
}
