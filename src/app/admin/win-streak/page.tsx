import { asc, eq } from "drizzle-orm";
import { CheckCircle2, Clock3 } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getDb } from "@/db/client";
import { teams, winStreakFixtures, winStreakRounds } from "@/db/schema";
import { getAdminSession } from "@/features/admin";
import { getActiveSeasonContext } from "@/features/seasons/queries";
import { allWinStreakFixtureKickoffsHavePassed } from "@/features/win-streak/results";
import { formatChicagoUtcDateTime } from "@/shared/format";

import { AdminNav } from "../admin-nav";
import {
  WinStreakResultsDesk,
  type WinStreakResultsDeskFixture,
} from "./results-desk";

export const metadata: Metadata = { title: "Win Streak results admin" };
export const dynamic = "force-dynamic";

export default async function AdminWinStreakPage() {
  if (!(await getAdminSession())) redirect("/admin/login");

  const { databaseNow, season } = await getActiveSeasonContext();
  const db = getDb();
  const roundRows = await db
    .select({
      id: winStreakRounds.id,
      matchweek: winStreakRounds.matchweek,
      pickDeadline: winStreakRounds.pickDeadline,
      resolvedAt: winStreakRounds.resolvedAt,
    })
    .from(winStreakRounds)
    .where(eq(winStreakRounds.seasonId, season.id))
    .orderBy(asc(winStreakRounds.matchweek));
  const activeRound = roundRows.find(
    (candidate) => candidate.resolvedAt === null,
  );

  return (
    <main className="page-shell w-full flex-1 py-6 sm:py-10">
      <div className="grid gap-5">
        <div>
          <Badge variant="accent">Reviewed shared-round control</Badge>
          <h1 className="text-foreground mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Win Streak results
          </h1>
          <p className="text-muted mt-2 max-w-2xl text-sm leading-6">
            Resolve one shared matchweek after every scheduled fixture has
            kicked off. One accepted save updates every participant, records its
            source, and cannot be edited.
          </p>
        </div>

        <AdminNav current="/admin/win-streak" />

        {activeRound ? (
          <ActiveRoundDesk
            databaseNow={databaseNow}
            matchweek={activeRound.matchweek}
            pickDeadline={activeRound.pickDeadline}
            roundId={activeRound.id}
            seasonId={season.id}
          />
        ) : roundRows.length > 0 ? (
          <Card>
            <CardContent className="flex items-start gap-3">
              <CheckCircle2
                aria-hidden="true"
                className="text-mint-ink mt-0.5 size-5 shrink-0"
              />
              <div>
                <h2 className="text-foreground font-black">
                  Every Win Streak round is resolved
                </h2>
                <p className="text-muted mt-1 text-sm leading-6">
                  No result entry is available.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <h2 className="text-foreground font-black">
                Win Streak fixtures are not seeded
              </h2>
              <p className="text-muted mt-1 text-sm leading-6">
                Seed the reviewed Matchweek 2-38 schedule before recording
                results.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

async function ActiveRoundDesk({
  databaseNow,
  matchweek,
  pickDeadline,
  roundId,
  seasonId,
}: {
  databaseNow: Date;
  matchweek: number;
  pickDeadline: Date;
  roundId: string;
  seasonId: string;
}) {
  const db = getDb();
  const [fixtureRows, teamRows] = await Promise.all([
    db
      .select({
        awayTeamId: winStreakFixtures.awayTeamId,
        homeTeamId: winStreakFixtures.homeTeamId,
        id: winStreakFixtures.id,
        kickoffAt: winStreakFixtures.kickoffAt,
        result: winStreakFixtures.result,
      })
      .from(winStreakFixtures)
      .where(eq(winStreakFixtures.roundId, roundId))
      .orderBy(asc(winStreakFixtures.kickoffAt)),
    db
      .select({
        assetPath: teams.assetPath,
        displayName: teams.displayName,
        id: teams.id,
        shortName: teams.shortName,
      })
      .from(teams)
      .where(eq(teams.seasonId, seasonId)),
  ]);
  if (
    fixtureRows.length !== 10 ||
    fixtureRows.some((fixture) => fixture.result !== null)
  ) {
    throw new Error(
      `Unresolved Matchweek ${matchweek} must contain ten result-free fixtures.`,
    );
  }
  const teamById = new Map(teamRows.map((team) => [team.id, team] as const));
  const fixtures: WinStreakResultsDeskFixture[] = fixtureRows.map((fixture) => {
    const homeTeam = teamById.get(fixture.homeTeamId);
    const awayTeam = teamById.get(fixture.awayTeamId);
    if (!homeTeam || !awayTeam) {
      throw new Error(
        `Matchweek ${matchweek} contains a club outside the active season.`,
      );
    }
    return {
      awayTeam,
      homeTeam,
      id: fixture.id,
      kickoffAt: fixture.kickoffAt.toISOString(),
    };
  });
  const canResolve = allWinStreakFixtureKickoffsHavePassed(
    fixtureRows.map((fixture) => fixture.kickoffAt),
    databaseNow,
  );

  return (
    <section aria-labelledby="active-win-streak-round" className="grid gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              className="text-foreground text-xl font-black"
              id="active-win-streak-round"
            >
              Matchweek {matchweek}
            </h2>
            <p className="text-muted mt-1 text-sm leading-6">
              Deadline: {formatChicagoUtcDateTime(pickDeadline)}
            </p>
          </div>
          <Badge variant={canResolve ? "warning" : "neutral"}>
            <Clock3 aria-hidden="true" className="mr-1 size-3.5" />
            {canResolve ? "Ready for review" : "Waiting for every kickoff"}
          </Badge>
        </CardContent>
      </Card>

      <WinStreakResultsDesk
        canResolve={canResolve}
        defaultCapturedAt={databaseNow.toISOString()}
        fixtures={fixtures}
        matchweek={matchweek}
        roundId={roundId}
      />
    </section>
  );
}
