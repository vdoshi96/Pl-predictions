import { ACTIVE_SEASON } from "@/data/season";

const openingKickoffMs = Date.parse(ACTIVE_SEASON.openingFixture.kickoffIso);

if (!Number.isFinite(openingKickoffMs)) {
  throw new Error(
    "The active season opening kickoff must be a valid ISO time.",
  );
}

export function getOpeningKickoff(): Date {
  return new Date(openingKickoffMs);
}

/**
 * The first league kickoff is a non-extendable submission ceiling. The owner
 * may still choose an earlier deadline, manually lock, or reveal early.
 */
export function getEffectiveSubmissionDeadline(
  configuredDeadline: Date | null,
  openingKickoff = getOpeningKickoff(),
): Date {
  if (
    configuredDeadline &&
    configuredDeadline.getTime() < openingKickoff.getTime()
  ) {
    return new Date(configuredDeadline.getTime());
  }

  return new Date(openingKickoff.getTime());
}

export function assertDeadlineNotAfterOpeningKickoff(
  configuredDeadline: Date,
  openingKickoff = getOpeningKickoff(),
): void {
  if (configuredDeadline.getTime() > openingKickoff.getTime()) {
    throw new RangeError(
      "The submission deadline cannot be after the Gameweek 1 opening kickoff.",
    );
  }
}

export function parseOptionalUtcDeadline(
  value: string,
  openingKickoff = getOpeningKickoff(),
): Date | null {
  const candidate = value.trim();
  if (!candidate) return null;

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(candidate)) {
    throw new RangeError(
      "The submission deadline must be a UTC date and time.",
    );
  }

  const normalized = `${candidate}:00.000Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== normalized) {
    throw new RangeError("The submission deadline must be a real UTC time.");
  }

  assertDeadlineNotAfterOpeningKickoff(parsed, openingKickoff);
  return parsed.getTime() === openingKickoff.getTime() ? null : parsed;
}

export function hasSeasonStarted(
  now: Date,
  openingKickoff = getOpeningKickoff(),
): boolean {
  return now.getTime() >= openingKickoff.getTime();
}
