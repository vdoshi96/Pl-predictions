import {
  PREDICTION_CATEGORY_DEFINITIONS,
  type PredictionCategory,
} from "./categories";
import type { PredictionTeam } from "./prediction-sorter";
import type {
  SpotlightPickDraft,
  SpotlightPicksDraft,
} from "./spotlight-predictions-form";

const DRAFT_VERSION = 1;
const STORAGE_PREFIX = "dranx:prediction-draft";

export type PredictionDraftStage = "table" | "spotlight";

export type PredictionDraft = Readonly<{
  orderedTeamIds: string[];
  participantName: string;
  spotlightPicks: SpotlightPicksDraft;
  stage: PredictionDraftStage;
}>;

type StoredPredictionDraft = PredictionDraft & {
  savedAt: string;
  seasonSlug: string;
  version: typeof DRAFT_VERSION;
};

const definitionByCategory = new Map(
  PREDICTION_CATEGORY_DEFINITIONS.map((definition) => [
    definition.category,
    definition,
  ]),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maximumLength: number) {
  return typeof value === "string" && value.length <= maximumLength
    ? value
    : null;
}

function safePlayerAssetPath(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.length > 256) return null;
  return value.startsWith("/player-faces/") && !value.includes("..")
    ? value
    : null;
}

function parsePick(
  category: PredictionCategory,
  value: unknown,
  currentTeamIds: ReadonlySet<string>,
): SpotlightPickDraft | null {
  if (!isRecord(value)) return null;

  const definition = definitionByCategory.get(category);
  if (!definition) return null;

  if (definition.subject === "team") {
    const teamId = boundedString(value.teamId, 100);
    return value.kind === "team" && teamId && currentTeamIds.has(teamId)
      ? { kind: "team", teamId }
      : null;
  }

  if (value.kind === "custom-player") {
    const customPlayerName = boundedString(value.customPlayerName, 120);
    return customPlayerName === null
      ? null
      : { customPlayerName, kind: "custom-player" };
  }

  if (value.kind === "player") {
    const playerId = boundedString(value.playerId, 100);
    const displayName = boundedString(value.displayName, 120);
    if (!playerId || !displayName?.trim()) return null;

    return {
      assetPath: safePlayerAssetPath(value.assetPath),
      displayName,
      kind: "player",
      playerId,
    };
  }

  return null;
}

function parsePicks(
  value: unknown,
  currentTeamIds: ReadonlySet<string>,
): SpotlightPicksDraft {
  if (!isRecord(value)) return {};

  const picks: SpotlightPicksDraft = {};
  for (const definition of PREDICTION_CATEGORY_DEFINITIONS) {
    const pick = parsePick(
      definition.category,
      value[definition.category],
      currentTeamIds,
    );
    if (pick) picks[definition.category] = pick;
  }
  return picks;
}

function defaultOrder(teams: readonly PredictionTeam[]) {
  return [...teams]
    .sort((left, right) => {
      const bySortName = left.sortName.localeCompare(right.sortName, "en", {
        sensitivity: "base",
      });
      return bySortName || left.id.localeCompare(right.id);
    })
    .map((team) => team.id);
}

function parseOrder(
  value: unknown,
  teams: readonly PredictionTeam[],
): string[] | null {
  const expectedOrder = defaultOrder(teams);
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return null;
  }

  const order = value as string[];
  const currentTeamIds = new Set(expectedOrder);
  return order.length === expectedOrder.length &&
    new Set(order).size === expectedOrder.length &&
    order.every((teamId) => currentTeamIds.has(teamId))
    ? [...order]
    : null;
}

export function predictionDraftStorageKey(seasonSlug: string) {
  return `${STORAGE_PREFIX}:v${DRAFT_VERSION}:${encodeURIComponent(seasonSlug)}`;
}

export function parsePredictionDraft(
  serialized: string,
  seasonSlug: string,
  teams: readonly PredictionTeam[],
): PredictionDraft | null {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    return null;
  }

  if (
    !isRecord(value) ||
    value.version !== DRAFT_VERSION ||
    value.seasonSlug !== seasonSlug ||
    typeof value.savedAt !== "string" ||
    Number.isNaN(Date.parse(value.savedAt))
  ) {
    return null;
  }

  const participantName = boundedString(value.participantName, 40) ?? "";
  const orderedTeamIds = parseOrder(value.orderedTeamIds, teams);
  if (!orderedTeamIds) return null;
  const currentTeamIds = new Set(teams.map((team) => team.id));
  const spotlightPicks = parsePicks(value.spotlightPicks, currentTeamIds);
  const normalizedNameLength = participantName
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ").length;
  const stage =
    value.stage === "spotlight" && normalizedNameLength >= 2
      ? "spotlight"
      : "table";

  return { orderedTeamIds, participantName, spotlightPicks, stage };
}

export function serializePredictionDraft(
  draft: PredictionDraft,
  seasonSlug: string,
) {
  const storedDraft: StoredPredictionDraft = {
    ...draft,
    savedAt: new Date().toISOString(),
    seasonSlug,
    version: DRAFT_VERSION,
  };
  return JSON.stringify(storedDraft);
}
