export type SeasonAccessSettings = {
  revealPredictions: boolean;
  submissionDeadline: Date | null;
  submissionsLocked: boolean;
};

export type SeasonAccess = {
  deadlinePassed: boolean;
  predictionsRevealed: boolean;
  submissionsOpen: boolean;
};

export function getSeasonAccess(
  settings: SeasonAccessSettings,
  now = new Date(),
): SeasonAccess {
  const deadlinePassed =
    settings.submissionDeadline !== null &&
    now.getTime() >= settings.submissionDeadline.getTime();

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
  };
}
