export const WIN_STREAK_ROUND_OUTCOMES = [
  "Win → +1, club used",
  "Draw or loss → reset",
  "Missed → held",
] as const;

export function RoundOutcomeChips() {
  return (
    <ul aria-label="How a round scores" className="flex flex-wrap gap-1.5">
      {WIN_STREAK_ROUND_OUTCOMES.map((outcome, index) => (
        <li
          className={`rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${index === 0 ? "bg-mint text-mint-ink" : "bg-brand-soft text-brand-ink"}`}
          key={outcome}
        >
          {outcome}
        </li>
      ))}
    </ul>
  );
}
