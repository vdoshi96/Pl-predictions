import { TeamMark } from "@/components/team-mark";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { ordinal } from "@/shared/format";

import type { LeaderboardChampion } from "./queries";

export function ChampionPick({
  champion,
  className,
}: {
  champion: LeaderboardChampion;
  className?: string;
}) {
  const onTrack = champion.actualPosition === 1;

  return (
    <div
      aria-label={`Predicted champion: ${champion.displayName}`}
      className={cn(
        "bg-brand-soft ring-border flex min-w-0 flex-wrap items-center gap-2.5 rounded-xl p-2.5 ring-1",
        className,
      )}
      role="group"
    >
      <TeamMark
        initials={champion.shortName}
        name={champion.displayName}
        size="sm"
        src={champion.assetPath}
      />
      <span className="min-w-0 grow">
        <span className="block text-[0.62rem] leading-4 font-bold tracking-wide text-slate-500 uppercase">
          Predicted champion
        </span>
        <strong className="text-brand-strong block text-sm leading-5 font-black [overflow-wrap:anywhere]">
          {champion.displayName}
        </strong>
      </span>
      {champion.actualPosition !== null ? (
        <Badge
          aria-label={`${champion.displayName} is ${onTrack ? "on track" : "off track"}, currently ${ordinal(champion.actualPosition)}`}
          className="shrink-0"
          variant={onTrack ? "success" : "warning"}
        >
          {onTrack ? "On track" : "Off track"} ·{" "}
          {ordinal(champion.actualPosition)}
        </Badge>
      ) : null}
    </div>
  );
}
