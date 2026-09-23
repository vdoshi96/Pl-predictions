export type EntryReference = Readonly<{ id: string; participantName: string }>;

export type AdjacentEntries = Readonly<{
  next: EntryReference | null;
  position: number;
  previous: EntryReference | null;
  total: number;
}>;

export function findAdjacentEntries(
  ordered: readonly EntryReference[],
  currentId: string,
): AdjacentEntries | null {
  const index = ordered.findIndex((entry) => entry.id === currentId);
  if (index < 0) return null;
  return {
    next: ordered[index + 1] ?? null,
    position: index + 1,
    previous: ordered[index - 1] ?? null,
    total: ordered.length,
  };
}
