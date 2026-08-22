import {
  calculateTeamExpectationIndexes,
  rankTeamExpectationIndexes,
} from "@/features/scoring";

export type SeasonTableTeam = Readonly<{
  assetPath: string;
  displayName: string;
  id: string;
  shortName: string;
}>;

export type SeasonTableRow = Readonly<{
  actualPosition: number;
  avgPredicted: number | null;
  delta: number | null;
  leaguePoints: number | null;
  team: SeasonTableTeam;
}>;

export type SeasonTableCallout = Readonly<{
  actualPosition: number;
  avgPredicted: number;
  team: SeasonTableTeam;
}>;

export function buildSeasonTablePresentation({
  actualTable,
  consensusActive,
  predictionTables,
  teams,
}: {
  actualTable: readonly {
    actualPosition: number;
    leaguePoints: number | null;
    teamId: string;
  }[];
  consensusActive: boolean;
  predictionTables: readonly (readonly {
    predictedPosition: number;
    teamId: string;
  }[])[];
  teams: readonly SeasonTableTeam[];
}): {
  callouts: {
    overachiever: SeasonTableCallout | null;
    underachiever: SeasonTableCallout | null;
  };
  rows: SeasonTableRow[];
} {
  const teamById = new Map(teams.map((team) => [team.id, team] as const));
  const indexes =
    consensusActive && predictionTables.length > 0
      ? calculateTeamExpectationIndexes(predictionTables, actualTable)
      : [];
  const indexByTeamId = new Map(
    indexes.map((index) => [index.teamId, index] as const),
  );
  const rows = [...actualTable]
    .sort((left, right) => left.actualPosition - right.actualPosition)
    .map((item) => {
      const team = teamById.get(item.teamId);
      if (!team)
        throw new Error("Every standings row must match a season team.");
      const index = indexByTeamId.get(item.teamId);
      return {
        actualPosition: item.actualPosition,
        avgPredicted: index?.averagePredictedPosition ?? null,
        delta: index?.underdogIndex ?? null,
        leaguePoints: item.leaguePoints,
        team,
      };
    });

  function calloutFor(
    category: "overrated" | "underdog",
  ): SeasonTableCallout | null {
    const leader = rankTeamExpectationIndexes(indexes, category).find(
      (item) => item.rank === 1,
    );
    if (!leader) return null;
    const team = teamById.get(leader.teamId);
    if (!team) throw new Error("Every expectation index must match a team.");
    return {
      actualPosition: leader.actualPosition,
      avgPredicted: leader.averagePredictedPosition,
      team,
    };
  }

  return {
    callouts: {
      overachiever: calloutFor("underdog"),
      underachiever: calloutFor("overrated"),
    },
    rows,
  };
}

export function formatConsensusValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return (Object.is(rounded, -0) ? 0 : rounded).toFixed(1);
}

export function formatExpectationIndex(value: number): string {
  const formatted = formatConsensusValue(value);
  return `Index ${Number(formatted) > 0 ? "+" : ""}${formatted}`;
}
