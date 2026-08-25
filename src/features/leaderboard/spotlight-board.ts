import { getEntryAvatar } from "@/features/leaderboard/entry-avatar";
import type { SpotlightAccuracyEntry } from "@/features/leaderboard/queries";
import type { SpotlightPickDisplay } from "@/features/leaderboard/spotlight-pick-grid";
import {
  PREDICTION_CATEGORY_DEFINITIONS,
  type PredictionCategory,
} from "@/features/predictions/categories";

export type SpotlightView = "categories" | "entries" | "matrix";

export function parseSpotlightView(
  value: string | string[] | undefined,
): SpotlightView {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "entries" || candidate === "matrix"
    ? candidate
    : "categories";
}

export function canLoadSpotlightCategoryData({
  entryCount,
  predictionsRevealed,
  view,
}: {
  entryCount: number;
  predictionsRevealed: boolean;
  view: SpotlightView;
}): boolean {
  return view === "categories" && predictionsRevealed && entryCount > 0;
}

export type SpotlightAliasResolution = Readonly<{
  assetPath: string | null;
  category: PredictionCategory;
  displayName: string;
  normalizedCustomPlayerName: string;
  playerId: string;
}>;

export type SpotlightBoardRow = Readonly<{
  accuracyPoints: number | null;
  assetPath: string | null;
  count: number;
  displayName: string;
  identityKey: string;
  isOther: boolean;
  metricLabel: string | null;
  pickers: readonly Readonly<{
    backgroundColor: string;
    id: string;
    initials: string;
    participantName: string;
  }>[];
  resultRank: number | null;
  resultStatus: "outside-range" | "pending" | "ranked";
  shortName: string | null;
  subject: "player" | "team";
}>;

export type SpotlightCategoryBoard = Readonly<{
  category: PredictionCategory;
  label: string;
  rows: readonly SpotlightBoardRow[];
}>;

const nameCollator = new Intl.Collator("en-GB", {
  numeric: true,
  sensitivity: "base",
});

function aliasKey(
  category: PredictionCategory,
  normalizedCustomPlayerName: string,
): string {
  return `${category}:${normalizedCustomPlayerName}`;
}

function bestResult(
  left: SpotlightPickDisplay | undefined,
  right: SpotlightPickDisplay,
): SpotlightPickDisplay {
  if (!left) return right;
  const leftRank = left.resultRank ?? Number.POSITIVE_INFINITY;
  const rightRank = right.resultRank ?? Number.POSITIVE_INFINITY;
  return rightRank < leftRank ? right : left;
}

export function buildSpotlightCategoryBoard(
  entries: readonly SpotlightAccuracyEntry[],
  options: { aliases?: readonly SpotlightAliasResolution[] } = {},
): SpotlightCategoryBoard[] {
  const aliases = new Map(
    (options.aliases ?? []).map((alias) => [
      aliasKey(alias.category, alias.normalizedCustomPlayerName),
      alias,
    ]),
  );

  return PREDICTION_CATEGORY_DEFINITIONS.map((definition) => {
    const grouped = new Map<
      string,
      {
        alias: SpotlightAliasResolution | null;
        isOther: boolean;
        pick: SpotlightPickDisplay;
        pickers: Array<SpotlightBoardRow["pickers"][number]>;
        result: SpotlightPickDisplay;
      }
    >();

    for (const entry of entries) {
      const pick = entry.spotlightPicks.find(
        (candidate) => candidate.category === definition.category,
      );
      if (!pick) continue;
      const alias = pick.normalizedCustomPlayerName
        ? (aliases.get(
            aliasKey(definition.category, pick.normalizedCustomPlayerName),
          ) ?? null)
        : null;
      const identityKey = pick.teamId
        ? `team:${pick.teamId}`
        : pick.playerId
          ? `player:${pick.playerId}`
          : alias
            ? `player:${alias.playerId}`
            : `custom:${pick.normalizedCustomPlayerName ?? pick.displayName.normalize("NFKC").toLocaleLowerCase("en-GB")}`;
      const current = grouped.get(identityKey);
      const avatar = getEntryAvatar(entry.participantName);
      const picker = {
        ...avatar,
        id: entry.id,
        participantName: entry.participantName,
      };
      if (current) {
        current.pickers.push(picker);
        current.result = bestResult(current.result, pick);
      } else {
        grouped.set(identityKey, {
          alias,
          isOther: Boolean(pick.normalizedCustomPlayerName && !alias),
          pick,
          pickers: [picker],
          result: pick,
        });
      }
    }

    const rows = [...grouped.entries()].map<SpotlightBoardRow>(
      ([identityKey, group]) => ({
        accuracyPoints: group.result.accuracyPoints ?? null,
        assetPath: group.alias?.assetPath ?? group.pick.assetPath ?? null,
        count: group.pickers.length,
        displayName: group.alias?.displayName ?? group.pick.displayName,
        identityKey,
        isOther: group.isOther,
        metricLabel: group.result.metricLabel ?? null,
        pickers: group.pickers,
        resultRank: group.result.resultRank ?? null,
        resultStatus: group.result.resultStatus ?? "pending",
        shortName: group.pick.shortName ?? null,
        subject: group.pick.subject,
      }),
    );
    rows.sort((left, right) => {
      const leftRank = left.resultRank ?? Number.POSITIVE_INFINITY;
      const rightRank = right.resultRank ?? Number.POSITIVE_INFINITY;
      return (
        leftRank - rightRank ||
        right.count - left.count ||
        nameCollator.compare(left.displayName, right.displayName)
      );
    });

    return {
      category: definition.category,
      label: definition.label,
      rows,
    };
  });
}

export type SpotlightMatrixEntry = SpotlightAccuracyEntry & {
  picksByCategory: ReadonlyMap<PredictionCategory, SpotlightPickDisplay>;
};

export function buildSpotlightMatrix(
  entries: readonly SpotlightAccuracyEntry[],
): SpotlightMatrixEntry[] {
  return [...entries]
    .sort(
      (left, right) =>
        left.accuracyRank - right.accuracyRank ||
        nameCollator.compare(left.participantName, right.participantName),
    )
    .map((entry) => ({
      ...entry,
      picksByCategory: new Map(
        entry.spotlightPicks.map((pick) => [pick.category, pick] as const),
      ),
    }));
}
