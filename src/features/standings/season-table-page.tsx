import { Clock3 } from "lucide-react";
import Link from "next/link";

import { PageHeading } from "@/components/page-heading";
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
  const band = neutral
    ? "neutral"
    : magnitude >= 6
      ? "far"
      : magnitude >= 1
        ? "slight"
        : "near";
  const visible = `${neutral ? "‒" : positive ? "▲" : "▼"} ${formatConsensusValue(magnitude)}`;
  const description = neutral
    ? `${formatConsensusValue(magnitude)} places from the league's average prediction`
    : `${positive ? "overachieving" : "underachieving"} by ${formatConsensusValue(magnitude)} places vs the league's average prediction`;

  return (
    <span
      className="consensus-delta inline-flex min-h-7 items-center rounded-lg px-2 text-xs font-black whitespace-nowrap"
      data-direction={neutral ? "neutral" : positive ? "positive" : "negative"}
      data-band={band}
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
    <section
      className={
        positive
          ? "bg-brand rounded-xl p-6 text-white"
          : "border-border bg-surface rounded-xl border p-6"
      }
    >
      <h2 className="text-xl font-bold tracking-tight">
        {positive ? "The biggest surprise" : "Below expectations"}
      </h2>
      <div className="mt-5 flex items-center gap-3">
        <TeamMark
          decorative
          initials={value.team.shortName}
          name={value.team.displayName}
          size="lg"
          src={value.team.assetPath}
        />
        <strong className="min-w-0 [overflow-wrap:anywhere]">
          {value.team.displayName}
        </strong>
      </div>
      <p
        className={`mt-4 text-sm leading-6 ${positive ? "text-white/80" : "text-muted"}`}
      >
        {ordinal(value.actualPosition)} in the published table. The group’s
        average prediction:{" "}
        <strong>{formatConsensusValue(value.avgPredicted)}</strong>.
      </p>
      <span
        className={`mt-4 inline-flex rounded-md px-2 py-1 text-xs font-semibold ${positive ? "bg-white/15 text-white" : "bg-brand-soft text-brand-ink"}`}
      >
        {positive ? "Overachiever" : "Underachiever"} ·{" "}
        {formatConsensusValue(
          Math.abs(value.avgPredicted - value.actualPosition),
        )}{" "}
        places {positive ? "above" : "below"} expectations
      </span>
    </section>
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
    <main id="main-content" className="page-shell w-full flex-1 py-6 sm:py-10">
      <div className="grid gap-5 sm:gap-7">
        <PageHeading
          title="The season, against our predictions."
          description="The published league table beside what the group expected."
          status={
            view.snapshot ? (
              <Badge variant={view.snapshot.isFinal ? "success" : "warning"}>
                {view.snapshot.isFinal ? "Final" : "Provisional"}
              </Badge>
            ) : undefined
          }
        >
          <span>{view.seasonName}</span>
          {view.snapshot ? (
            <span>
              Updated {formatChicagoUtcDateTime(view.snapshot.capturedAt)}
            </span>
          ) : null}
          {view.snapshot?.matchweek ? (
            <span>Matchweek {view.snapshot.matchweek}</span>
          ) : null}
          <span>Submissions closed · predictions revealed</span>
        </PageHeading>
        <div className="season-layout">
          <div className="grid min-w-0 gap-4">
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
                      The season table will appear here after the owner accepts
                      the first complete standings snapshot.
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
                          Published positions remain visible. Consensus appears
                          once the scoring window is open and the active table
                          contains played matches.
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
                      Published Premier League positions
                      {showConsensus
                        ? " compared with the league consensus"
                        : ""}
                      .
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
                            Group avg.
                          </th>
                        ) : null}
                        {showConsensus ? (
                          <th className="px-1 py-3 text-right" scope="col">
                            Gap
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
                                  {showConsensus ? (
                                    <span className="text-muted block text-[0.625rem] font-semibold min-[480px]:hidden">
                                      Group avg.{" "}
                                      {row.avgPredicted === null
                                        ? "—"
                                        : formatConsensusValue(
                                            row.avgPredicted,
                                          )}
                                    </span>
                                  ) : null}
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
          <aside
            className="season-aside"
            aria-label="Season consensus surprises"
          >
            {view.snapshot &&
            view.callouts.overachiever &&
            view.callouts.underachiever ? (
              <>
                <Callout
                  kind="overachiever"
                  value={view.callouts.overachiever}
                />
                <Callout
                  kind="underachiever"
                  value={view.callouts.underachiever}
                />
              </>
            ) : null}
            <div className="px-1 text-sm leading-6">
              <h2 className="font-bold">How to read the gap</h2>
              <p className="text-muted mt-2">
                Positive means above the group’s expectations. Negative means
                below. The number shows how many places separate the prediction
                average and the published position.
              </p>
            </div>
            <Link
              href="/leaderboard"
              className="text-brand-ink inline-flex min-h-11 items-center font-semibold underline"
            >
              See how everyone is doing
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
