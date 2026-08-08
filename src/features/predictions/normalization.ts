const COLLAPSIBLE_WHITESPACE = /\s+/gu;

/** Normalizes the display value without silently removing meaningful text. */
export function normalizeParticipantName(value: string): string {
  return value.normalize("NFKC").trim().replace(COLLAPSIBLE_WHITESPACE, " ");
}

/** Canonical key used by the database's per-season uniqueness constraint. */
export function normalizedParticipantNameKey(value: string): string {
  return normalizeParticipantName(value).toLocaleLowerCase("en-GB");
}
