import { cn } from "@/components/ui/cn";

export function ScoreBreakdownBar({
  className,
  correctHalf,
  exact,
  missed,
  size = "sm",
  withinThree,
}: {
  className?: string;
  correctHalf: number;
  exact: number;
  missed?: number;
  size?: "sm" | "lg";
  withinThree: number;
}) {
  const label = [
    `${exact} exact`,
    `${withinThree} within three places`,
    `${correctHalf} in the correct half`,
    ...(missed === undefined ? [] : [`${missed} missed`]),
  ].join(", ");

  return (
    <span
      aria-label={label}
      className={cn("score-bar", className)}
      data-size={size}
      role="img"
    >
      <span data-tier="exact" style={{ width: `${exact * 5}%` }} />
      <span data-tier="within-three" style={{ width: `${withinThree * 3}%` }} />
      <span data-tier="correct-half" style={{ width: `${correctHalf}%` }} />
    </span>
  );
}
