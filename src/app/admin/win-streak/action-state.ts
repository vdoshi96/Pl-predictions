export type WinStreakResultActionState = Readonly<{
  message: string;
  ok: boolean;
}>;

export const INITIAL_WIN_STREAK_RESULT_ACTION_STATE = {
  message: "",
  ok: false,
} as const satisfies WinStreakResultActionState;
