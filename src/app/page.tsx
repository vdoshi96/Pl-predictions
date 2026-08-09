import { CalendarClock, Check, Trophy } from "lucide-react";

import { submitPrediction } from "@/app/actions/predictions";
import { SubmissionCountdown } from "@/components/submission-countdown";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PredictionForm } from "@/features/predictions/prediction-form";
import { getActiveSeasonView } from "@/features/seasons/queries";
import { formatUtcDateTime } from "@/shared/format";
import { getSeasonAccess } from "@/shared/policy";

export const dynamic = "force-dynamic";

const scoringRules = [
  { label: "Exact position", points: 5 },
  { label: "Within 3 places", points: 3 },
  { label: "Same half only", points: 1 },
] as const;

export default async function PredictionPage() {
  const { databaseNow, players, season, teams } = await getActiveSeasonView();
  const access = getSeasonAccess(
    {
      openingKickoff: season.openingKickoff,
      revealPredictions: season.revealPredictions,
      submissionDeadline: season.submissionDeadline,
      submissionsLocked: season.submissionsLocked,
    },
    databaseNow,
  );

  const closedReason = season.submissionsLocked
    ? "The owner has locked new predictions."
    : access.deadlinePassed
      ? "The submission deadline has passed."
      : "Predictions have been revealed, so new entries are permanently closed.";
  const initialRemainingSeconds = Math.max(
    0,
    Math.ceil(
      (access.submissionDeadline.getTime() - databaseNow.getTime()) / 1_000,
    ),
  );

  return (
    <main className="page-shell w-full flex-1 py-6 sm:py-10">
      <div className="mx-auto grid max-w-3xl gap-5 sm:gap-7">
        <section className="brand-hero order-1 rounded-3xl px-5 py-5 text-white sm:px-8 sm:py-9">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-accent text-brand ring-accent">
              {season.name}
            </Badge>
            <Badge variant={access.submissionsOpen ? "success" : "warning"}>
              {access.submissionsOpen ? "Open" : "Closed"}
            </Badge>
          </div>
          <h1 className="mt-3 text-3xl leading-tight font-black tracking-[-0.04em] text-balance sm:mt-5 sm:text-5xl">
            Build your 2026/27 Premier League table.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:mt-4 sm:text-base sm:leading-7">
            Put all 20 clubs in your predicted finishing order, choose seven
            spotlight predictions, and lock in your Dranx Prediction League
            entry.
          </p>

          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-white/15 bg-white/8 p-3 backdrop-blur-sm sm:mt-6 sm:p-4">
            <CalendarClock
              aria-hidden="true"
              className="text-accent-blue mt-0.5 size-5 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">
                {access.submissionsOpen
                  ? "Submissions open"
                  : "Submissions closed"}
              </p>
              <p className="mt-1 text-xs leading-5 text-white/65">
                Submission deadline:{" "}
                {formatUtcDateTime(access.submissionDeadline)}
                {access.submissionDeadline.getTime() ===
                season.openingKickoff.getTime()
                  ? " · Arsenal v Coventry kickoff"
                  : ` · hard ceiling ${formatUtcDateTime(season.openingKickoff)}`}
              </p>
              {access.submissionsOpen ? (
                <SubmissionCountdown
                  deadlineIso={access.submissionDeadline.toISOString()}
                  initialRemainingSeconds={initialRemainingSeconds}
                />
              ) : null}
            </div>
          </div>
        </section>

        <Card className="order-3 sm:order-2">
          <CardContent className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <Trophy
                  aria-hidden="true"
                  className="text-accent-pink size-5"
                />
                <h2 className="font-black tracking-tight">
                  Two separate tables
                </h2>
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                The main leaderboard uses only the existing 5–3–1 table tiers
                and stays capped at 100. Spotlight picks have a separate
                just-for-fun accuracy score based on the active bracket count.
                An owner-run Codex automation will manually enter the five
                result lists that are not derived from the league table.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2" aria-label="Scoring tiers">
              {scoringRules.map((rule) => (
                <div
                  className="bg-brand-soft ring-border min-w-0 rounded-xl px-2 py-2.5 text-center ring-1"
                  key={rule.label}
                >
                  <strong className="text-brand block text-lg font-black">
                    {rule.points}
                  </strong>
                  <span className="mt-0.5 block text-[0.68rem] leading-4 font-medium text-slate-600">
                    {rule.label}
                  </span>
                </div>
              ))}
            </div>
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-500 sm:col-span-2">
              <Check aria-hidden="true" className="size-4 text-[#08734f]" />
              Exact full table: 100 points · spotlight accuracy stays separate.
            </p>
          </CardContent>
        </Card>

        <div className="order-2 min-w-0 sm:order-3">
          <PredictionForm
            players={players.map((player) => ({
              assetPath: player.assetPath,
              displayName: player.displayName,
              firstName: player.firstName,
              id: player.id,
              lastName: player.lastName,
            }))}
            teams={teams.map((team) => ({
              id: team.id,
              displayName: team.displayName,
              shortName: team.shortName,
              sortName: team.sortName,
              assetPath: team.assetPath,
            }))}
            onSubmit={submitPrediction}
            seasonName={season.name}
            disabled={!access.submissionsOpen}
            disabledReason={closedReason}
          />
        </div>
      </div>
    </main>
  );
}
