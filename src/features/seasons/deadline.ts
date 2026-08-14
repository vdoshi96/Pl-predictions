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
 * The first league kickoff is the sole timed submission deadline. The legacy
 * configured value remains in the database for compatibility but is ignored.
 */
export function getEffectiveSubmissionDeadline(
  openingKickoff = getOpeningKickoff(),
): Date {
  return new Date(openingKickoff.getTime());
}

export function hasSeasonStarted(
  now: Date,
  openingKickoff = getOpeningKickoff(),
): boolean {
  return now.getTime() >= openingKickoff.getTime();
}
