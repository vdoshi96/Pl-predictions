import { FlaskConical, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  PREDICTION_CATEGORY_DEFINITIONS,
  type PredictionCategory,
} from "@/features/predictions/categories";
import { assignSharedRanks, scoreCategoryRank } from "@/features/scoring";

import {
  SpotlightPickGrid,
  type SpotlightPickDisplay,
} from "./spotlight-pick-grid";

type DemoPick = SpotlightPickDisplay & { points: number; rank: number };

const labelByCategory = new Map(
  PREDICTION_CATEGORY_DEFINITIONS.map((definition) => [
    definition.category,
    definition.label,
  ]),
);

function playerPick(
  category: PredictionCategory,
  displayName: string,
  assetPath: string | null,
  rank: number,
): DemoPick {
  return {
    assetPath,
    category,
    displayName,
    label: labelByCategory.get(category) ?? category,
    points: scoreCategoryRank(rank),
    rank,
    subject: "player",
  };
}

function teamPick(
  category: PredictionCategory,
  displayName: string,
  shortName: string,
  assetPath: string,
  rank: number,
  metricLabel?: string,
): DemoPick {
  return {
    assetPath,
    category,
    displayName,
    label: labelByCategory.get(category) ?? category,
    metricLabel,
    points: scoreCategoryRank(rank),
    rank,
    shortName,
    subject: "team",
  };
}

const demoEntries = [
  {
    participantName: "Demo Alex",
    picks: [
      playerPick(
        "top_scorer",
        "Erling Haaland",
        "/player-faces/manchester_city_haaland_erling.png",
        1,
      ),
      playerPick(
        "top_assister",
        "Bruno Fernandes",
        "/player-faces/manchester_united_fernandes_bruno.png",
        3,
      ),
      teamPick(
        "most_clean_sheets",
        "Arsenal",
        "Arsenal",
        "/team-marks/arsenal.png",
        2,
      ),
      teamPick(
        "underdog_team",
        "Sunderland",
        "Sunderland",
        "/team-marks/sunderland.png",
        1,
        "Index +8.4",
      ),
      teamPick(
        "overrated_team",
        "Manchester United",
        "Man United",
        "/team-marks/manchester-united.png",
        4,
        "Index +7.6",
      ),
      playerPick(
        "underdog_player",
        "Chris Rigg",
        "/player-faces/afc_sunderland_rigg_chris.png",
        2,
      ),
      playerPick(
        "overrated_player",
        "Mykhaylo Mudryk",
        "/player-faces/fc_chelsea_mudryk_mykhaylo.png",
        7,
      ),
    ],
    tableScore: 78,
  },
  {
    participantName: "Demo Jordan",
    picks: [
      playerPick(
        "top_scorer",
        "Alexander Isak",
        "/player-faces/fc_liverpool_isak_alexander.png",
        4,
      ),
      playerPick(
        "top_assister",
        "Florian Wirtz",
        "/player-faces/fc_liverpool_wirtz_florian.png",
        1,
      ),
      teamPick(
        "most_clean_sheets",
        "Manchester City",
        "Man City",
        "/team-marks/manchester-city.png",
        1,
      ),
      teamPick(
        "underdog_team",
        "Coventry City",
        "Coventry",
        "/team-marks/coventry-city.png",
        5,
        "Index +3.1",
      ),
      teamPick(
        "overrated_team",
        "Chelsea",
        "Chelsea",
        "/team-marks/chelsea.png",
        2,
        "Index +9.2",
      ),
      playerPick("underdog_player", "Alysson", null, 6),
      playerPick(
        "overrated_player",
        "Bukayo Saka",
        "/player-faces/fc_arsenal_saka_bukayo.png",
        3,
      ),
    ],
    tableScore: 82,
  },
].map((entry) => {
  const spotlightScore = entry.picks.reduce(
    (total, pick) => total + pick.points,
    0,
  );
  return {
    ...entry,
    spotlightScore,
    totalScore: entry.tableScore + spotlightScore,
  };
});

const rankedDemoEntries = assignSharedRanks(demoEntries);

export function LeaderboardDemo() {
  return (
    <section aria-labelledby="leaderboard-demo-heading" className="grid gap-3">
      <Card className="border-accent-lilac/30 bg-[#fcf9fd]">
        <CardContent className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="bg-brand text-accent grid size-11 shrink-0 place-items-center rounded-xl">
              <FlaskConical aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2
                id="leaderboard-demo-heading"
                className="text-brand-strong text-xl font-black"
              >
                Spotlight scoring test run
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                This preview is not stored or counted. It shows how table
                points, seven ranked picks, player portraits, the silhouette
                fallback, and club crests fit together before the real result
                feeds are wired.
              </p>
            </div>
          </div>
          <Badge variant="warning">Demo only</Badge>
        </CardContent>
      </Card>

      {rankedDemoEntries.map((entry) => (
        <Card
          aria-label={`${entry.participantName} demo leaderboard entry`}
          key={entry.participantName}
        >
          <CardContent>
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <span
                className="bg-brand grid size-11 place-items-center rounded-xl text-lg font-black text-white"
                aria-label={`Demo rank ${entry.rank}`}
              >
                {entry.rank}
              </span>
              <div className="min-w-0">
                <strong className="text-brand-strong block font-black">
                  {entry.participantName}
                </strong>
                <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
                  <span>{entry.tableScore} table</span>
                  <span>{entry.spotlightScore} spotlight</span>
                </span>
              </div>
              <div className="text-right">
                <strong className="block text-2xl font-black text-[#c80047] tabular-nums">
                  {entry.totalScore}
                </strong>
                <span className="text-[0.65rem] font-bold tracking-wide text-slate-500 uppercase">
                  demo total
                </span>
              </div>
            </div>
            <details
              className="group border-border mt-4 rounded-xl border bg-white"
              open={entry.rank === 1}
            >
              <summary className="text-brand focus-visible:ring-accent-blue flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-xl px-3 text-sm font-black outline-none focus-visible:ring-2">
                <Trophy aria-hidden="true" className="size-4" />
                View seven scored picks
              </summary>
              <SpotlightPickGrid
                className="border-border border-t p-3"
                picks={entry.picks}
              />
            </details>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
