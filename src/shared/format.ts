const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeZone: "UTC",
});

export function formatUtcDateTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${dateTimeFormatter.format(date)} UTC`;
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
