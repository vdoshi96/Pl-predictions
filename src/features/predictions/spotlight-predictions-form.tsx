"use client";

import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

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
  | {
      assetPath?: string | null;
      displayName: string;
      kind: "player";
      playerId: string;
    }
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
  return spotlightIncompleteCategories(picks).length === 0;
}

export function spotlightIncompleteCategories(
  picks: SpotlightPicksDraft,
): PredictionCategory[] {
  return PREDICTION_CATEGORY_DEFINITIONS.flatMap((definition) => {
    const pick = picks[definition.category];
    if (!pick) return [definition.category];

    if (definition.subject === "team") {
      return pick.kind === "team" && Boolean(pick.teamId)
        ? []
        : [definition.category];
    }

    if (pick.kind === "player") {
      return pick.playerId && pick.displayName.trim()
        ? []
        : [definition.category];
    }
    return pick.kind === "custom-player" &&
      normalizedCustomName(pick.customPlayerName).length >= 2 &&
      normalizedCustomName(pick.customPlayerName).length <= 120 &&
      normalizedCustomNameKey(pick.customPlayerName).length <= 120
      ? []
      : [definition.category];
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
      reviewItems.push({
        assetPath: player?.assetPath ?? pick.assetPath,
        category: definition.category,
        displayName: player?.displayName ?? pick.displayName,
        label: definition.label,
        subject: "player",
      });
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
  invalidCategory?: PredictionCategory | null;
  invalidCount?: number;
  onChange: (
    update: (currentPicks: SpotlightPicksDraft) => SpotlightPicksDraft,
  ) => void;
  onSelectorExpandedChange?: (
    category: PredictionCategory,
    expanded: boolean,
  ) => void;
  picks: SpotlightPicksDraft;
  players: readonly PredictionPlayer[];
  teams: readonly PredictionTeam[];
}

export function SpotlightPredictionsForm({
  disabled = false,
  invalidCategory = null,
  invalidCount = 0,
  onChange,
  onSelectorExpandedChange,
  picks,
  players,
  teams,
}: SpotlightPredictionsFormProps) {
  const [expandedSelectorCategory, setExpandedSelectorCategory] =
    useState<PredictionCategory | null>(null);
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
        assetPath: player.assetPath,
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
    onChange((currentPicks) => {
      const nextPicks = { ...currentPicks };
      if (nextPick) nextPicks[category] = nextPick;
      else delete nextPicks[category];
      return nextPicks;
    });
  }

  return (
    <section aria-labelledby="spotlight-picks-heading" className="grid gap-4">
      <Card className="border-accent-lilac/30 bg-surface-lilac overflow-visible">
        <CardContent className="flex items-start gap-3">
          <span className="bg-brand text-accent grid size-11 shrink-0 place-items-center rounded-xl">
            <Sparkles aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-rose-ink text-xs font-black tracking-[0.12em] uppercase">
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
                ? `Type at least 2 letters to search ${players.length.toLocaleString("en-GB")} ${players.length === 1 ? "player" : "players"} by name. Up to 20 matches are shown, and Other player remains available for anyone new or unavailable.`
                : "No player catalogue is loaded yet. Other player remains available in every player category."}
            </p>
          </div>
        </CardContent>
      </Card>

      {invalidCount > 0 ? (
        <p
          className="border-danger/25 bg-danger-soft text-danger rounded-xl border p-3 text-sm leading-5 font-bold outline-none"
          data-spotlight-validation-summary="true"
          role="alert"
          tabIndex={-1}
        >
          {invalidCount} of 7 spotlight prediction
          {invalidCount === 1 ? " is" : "s are"} still incomplete. Complete the
          highlighted choice to continue.
        </p>
      ) : null}

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
          const pickInvalid = invalidCategory === definition.category;

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
                  expanded={
                    !disabled &&
                    expandedSelectorCategory === definition.category
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
                  maximumResults={isPlayer ? 20 : undefined}
                  minimumQueryLength={isPlayer ? 2 : 0}
                  minimumQueryMessage="Type at least 2 letters to search players."
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
                      const player = playerById.get(nextValue);
                      updatePick(
                        definition.category,
                        player
                          ? {
                              assetPath: player.assetPath,
                              displayName: player.displayName,
                              kind: "player",
                              playerId: player.id,
                            }
                          : null,
                      );
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
                  onExpandedChange={(expanded) => {
                    setExpandedSelectorCategory((current) =>
                      expanded
                        ? definition.category
                        : current === definition.category
                          ? null
                          : current,
                    );
                    onSelectorExpandedChange?.(definition.category, expanded);
                  }}
                  options={isPlayer ? playerOptions : teamOptions}
                  otherValue={otherValue}
                  renderLeading={(option) => {
                    if (isPlayer) {
                      return (
                        <PlayerMark
                          decorative
                          name={option.displayName}
                          size="sm"
                          src={option.assetPath}
                        />
                      );
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
                  selectedOption={
                    pick?.kind === "player"
                      ? {
                          assetPath: pick.assetPath,
                          displayName: pick.displayName,
                          id: pick.playerId,
                          searchText: pick.displayName,
                        }
                      : null
                  }
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
