import { formatLeagueDay, formatLeagueTime } from "@/shared/format";

export type FixtureDayGroup<T extends { kickoffAt: string }> = {
  dayLabel: string;
  fixtures: (T & { timeLabel: string })[];
};

export function groupFixturesByLeagueDay<T extends { kickoffAt: string }>(
  fixtures: readonly T[],
): FixtureDayGroup<T>[] {
  const groups: FixtureDayGroup<T>[] = [];
  const sorted = [...fixtures].sort(
    (left, right) => Date.parse(left.kickoffAt) - Date.parse(right.kickoffAt),
  );
  for (const fixture of sorted) {
    const dayLabel = formatLeagueDay(fixture.kickoffAt);
    const withTime = {
      ...fixture,
      timeLabel: formatLeagueTime(fixture.kickoffAt),
    };
    const current = groups.at(-1);
    if (current?.dayLabel === dayLabel) current.fixtures.push(withTime);
    else groups.push({ dayLabel, fixtures: [withTime] });
  }
  return groups;
}
