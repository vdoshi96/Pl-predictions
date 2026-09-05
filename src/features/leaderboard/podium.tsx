import { Bird, Cat, Dog, Fish, Rabbit, Turtle } from "lucide-react";

import { ordinal } from "@/shared/format";

import { LeaderboardEntryLink } from "./entry-link";
import type { ScoredLeaderboardEntry } from "./queries";

const animals = [Cat, Rabbit, Bird, Turtle, Dog, Fish] as const;

function Mascot({ name }: { name: string }) {
  const hash = Array.from(name.normalize("NFKC").toLowerCase()).reduce(
    (value, character) => (value * 31 + character.codePointAt(0)!) >>> 0,
    0,
  );
  const Animal = animals[hash % animals.length];
  return (
    <span className="podium-mascot" aria-hidden="true">
      <Animal size={32} strokeWidth={1.7} />
    </span>
  );
}

export function Podium({
  entries,
}: {
  entries: readonly ScoredLeaderboardEntry[];
}) {
  const groups = [1, 2, 3]
    .map((rank) => ({
      rank,
      entries: entries.filter((entry) => entry.rank === rank),
    }))
    .filter((group) => group.entries.length > 0);
  if (groups.length === 0) return null;
  return (
    <section aria-label="Leaderboard podium" className="podium">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold">On the podium</h2>
        <p className="text-muted text-xs">Equal points. Equal place.</p>
      </div>
      <div className="podium-tiers">
        {groups.map((group) => (
          <div
            key={group.rank}
            role="group"
            aria-label={`${group.entries.length > 1 ? "Joint " : ""}${ordinal(group.rank)} place`}
            className="podium-tier"
            data-rank={group.rank}
          >
            <div className="podium-place">
              <strong>{ordinal(group.rank)}</strong>
              <span>{group.entries.length > 1 ? "Joint place" : "Place"}</span>
            </div>
            <div className="podium-people">
              {group.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="podium-person"
                  data-testid="podium-entry"
                >
                  <Mascot name={entry.participantName} />
                  <div className="min-w-0 flex-1">
                    <LeaderboardEntryLink
                      entryId={entry.id}
                      participantName={entry.participantName}
                    />
                    <span className="text-muted block text-xs">
                      {entry.exactCount} exact · {entry.champion.displayName}
                    </span>
                  </div>
                  <strong className="podium-score">
                    {entry.totalScore}
                    <span> / 100</span>
                  </strong>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
