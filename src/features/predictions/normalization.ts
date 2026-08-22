const COLLAPSIBLE_WHITESPACE = /\s+/gu;
const FORMAT_CHARACTERS = /\p{Cf}+/gu;

export function hasDisallowedControlCharacter(value: string): boolean {
  return /[\p{Cc}\p{Cs}\p{Co}\p{Cn}]/u.test(value);
}

/** Normalizes a user-entered display value without removing meaningful text. */
export function normalizeDisplayText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(FORMAT_CHARACTERS, "")
    .trim()
    .replace(COLLAPSIBLE_WHITESPACE, " ");
}

export function normalizeParticipantName(value: string): string {
  return normalizeDisplayText(value);
}

/** Canonical key used by the database's per-season uniqueness constraint. */
export function normalizedParticipantNameKey(value: string): string {
  return normalizeParticipantName(value).toLocaleLowerCase("en-GB");
}

export function normalizedDisplayTextKey(value: string): string {
  return normalizeDisplayText(value).toLocaleLowerCase("en-GB");
}
