"use client";

import { Sparkles } from "lucide-react";
import { useMemo } from "react";

import { PlayerMark } from "@/components/player-mark";
import { TeamMark } from "@/components/team-mark";
import { Card, CardContent } from "@/components/ui/card";

import {
  PREDICTION_CATEGORY_DEFINITIONS,
  type PlayerPredictionCategory,
  type PredictionCategory,
  type TeamPredictionCategory,
} from "./categories";
import type { PredictionTeam } from "./prediction-sorter";
import {
  SearchablePredictionSelect,
  type SearchablePredictionOption,
} from "./searchable-prediction-select";

export interface PredictionPlayer {
  assetPath?: string | null;
  displayName: string;
  firstName?: string | null;
  id: string;
  lastName?: string | null;
}

export type SpotlightPickDraft =
  | { kind: "custom-player"; customPlayerName: string }
  | { kind: "player"; playerId: string }
  | { kind: "team"; teamId: string };

export type SpotlightPicksDraft = Partial<
  Record<PredictionCategory, SpotlightPickDraft>
>;

export type SpotlightCategorySubmissionPick =
  | { category: PlayerPredictionCategory; customPlayerName: string }
  | { category: PlayerPredictionCategory; playerId: string }
  | { category: TeamPredictionCategory; teamId: string };

export type SpotlightReviewItem = Readonly<{
  assetPath?: string | null;
  category: PredictionCategory;
  displayName: string;
  label: string;
  shortName?: string | null;
  subject: "player" | "team";
}>;

function normalizedCustomName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

function normalizedCustomNameKey(value: string) {
  return normalizedCustomName(value).toLocaleLowerCase("en-GB");
}

export function spotlightPicksAreComplete(picks: SpotlightPicksDraft): boolean {
  return PREDICTION_CATEGORY_DEFINITIONS.every((definition) => {
    const pick = picks[definition.category];
    if (!pick) return false;

    if (definition.subject === "team") {
      return pick.kind === "team" && Boolean(pick.teamId);
    }

    if (pick.kind === "player") return Boolean(pick.playerId);
    return (
      pick.kind === "custom-player" &&
      normalizedCustomName(pick.customPlayerName).length >= 2 &&
      normalizedCustomName(pick.customPlayerName).length <= 120 &&
      normalizedCustomNameKey(pick.customPlayerName).length <= 120
    );
  });
}

export function buildSpotlightCategoryPicks(
  picks: SpotlightPicksDraft,
): SpotlightCategorySubmissionPick[] {
  if (!spotlightPicksAreComplete(picks)) {
    throw new Error("Complete all seven spotlight picks before submission.");
  }

  return PREDICTION_CATEGORY_DEFINITIONS.map((definition) => {
    const pick = picks[definition.category]!;
    if (pick.kind === "team") {
      return {
        category: definition.category as TeamPredictionCategory,
        teamId: pick.teamId,
      };
    }
    if (pick.kind === "player") {
      return {
        category: definition.category as PlayerPredictionCategory,
        playerId: pick.playerId,
      };
    }
    return {
      category: definition.category as PlayerPredictionCategory,
      customPlayerName: normalizedCustomName(pick.customPlayerName),
    };
  });
}

export function buildSpotlightReviewItems(
  picks: SpotlightPicksDraft,
  players: readonly PredictionPlayer[],
  teams: readonly PredictionTeam[],
): SpotlightReviewItem[] {
  const playerById = new Map(players.map((player) => [player.id, player]));
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const reviewItems: SpotlightReviewItem[] = [];

  for (const definition of PREDICTION_CATEGORY_DEFINITIONS) {
    const pick = picks[definition.category];
    if (!pick) continue;

    if (pick.kind === "team") {
      const team = teamById.get(pick.teamId);
      if (team) {
        reviewItems.push({
          assetPath: team.assetPath,
          category: definition.category,
          displayName: team.displayName,
          label: definition.label,
          shortName: team.shortName,
          subject: "team",
        });
      }
      continue;
    }

    if (pick.kind === "player") {
      const player = playerById.get(pick.playerId);
      if (player) {
        reviewItems.push({
          assetPath: player.assetPath,
          category: definition.category,
          displayName: player.displayName,
          label: definition.label,
          subject: "player",
        });
      }
      continue;
    }

    reviewItems.push({
      category: definition.category,
      displayName: normalizedCustomName(pick.customPlayerName),
      label: definition.label,
      subject: "player",
    });
  }

  return reviewItems;
}

export interface SpotlightPredictionsFormProps {
  disabled?: boolean;
  invalid?: boolean;
  onChange: (picks: SpotlightPicksDraft) => void;
  picks: SpotlightPicksDraft;
  players: readonly PredictionPlayer[];
  teams: readonly PredictionTeam[];
}

export function SpotlightPredictionsForm({
  disabled = false,
  invalid = false,
  onChange,
  picks,
  players,
  teams,
}: SpotlightPredictionsFormProps) {
  const teamOptions = useMemo<SearchablePredictionOption[]>(
    () =>
      teams.map((team) => ({
        displayName: team.displayName,
        id: team.id,
        searchText: `${team.displayName} ${team.shortName} ${team.sortName}`,
      })),
    [teams],
  );
  const playerOptions = useMemo<SearchablePredictionOption[]>(
    () =>
      players.map((player) => ({
        displayName: player.displayName,
        id: player.id,
        searchText: [player.firstName, player.lastName, player.displayName]
          .filter(Boolean)
          .join(" "),
      })),
    [players],
  );
  const teamById = useMemo(
    () => new Map(teams.map((team) => [team.id, team])),
    [teams],
  );
  const playerById = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );

  function updatePick(
    category: PredictionCategory,
    nextPick: SpotlightPickDraft | null,
  ) {
    const nextPicks = { ...picks };
    if (nextPick) nextPicks[category] = nextPick;
    else delete nextPicks[category];
    onChange(nextPicks);
  }

  return (
    <section aria-labelledby="spotlight-picks-heading" className="grid gap-4">
      <Card className="border-accent-lilac/30 overflow-visible bg-[#fcf9fd]">
        <CardContent className="flex items-start gap-3">
          <span className="bg-brand text-accent grid size-11 shrink-0 place-items-center rounded-xl">
            <Sparkles aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-xs font-black tracking-[0.12em] text-[#8f0033] uppercase">
              Step 2 of 3
            </p>
            <h2
              id="spotlight-picks-heading"
              tabIndex={-1}
              className="text-brand-strong mt-1 text-2xl font-black tracking-tight outline-none"
            >
              Make your spotlight picks
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {players.length > 0
                ? `Search ${players.length.toLocaleString("en-GB")} players by first or last name. Other player remains available for anyone new or unavailable, and missing portraits use a silhouette.`
                : "No player catalogue is loaded yet. Other player remains available in every player category."}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {PREDICTION_CATEGORY_DEFINITIONS.map((definition) => {
          const pick = picks[definition.category];
          const isPlayer = definition.subject === "player";
          const selectedValue = isPlayer
            ? pick?.kind === "player"
              ? pick.playerId
              : pick?.kind === "custom-player"
                ? "other"
                : null
            : pick?.kind === "team"
              ? pick.teamId
              : null;
          const otherValue =
            pick?.kind === "custom-player" ? pick.customPlayerName : "";
          const pickInvalid =
            invalid &&
            (!pick ||
              (pick.kind === "custom-player" &&
                (normalizedCustomName(pick.customPlayerName).length < 2 ||
                  normalizedCustomNameKey(pick.customPlayerName).length >
                    120)));

          return (
            <Card
              className="overflow-visible"
              data-category={definition.category}
              key={definition.category}
            >
              <CardContent>
                <SearchablePredictionSelect
                  allowOther={isPlayer}
                  description={definition.description}
                  disabled={disabled}
                  emptyMessage={
                    isPlayer
                      ? players.length > 0
                        ? "No matching player. Try another search or choose Other player below."
                        : "No player catalogue is loaded. Choose Other player below."
                      : "No matching club. Try another search."
                  }
                  invalid={pickInvalid}
                  invalidMessage={
                    isPlayer
                      ? pick?.kind === "custom-player"
                        ? "Enter a valid player name between 2 and 120 characters."
                        : "Choose a player or select Other player."
                      : "Choose a club."
                  }
                  label={definition.label}
                  onChange={(nextValue) => {
                    if (nextValue === null) {
                      updatePick(definition.category, null);
                    } else if (nextValue === "other") {
                      updatePick(definition.category, {
                        customPlayerName:
                          pick?.kind === "custom-player"
                            ? pick.customPlayerName
                            : "",
                        kind: "custom-player",
                      });
                    } else if (isPlayer) {
                      updatePick(definition.category, {
                        kind: "player",
                        playerId: nextValue,
                      });
                    } else {
                      updatePick(definition.category, {
                        kind: "team",
                        teamId: nextValue,
                      });
                    }
                  }}
                  onOtherValueChange={(customPlayerName) =>
                    updatePick(definition.category, {
                      customPlayerName,
                      kind: "custom-player",
                    })
                  }
                  options={isPlayer ? playerOptions : teamOptions}
                  otherValue={otherValue}
                  renderLeading={(option) => {
                    if (isPlayer) {
                      const player = playerById.get(option.id);
                      return player ? (
                        <PlayerMark
                          decorative
                          name={player.displayName}
                          size="sm"
                          src={player.assetPath}
                        />
                      ) : null;
                    }

                    const team = teamById.get(option.id);
                    return team ? (
                      <TeamMark
                        className="ring-0 ring-offset-0"
                        decorative
                        name={team.displayName}
                        initials={team.shortName}
                        size="sm"
                        src={team.assetPath}
                      />
                    ) : null;
                  }}
                  value={selectedValue}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
