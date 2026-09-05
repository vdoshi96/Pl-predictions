import { Check, Trophy } from "lucide-react";

import { submitPrediction } from "@/app/actions/predictions";
import { PageHeading } from "@/components/page-heading";
import { SubmissionCountdown } from "@/components/submission-countdown";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HOME_SPOTLIGHT_MESSAGE } from "@/content/public-copy";
import type { ActiveSeasonContext } from "@/features/seasons/queries";
import { getSeasonTeams } from "@/features/seasons/queries";
import { formatChicagoUtcDateTime } from "@/shared/format";
import type { SeasonAccess } from "@/shared/policy";

import { PredictionForm } from "./prediction-form";

const scoringRules = [
  { label: "Exact position", points: 5 },
  { label: "Within 3 places", points: 3 },
  { label: "Same half only", points: 1 },
] as const;

export async function PredictionLanding({
  access,
  databaseNow,
  season,
}: {
  access: SeasonAccess;
  databaseNow: Date;
  season: ActiveSeasonContext["season"];
}) {
  const teams = await getSeasonTeams(season.id);
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
    <main id="main-content" className="page-shell w-full flex-1 py-4 sm:py-10">
      <div className="mx-auto grid max-w-3xl gap-5 has-[.prediction-review-step]:max-w-5xl sm:gap-7 [&:has(.prediction-review-step)_.entry-introduction]:hidden [&:has(.prediction-review-step)_.review-deadline]:block">
        <div className="entry-introduction order-1">
          <PageHeading
            title="Your table. Your season."
            description="Order all 20 clubs, choose seven spotlight picks, then review and submit once."
            status={
              <Badge variant={access.submissionsOpen ? "success" : "warning"}>
                {access.submissionsOpen ? "Open" : "Closed"}
              </Badge>
            }
          >
            <span>
              Submission deadline:{" "}
              {formatChicagoUtcDateTime(access.submissionDeadline)} · Arsenal v
              Coventry kickoff
            </span>
          </PageHeading>
          {access.submissionsOpen ? (
            <div className="bg-brand mt-3 rounded-xl p-4 text-white">
              <SubmissionCountdown
                deadlineIso={access.submissionDeadline.toISOString()}
                initialRemainingSeconds={initialRemainingSeconds}
              />
            </div>
          ) : null}
        </div>
        <Card className="entry-introduction order-3">
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
              <p className="text-muted mt-1 text-sm leading-6">
                The main leaderboard uses the 5–3–1 scoring tiers and stays
                capped at 100. {HOME_SPOTLIGHT_MESSAGE}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2" aria-label="Scoring tiers">
              {scoringRules.map((rule) => (
                <div
                  className="bg-brand-soft ring-border min-w-0 rounded-xl px-2 py-2.5 text-center ring-1"
                  key={rule.label}
                >
                  <strong className="text-brand-ink block text-lg font-black">
                    {rule.points}
                  </strong>
                  <span className="text-muted mt-0.5 block text-[0.68rem] leading-4 font-medium">
                    {rule.label}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-muted flex items-center gap-2 text-xs font-semibold sm:col-span-2">
              <Check aria-hidden="true" className="text-mint-ink size-4" />
              Exact full table: 100 points · spotlight accuracy stays separate.
            </p>
          </CardContent>
        </Card>

        <p className="review-deadline text-muted order-1 hidden text-xs">
          Submission deadline:{" "}
          {formatChicagoUtcDateTime(access.submissionDeadline)}
        </p>
        <div className="order-2 min-w-0">
          <PredictionForm
            teams={teams.map((team) => ({
              id: team.id,
              displayName: team.displayName,
              shortName: team.shortName,
              sortName: team.sortName,
              assetPath: team.assetPath,
            }))}
            onSubmit={submitPrediction}
            seasonName={season.name}
            seasonSlug={season.slug}
            disabled={!access.submissionsOpen}
            disabledReason={closedReason}
          />
        </div>
      </div>
    </main>
  );
}
