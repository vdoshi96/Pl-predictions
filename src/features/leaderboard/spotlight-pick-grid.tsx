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
  normalizedCustomPlayerName?: string | null;
  playerId?: string | null;
  resultRank?: number | null;
  resultStatus?: "outside-range" | "ranked";
  shortName?: string | null;
  subject: "player" | "team";
  teamId?: string | null;
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
          className="border-border bg-surface-lilac flex min-h-16 min-w-0 items-center gap-2.5 rounded-xl border p-2.5"
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
            <span className="text-rose-ink block text-[0.6rem] leading-4 font-black tracking-wide uppercase">
              {pick.label}
            </span>
            <strong className="text-brand-ink-strong block text-xs leading-4 break-words">
              {pick.displayName}
            </strong>
            {pick.accuracyPoints !== null &&
            pick.accuracyPoints !== undefined ? (
              <span className="text-muted mt-0.5 block text-[0.65rem] leading-4 font-semibold">
                {pick.resultStatus === "outside-range" ? (
                  <>{pick.metricLabel} · </>
                ) : (
                  <>
                    {pick.metricLabel ? `${pick.metricLabel} · ` : ""}Result
                    rank {pick.resultRank} ·{" "}
                  </>
                )}
                {pick.accuracyPoints} accuracy{" "}
                {pick.accuracyPoints === 1 ? "pt" : "pts"}
              </span>
            ) : (
              <span className="text-muted mt-0.5 block text-[0.65rem] leading-4 font-semibold">
                {pick.category === "underdog_player" ||
                pick.category === "overrated_player"
                  ? "Rating N/A"
                  : "Result rank pending"}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
