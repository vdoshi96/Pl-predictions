const dateTimeFormatters = {
  chicago: new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "short",
    timeZone: "America/Chicago",
    timeZoneName: "short",
    year: "numeric",
  }),
  utc: new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
    timeZoneName: "short",
    year: "numeric",
  }),
} as const;

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeZone: "UTC",
});

function formatDateTimePart(
  value: Date,
  formatter: Intl.DateTimeFormat,
): string {
  const parts = new Map(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.get("day")} ${parts.get("month")} ${parts.get("year")}, ${parts.get("hour")}:${parts.get("minute")} ${parts.get("timeZoneName")}`;
}

export function formatChicagoUtcDateTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${formatDateTimePart(date, dateTimeFormatters.chicago)} · ${formatDateTimePart(date, dateTimeFormatters.utc)}`;
}

export function formatUtcDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return dateFormatter.format(date);
}

export function ordinal(value: number) {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${value}th`;

  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}
