import { normalizeForMatch } from "@/shared/text-normalization";

export type PasteSubject = Readonly<{
  id: string;
  names: readonly string[];
}>;

export type ListMetricKind = "integer" | "rating";

export type ParsedListRowStatus =
  | "matched"
  | "ambiguous"
  | "no-match"
  | "bad-metric";

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
  exactIndex: ReadonlyMap<string, ReadonlySet<string>>,
): Resolution {
  const normalized = normalizeForMatch(name);
  if (!normalized) return { kind: "no-match" };
  const direct = exactIndex.get(normalized);
  if (direct?.size === 1) return { kind: "matched", id: [...direct][0] };
  if (direct && direct.size > 1) {
    return { kind: "ambiguous", ids: [...direct] };
  }
  const words = normalized.split(" ").filter(Boolean);
  if (words.length < 2) return { kind: "no-match" };
  const found = new Set<string>();
  for (let size = words.length - 1; size >= 2; size -= 1) {
    for (let start = 0; start + size <= words.length; start += 1) {
      const ids = exactIndex.get(words.slice(start, start + size).join(" "));
      for (const id of ids ?? []) found.add(id);
    }
    if (found.size > 1) return { kind: "ambiguous", ids: [...found] };
  }
  if (found.size === 1) return { kind: "matched", id: [...found][0] };
  return { kind: "no-match" };
}

function reverseSortName(name: string): string | null {
  const [familyName, ...givenParts] = name.split(",");
  const givenName = givenParts.join(",").trim();
  if (!familyName || !givenName) return null;
  return `${givenName} ${familyName.trim()}`;
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
  const exactIndex = new Map<string, Set<string>>();
  const labelById = new Map<string, string>();
  const addName = (name: string, subjectId: string) => {
    const key = normalizeForMatch(name);
    if (!key) return;
    const ids = exactIndex.get(key) ?? new Set<string>();
    ids.add(subjectId);
    exactIndex.set(key, ids);
  };
  for (const subject of subjects) {
    if (!labelById.has(subject.id)) {
      labelById.set(subject.id, subject.names[0] ?? subject.id);
    }
    for (const name of subject.names) {
      addName(name, subject.id);
      const reversed = reverseSortName(name);
      if (reversed) addName(reversed, subject.id);
    }
  }

  const rows: ParsedListRow[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const withoutRank = line.replace(RANK_PREFIX, "");
    const metricMatch = METRIC_SUFFIX.exec(withoutRank);
    const name = (metricMatch
      ? withoutRank.slice(0, metricMatch.index)
      : withoutRank
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
