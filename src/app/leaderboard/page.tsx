import { EyeOff, Medal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  LeaderboardRosterTable,
  ScoredLeaderboardBoard,
} from "@/features/leaderboard/leaderboard-board";
import { getLeaderboardView } from "@/features/leaderboard/queries";
import { formatChicagoUtcDateTime } from "@/shared/format";

export const metadata: Metadata = { title: "Table leaderboard" };
export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  searchParams,
}: PageProps<"/leaderboard">) {
  const params = await searchParams;
  const query =
    typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const view = await getLeaderboardView();
  const scoringStarted = view.scoredEntries !== null;

  return (
    <main id="main-content" className="page-shell w-full flex-1 py-6 sm:py-10">
      <div className="grid gap-5 sm:gap-7">
        <PageHeading
          title="The friends’ leaderboard."
          description="One table prediction. Twenty clubs. Up to 100 points."
          status={
            view.snapshot ? (
              <Badge variant={view.snapshot.isFinal ? "success" : "warning"}>
                {view.snapshot.isFinal ? "Final" : "Provisional"}
              </Badge>
            ) : undefined
          }
        >
          <span>
            {view.entries.length}{" "}
            {view.entries.length === 1 ? "entry" : "entries"} · Table points
            only
          </span>
          {view.snapshot ? (
            <span>
              Updated {formatChicagoUtcDateTime(view.snapshot.capturedAt)}
            </span>
          ) : null}
          {view.snapshot?.matchweek ? (
            <span>Matchweek {view.snapshot.matchweek}</span>
          ) : null}
          <Link
            className="text-brand-ink inline-flex min-h-11 items-center font-semibold underline"
            href="/spotlight"
          >
            View separate spotlight accuracy
          </Link>
        </PageHeading>

        {!view.predictionsRevealed ? (
          <Card>
            <CardContent className="flex items-start gap-3">
              <span className="bg-surface-subtle text-muted grid size-11 shrink-0 place-items-center rounded-xl">
                <EyeOff aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="text-foreground font-black">
                  Full tables are still private
                </h2>
                <p className="text-muted mt-1 text-sm leading-6">
                  Everyone is on 0 table points, and only each predicted
                  champion is public now. The other 19 positions and all seven
                  spotlight picks stay private until the opening kickoff, a
                  manual lock, or an early reveal by the owner.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : !scoringStarted ? (
          <Card>
            <CardContent className="flex items-start gap-3">
              <span className="bg-warning-soft text-warning grid size-11 shrink-0 place-items-center rounded-xl">
                <Medal aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="text-foreground font-black">
                  {view.seasonStarted
                    ? "Waiting for the first active table"
                    : "Everyone starts on 0 points"}
                </h2>
                <p className="text-muted mt-1 text-sm leading-6">
                  {view.seasonStarted
                    ? "Table scores will recalculate as soon as a meaningful standings snapshot is active."
                    : "Only predicted champions are shown until Arsenal v Coventry kicks off."}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <form action="/leaderboard" className="flex items-end gap-3">
          <label className="grid w-full max-w-sm gap-2 text-sm font-semibold">
            Find a participant
            <input
              name="q"
              type="search"
              defaultValue={query}
              maxLength={80}
              placeholder="Display name"
              className="border-border bg-surface min-h-11 w-full rounded-lg border px-3"
            />
          </label>
          <button
            type="submit"
            className="bg-brand min-h-11 rounded-lg px-4 text-sm font-semibold text-white"
          >
            Find
          </button>
          {query ? (
            <Link
              href="/leaderboard"
              className="text-brand-ink inline-flex min-h-11 items-center text-sm underline"
            >
              Clear
            </Link>
          ) : null}
        </form>
        {view.entries.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <h2 className="text-foreground text-xl font-black">
                No entries yet
              </h2>
              <p className="text-muted mt-2 text-sm">
                Be the first to submit a full 1–20.
              </p>
              <Link
                className="bg-accent text-accent-ink hover:bg-accent-yellow mt-5 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-black"
                href="/"
              >
                Make your prediction
              </Link>
            </CardContent>
          </Card>
        ) : scoringStarted && view.scoredEntries ? (
          <ScoredLeaderboardBoard entries={view.scoredEntries} query={query} />
        ) : (
          <LeaderboardRosterTable
            entries={view.entries.filter((entry) =>
              entry.participantName
                .toLocaleLowerCase()
                .includes(query.toLocaleLowerCase()),
            )}
            predictionsRevealed={view.predictionsRevealed}
          />
        )}
      </div>
    </main>
  );
}
