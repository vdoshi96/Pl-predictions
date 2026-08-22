import { Clock3, Table2 } from "lucide-react";
import Link from "next/link";

import { TeamMark } from "@/components/team-mark";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatChicagoUtcDateTime, ordinal } from "@/shared/format";

import { getSeasonTableView, type SeasonTableView } from "./season-table";
import { formatConsensusValue } from "./season-table-view";

function zoneFor(position: number): {
  className: string;
  label: string;
} {
  if (position <= 4) return { className: "bg-accent", label: "UCL place" };
  if (position === 5)
    return { className: "bg-accent-blue", label: "UEL place" };
  if (position >= 18)
    return { className: "bg-accent-pink", label: "Relegation place" };
  return { className: "bg-transparent", label: "No qualification zone" };
}

function DeltaChip({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-muted text-sm font-bold">—</span>;
  }
  const roundedDelta = Number(formatConsensusValue(delta));
  const magnitude = Math.abs(roundedDelta);
  const neutral = roundedDelta === 0;
  const positive = roundedDelta > 0;
  const visible = `${neutral ? "‒" : positive ? "▲" : "▼"} ${formatConsensusValue(magnitude)}`;
  const description = neutral
    ? `${formatConsensusValue(magnitude)} places from the league's average prediction`
    : `${positive ? "overachieving" : "underachieving"} by ${formatConsensusValue(magnitude)} places vs the league's average prediction`;

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-lg px-2 text-xs font-black whitespace-nowrap ${
        neutral
          ? "bg-surface-subtle text-muted"
          : positive
            ? "bg-mint text-mint-ink"
            : "bg-rose-soft text-rose-ink"
      }`}
    >
      <span aria-hidden="true">{visible}</span>
      <span className="sr-only">{description}</span>
    </span>
  );
}

function Callout({
  kind,
  value,
}: {
  kind: "overachiever" | "underachiever";
  value: NonNullable<SeasonTableView["callouts"][typeof kind]>;
}) {
  const positive = kind === "overachiever";
  return (
    <Card
      className={
        positive ? "border-mint bg-mint" : "border-rose-soft bg-rose-soft"
      }
    >
      <CardContent className="flex items-center gap-3 p-4 sm:p-5">
        <TeamMark
          decorative
          initials={value.team.shortName}
          name={value.team.displayName}
          size="lg"
          src={value.team.assetPath}
        />
        <div className="min-w-0">
          <span
            className={`block text-[0.65rem] font-black tracking-wider uppercase ${positive ? "text-mint-ink" : "text-rose-ink"}`}
          >
            {positive ? "Overachiever" : "Underachiever"}
          </span>
          <strong className="text-brand-ink-strong mt-1 block text-sm leading-5 font-black [overflow-wrap:anywhere] sm:text-base">
            {value.team.displayName} · {ordinal(value.actualPosition)}, league
            said {formatConsensusValue(value.avgPredicted)}
          </strong>
        </div>
      </CardContent>
    </Card>
  );
}

export async function SeasonTablePage({
  view: suppliedView,
}: {
  view?: SeasonTableView;
} = {}) {
  const view = suppliedView ?? (await getSeasonTableView());
  if (!view.predictionsRevealed) {
    throw new Error(
      "The season table cannot render before predictions reveal.",
    );
  }
  const showConsensus = Boolean(view.snapshot && view.consensusActive);

  return (
    <main className="page-shell w-full flex-1 py-6 sm:py-10">
      <div className="grid gap-5 sm:gap-7">
        <section className="brand-hero rounded-3xl p-5 text-white sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-accent text-accent-ink ring-accent">
              {view.seasonName}
            </Badge>
            {view.snapshot?.matchweek ? (
              <Badge className="bg-white/15 text-white ring-white/20">
                Matchweek {view.snapshot.matchweek}
              </Badge>
            ) : null}
            {view.snapshot ? (
              <>
                <Badge className="bg-white/15 text-white ring-white/20">
                  Updated {formatChicagoUtcDateTime(view.snapshot.capturedAt)}
                </Badge>
                <Badge className="bg-white/15 text-white ring-white/20">
                  {view.snapshot.isFinal ? "Final" : "Provisional"}
                </Badge>
              </>
            ) : null}
            <Badge className="bg-white/15 text-white ring-white/20">
              Submissions closed · predictions revealed
            </Badge>
          </div>
          <div className="mt-5 flex items-start gap-3">
            <Table2
              aria-hidden="true"
              className="text-accent-blue mt-1 size-7 shrink-0"
            />
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                Season table
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
                See the live Premier League table against the prediction
                league&apos;s revealed consensus.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="bg-accent text-accent-ink hover:bg-accent-yellow inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-black transition-colors"
              href="/leaderboard"
            >
              Table leaderboard
            </Link>
            <Link
              className="bg-accent-blue text-accent-ink hover:bg-surface inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-black transition-colors"
              href="/spotlight"
            >
              Spotlight
            </Link>
          </div>
        </section>

        {view.snapshot &&
        view.callouts.overachiever &&
        view.callouts.underachiever ? (
          <section
            aria-label="Season consensus surprises"
            className="grid gap-3 md:grid-cols-2"
          >
            <Callout kind="overachiever" value={view.callouts.overachiever} />
            <Callout kind="underachiever" value={view.callouts.underachiever} />
          </section>
        ) : null}

        {!view.snapshot ? (
          <Card>
            <CardContent className="flex items-start gap-3 py-8">
              <Clock3
                aria-hidden="true"
                className="text-brand-ink mt-0.5 size-5 shrink-0"
              />
              <div>
                <h2 className="text-foreground font-black">
                  Waiting for the first standings import
                </h2>
                <p className="text-muted mt-1 text-sm leading-6">
                  The season table will appear here after the owner accepts the
                  first complete standings snapshot.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {!view.consensusActive ? (
              <Card className="border-accent-blue/40 bg-sky-soft">
                <CardContent className="flex items-start gap-3">
                  <Clock3
                    aria-hidden="true"
                    className="text-brand-ink mt-0.5 size-5 shrink-0"
                  />
                  <div>
                    <h2 className="text-brand-ink font-black">
                      Consensus comparison is waiting for a meaningful table
                    </h2>
                    <p className="text-brand-ink mt-1 text-sm leading-6">
                      Live positions remain visible. Consensus appears once the
                      scoring window is open and the active table contains
                      played matches.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card className="overflow-hidden">
              <table
                aria-label="Premier League season table"
                className="w-full table-fixed border-collapse text-sm"
              >
                <caption className="sr-only">
                  Live Premier League positions
                  {showConsensus ? " compared with the league consensus" : ""}.
                </caption>
                <colgroup>
                  <col className="w-2" />
                  <col className="w-9" />
                  <col />
                  <col className="w-11" />
                  {showConsensus ? (
                    <col className="w-20 max-[479px]:hidden" />
                  ) : null}
                  {showConsensus ? <col className="w-20" /> : null}
                </colgroup>
                <thead>
                  <tr className="border-border text-muted border-b-2 text-left text-[0.62rem] font-black tracking-wider uppercase">
                    <th scope="col">
                      <span className="sr-only">Zone</span>
                    </th>
                    <th className="px-1 py-3" scope="col">
                      Pos
                    </th>
                    <th className="px-1 py-3" scope="col">
                      Club
                    </th>
                    <th className="px-1 py-3 text-right" scope="col">
                      Pts
                    </th>
                    {showConsensus ? (
                      <th
                        className="px-1 py-3 text-right max-[479px]:hidden"
                        scope="col"
                      >
                        League said
                      </th>
                    ) : null}
                    {showConsensus ? (
                      <th className="px-1 py-3 text-right" scope="col">
                        vs consensus
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {(view.rows ?? []).map((row) => {
                    const zone = zoneFor(row.actualPosition);
                    return (
                      <tr
                        className="border-surface-lilac-border border-b last:border-b-0"
                        key={row.team.displayName}
                      >
                        <td className="py-2 pl-1">
                          <span
                            aria-hidden="true"
                            className={`block h-8 w-1 rounded-full ${zone.className}`}
                          />
                          <span className="sr-only">{zone.label}</span>
                        </td>
                        <td className="px-1 py-2 font-black tabular-nums">
                          {row.actualPosition}
                        </td>
                        <td className="min-w-0 px-1 py-2">
                          <span className="text-foreground flex min-w-0 items-center gap-1.5 font-black">
                            <TeamMark
                              decorative
                              initials={row.team.shortName}
                              name={row.team.displayName}
                              size="sm"
                              src={row.team.assetPath}
                            />
                            <span className="min-w-0 text-xs leading-4 [overflow-wrap:anywhere] sm:text-sm">
                              {row.team.displayName}
                            </span>
                          </span>
                        </td>
                        <td className="px-1 py-2 text-right font-black tabular-nums">
                          {row.leaguePoints ?? "—"}
                        </td>
                        {showConsensus ? (
                          <td className="text-muted px-1 py-2 text-right text-xs font-bold tabular-nums max-[479px]:hidden">
                            {row.avgPredicted === null
                              ? "—"
                              : formatConsensusValue(row.avgPredicted)}
                          </td>
                        ) : null}
                        {showConsensus ? (
                          <td className="px-1 py-2 text-right">
                            <DeltaChip delta={row.delta} />
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
