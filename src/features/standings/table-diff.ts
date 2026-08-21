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
