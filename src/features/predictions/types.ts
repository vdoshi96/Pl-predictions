import type { ValidatedPredictionCategoryPick } from "./validation";

export type PredictionItemInput = {
  predictedPosition: number;
  teamId: string;
};

export type PredictionSubmissionInput = {
  categoryPicks: ValidatedPredictionCategoryPick[];
  items: PredictionItemInput[];
  participantName: string;
};

export type PredictionWithItems = {
  categoryPicks: ValidatedPredictionCategoryPick[];
  createdAt: Date;
  id: string;
  items: PredictionItemInput[];
  participantName: string;
};
