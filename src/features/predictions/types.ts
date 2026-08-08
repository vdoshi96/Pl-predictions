export type PredictionItemInput = {
  predictedPosition: number;
  teamId: string;
};

export type PredictionSubmissionInput = {
  items: PredictionItemInput[];
  participantName: string;
};

export type PredictionWithItems = {
  createdAt: Date;
  id: string;
  items: PredictionItemInput[];
  participantName: string;
};
