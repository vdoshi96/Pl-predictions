import { PlayerMark } from "@/components/player-mark";
import { TeamMark } from "@/components/team-mark";
import { cn } from "@/components/ui/cn";
import type { PredictionCategory } from "@/features/predictions/categories";

export type SpotlightPickDisplay = Readonly<{
  assetPath?: string | null;
  category: PredictionCategory;
  displayName: string;
  label: string;
  accuracyPoints?: number | null;
  metricLabel?: string | null;
  resultRank?: number | null;
  shortName?: string | null;
  subject: "player" | "team";
}>;

export interface SpotlightPickGridProps {
  className?: string;
  picks: readonly SpotlightPickDisplay[];
}

export function SpotlightPickGrid({
  className,
  picks,
}: SpotlightPickGridProps) {
  return (
    <div className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {picks.map((pick) => (
        <div
          className="border-border flex min-h-16 min-w-0 items-center gap-2.5 rounded-xl border bg-[#fcf9fd] p-2.5"
          data-category={pick.category}
          key={pick.category}
        >
          {pick.subject === "team" ? (
            <TeamMark
              name={pick.displayName}
              initials={pick.shortName}
              size="sm"
              src={pick.assetPath}
            />
          ) : (
            <PlayerMark
              name={pick.displayName}
              size="sm"
              src={pick.assetPath}
            />
          )}
          <div className="min-w-0 grow">
            <span className="block text-[0.6rem] leading-4 font-black tracking-wide text-[#8f0033] uppercase">
              {pick.label}
            </span>
            <strong className="text-brand-strong block text-xs leading-4 break-words">
              {pick.displayName}
            </strong>
            {pick.resultRank !== null &&
            pick.resultRank !== undefined &&
            pick.accuracyPoints !== null &&
            pick.accuracyPoints !== undefined ? (
              <span className="mt-0.5 block text-[0.65rem] leading-4 font-semibold text-slate-500">
                {pick.metricLabel ? `${pick.metricLabel} · ` : ""}Result rank{" "}
                {pick.resultRank} · {pick.accuracyPoints} accuracy{" "}
                {pick.accuracyPoints === 1 ? "pt" : "pts"}
              </span>
            ) : (
              <span className="mt-0.5 block text-[0.65rem] leading-4 font-semibold text-slate-500">
                Result rank pending
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
