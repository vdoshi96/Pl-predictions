export type SnapshotIdentity = Readonly<{
  capturedAt: Date;
  id: string;
  matchweek: number | null;
}>;

export function selectPreviousMeaningfulSnapshot<T extends SnapshotIdentity>(
  candidates: readonly T[],
  active: SnapshotIdentity,
): T | null {
  const earlierByMatchweek =
    active.matchweek === null
      ? []
      : candidates.filter(
          (candidate) =>
            candidate.id !== active.id &&
            candidate.matchweek !== null &&
            candidate.matchweek < active.matchweek!,
        );

  if (earlierByMatchweek.length > 0) {
    return [...earlierByMatchweek].sort(
      (left, right) =>
        (right.matchweek ?? 0) - (left.matchweek ?? 0) ||
        right.capturedAt.getTime() - left.capturedAt.getTime(),
    )[0]!;
  }

  return (
    candidates
      .filter(
        (candidate) =>
          candidate.id !== active.id &&
          candidate.capturedAt.getTime() < active.capturedAt.getTime(),
      )
      .sort(
        (left, right) => right.capturedAt.getTime() - left.capturedAt.getTime(),
      )[0] ?? null
  );
}

export function computeRankMovement(
  current: readonly { id: string; rank: number }[],
  previous: readonly { id: string; rank: number }[] | null,
): Map<string, number | null> {
  const previousRankById = previous
    ? new Map(previous.map((entry) => [entry.id, entry.rank] as const))
    : null;

  return new Map(
    current.map((entry) => {
      const previousRank = previousRankById?.get(entry.id);
      return [
        entry.id,
        previousRank === undefined ? null : previousRank - entry.rank,
      ] as const;
    }),
  );
}
