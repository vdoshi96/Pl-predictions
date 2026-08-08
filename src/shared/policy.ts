import {
  getEffectiveSubmissionDeadline,
  hasSeasonStarted,
} from "@/features/seasons/deadline";

export type SeasonAccessSettings = {
  openingKickoff: Date;
  revealPredictions: boolean;
  submissionDeadline: Date | null;
  submissionsLocked: boolean;
};

export type SeasonAccess = {
  deadlinePassed: boolean;
  predictionsRevealed: boolean;
  seasonStarted: boolean;
  submissionDeadline: Date;
  submissionsOpen: boolean;
};

export function getSeasonAccess(
  settings: SeasonAccessSettings,
  now: Date,
): SeasonAccess {
  const submissionDeadline = getEffectiveSubmissionDeadline(
    settings.submissionDeadline,
    settings.openingKickoff,
  );
  const deadlinePassed = now.getTime() >= submissionDeadline.getTime();

  return {
    deadlinePassed,
    submissionsOpen:
      !settings.revealPredictions &&
      !settings.submissionsLocked &&
      !deadlinePassed,
    predictionsRevealed:
      settings.revealPredictions ||
      settings.submissionsLocked ||
      deadlinePassed,
    seasonStarted: hasSeasonStarted(now, settings.openingKickoff),
    submissionDeadline,
  };
}
