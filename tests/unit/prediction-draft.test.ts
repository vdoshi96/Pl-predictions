import { describe, expect, it } from "vitest";

import { PREMIER_LEAGUE_2026_27_TEAMS } from "@/data/teams";
import {
  parsePredictionDraft,
  predictionDraftStorageKey,
  serializePredictionDraft,
  type PredictionDraft,
} from "@/features/predictions/prediction-draft";
import type { PredictionTeam } from "@/features/predictions/prediction-sorter";

const seasonSlug = "2026-27";
const teams: PredictionTeam[] = PREMIER_LEAGUE_2026_27_TEAMS.map((team) => ({
  assetPath: team.assetPath,
  displayName: team.displayName,
  id: team.slug,
  shortName: team.shortName,
  sortName: team.sortName,
}));
const alphabeticalTeamIds = [...teams]
  .sort(
    (left, right) =>
      left.sortName.localeCompare(right.sortName, "en", {
        sensitivity: "base",
      }) || left.id.localeCompare(right.id),
  )
  .map((team) => team.id);

describe("prediction draft persistence", () => {
  it("uses a versioned, season-keyed localStorage key", () => {
    expect(predictionDraftStorageKey(seasonSlug)).toBe(
      "dranx:prediction-draft:v1:2026-27",
    );
    expect(predictionDraftStorageKey("season / two")).toBe(
      "dranx:prediction-draft:v1:season%20%2F%20two",
    );
  });

  it("round-trips the table, name, stage, and player display metadata", () => {
    const draft: PredictionDraft = {
      orderedTeamIds: [...alphabeticalTeamIds].reverse(),
      participantName: "Alex Smith",
      spotlightPicks: {
        most_clean_sheets: { kind: "team", teamId: "arsenal" },
        top_assister: {
          assetPath: "/player-faces/bukayo-saka.png",
          displayName: "Bukayo Saka",
          kind: "player",
          playerId: "bukayo-saka",
        },
        top_scorer: {
          customPlayerName: "New Signing",
          kind: "custom-player",
        },
      },
      stage: "spotlight",
    };

    const serialized = serializePredictionDraft(draft, seasonSlug);
    const stored = JSON.parse(serialized) as Record<string, unknown>;

    expect(stored.savedAt).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(String(stored.savedAt)))).toBe(false);
    expect(parsePredictionDraft(serialized, seasonSlug, teams)).toEqual(draft);
  });

  it("rejects malformed, stale-version, and cross-season drafts", () => {
    expect(parsePredictionDraft("{", seasonSlug, teams)).toBeNull();
    expect(
      parsePredictionDraft(
        JSON.stringify({ seasonSlug, version: 2 }),
        seasonSlug,
        teams,
      ),
    ).toBeNull();
    expect(
      parsePredictionDraft(
        JSON.stringify({
          seasonSlug,
          version: 1,
        }),
        seasonSlug,
        teams,
      ),
    ).toBeNull();
    expect(
      parsePredictionDraft(
        JSON.stringify({
          savedAt: "not-a-date",
          seasonSlug,
          version: 1,
        }),
        seasonSlug,
        teams,
      ),
    ).toBeNull();
    expect(
      parsePredictionDraft(
        JSON.stringify({
          savedAt: "2026-08-14T12:00:00.000Z",
          seasonSlug: "2027-28",
          version: 1,
        }),
        seasonSlug,
        teams,
      ),
    ).toBeNull();
  });

  it("rejects a draft without the exact current team permutation", () => {
    expect(
      parsePredictionDraft(
        JSON.stringify({
          orderedTeamIds: ["arsenal", "unknown-team"],
          participantName: "Alex",
          savedAt: "2026-08-14T12:00:00.000Z",
          seasonSlug,
          spotlightPicks: {},
          stage: "table",
          version: 1,
        }),
        seasonSlug,
        [...teams].reverse(),
      ),
    ).toBeNull();
  });

  it("keeps a valid order while discarding stale or mismatched picks", () => {
    const restored = parsePredictionDraft(
      JSON.stringify({
        orderedTeamIds: alphabeticalTeamIds,
        participantName: "Alex",
        savedAt: "2026-08-14T12:00:00.000Z",
        seasonSlug,
        spotlightPicks: {
          most_clean_sheets: { kind: "team", teamId: "unknown-team" },
          top_assister: {
            assetPath: "https://example.com/player.png",
            displayName: "Bukayo Saka",
            kind: "player",
            playerId: "bukayo-saka",
          },
          top_scorer: { kind: "team", teamId: "arsenal" },
          unknown_category: { kind: "team", teamId: "arsenal" },
        },
        stage: "spotlight",
        version: 1,
      }),
      seasonSlug,
      [...teams].reverse(),
    );

    expect(restored).not.toBeNull();
    expect(restored?.orderedTeamIds).toEqual(alphabeticalTeamIds);
    expect(restored?.spotlightPicks).toEqual({
      top_assister: {
        assetPath: null,
        displayName: "Bukayo Saka",
        kind: "player",
        playerId: "bukayo-saka",
      },
    });
  });

  it("returns to the table for an invalid name and bounds stored text", () => {
    const restored = parsePredictionDraft(
      JSON.stringify({
        orderedTeamIds: alphabeticalTeamIds,
        participantName: "x".repeat(41),
        savedAt: "2026-08-14T12:00:00.000Z",
        seasonSlug,
        spotlightPicks: {
          top_scorer: {
            customPlayerName: "x".repeat(121),
            kind: "custom-player",
          },
        },
        stage: "spotlight",
        version: 1,
      }),
      seasonSlug,
      teams,
    );

    expect(restored).toMatchObject({
      participantName: "",
      spotlightPicks: {},
      stage: "table",
    });
  });
});
