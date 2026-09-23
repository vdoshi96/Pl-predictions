import { formatLeagueDateTime, formatUtcDateTime } from "@/shared/format";

export function LeagueTime({
  prefix,
  value,
}: {
  prefix?: string;
  value: Date | string;
}) {
  const date = typeof value === "string" ? new Date(value) : value;
  return (
    <time dateTime={date.toISOString()} title={formatUtcDateTime(date)}>
      {prefix ? `${prefix} ` : ""}
      {formatLeagueDateTime(date)}
    </time>
  );
}
