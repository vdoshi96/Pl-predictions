"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { PREMIER_LEAGUE_2026_27_TEAM_SLUGS } from "@/data";
import type {
  ManualStandingsPayload,
  ManualStandingsResult,
} from "@/features/standings/manual-standings-form";
import { createStandingsItemsSchema } from "@/features/standings/validation";

import { buildStandingsDiff } from "./table-diff";
import { parsePastedStandingsTable } from "./table-paste-parser";

const payloadSchema = createStandingsItemsSchema(
  PREMIER_LEAGUE_2026_27_TEAM_SLUGS,
);

type StandingsPasteTeam = Readonly<{
  displayName: string;
  id: string;
  shortName?: string;
  slug: string;
  sortName?: string;
}>;

export type StandingsPastePanelProps = Readonly<{
  activeItems: readonly {
    actualPosition: number;
    leaguePoints: number | null;
    playedGames: number | null;
    teamId?: string;
    teamSlug?: string;
  }[];
  disabled: boolean;
  onSubmit: (payload: ManualStandingsPayload) => Promise<ManualStandingsResult>;
  teams: readonly StandingsPasteTeam[];
}>;

export function StandingsPastePanel({
  activeItems,
  disabled,
  onSubmit,
  teams,
}: StandingsPastePanelProps) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ReturnType<
    typeof parsePastedStandingsTable
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const parserTeams = useMemo(
    () =>
      teams.map((team) => ({
        displayName: team.displayName,
        shortName: team.shortName ?? team.displayName,
        slug: team.slug,
        sortName: team.sortName ?? team.displayName,
      })),
    [teams],
  );
  const labelBySlug = useMemo(
    () => new Map(teams.map((team) => [team.slug, team.displayName] as const)),
    [teams],
  );
  const slugByTeamId = useMemo(
    () => new Map(teams.map((team) => [team.id, team.slug] as const)),
    [teams],
  );

  const newItems = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.flatMap((row) =>
      row.status === "ok" && row.teamSlug && row.actualPosition !== null
        ? [
            {
              actualPosition: row.actualPosition,
              leaguePoints: row.leaguePoints,
              playedGames: row.playedGames,
              teamSlug: row.teamSlug,
            },
          ]
        : [],
    );
  }, [parsed]);

  const diff = useMemo(() => {
    if (!parsed) return null;
    return buildStandingsDiff({
      activeItems: activeItems.flatMap((item) => {
        const teamSlug =
          item.teamSlug ??
          (item.teamId ? slugByTeamId.get(item.teamId) : undefined);
        return teamSlug ? [{ ...item, teamSlug }] : [];
      }),
      labelBySlug,
      newItems,
    });
  }, [activeItems, labelBySlug, newItems, parsed, slugByTeamId]);

  const problems = useMemo(() => {
    if (!parsed) return [] as string[];
    const list: string[] = [];
    for (const row of parsed.rows) {
      if (row.status === "unknown-club") {
        list.push(`Unknown club: “${row.rawLine}”`);
      }
      if (row.status === "ambiguous-club") {
        list.push(`Ambiguous club name: “${row.rawLine}”`);
      }
    }
    if (newItems.length !== teams.length) {
      list.push(`Parsed ${newItems.length} of 20 clubs.`);
    }
    if (
      new Set(newItems.map((item) => item.teamSlug)).size !== newItems.length
    ) {
      list.push("Each club may appear only once.");
    }
    if (
      new Set(newItems.map((item) => item.actualPosition)).size !==
      newItems.length
    ) {
      list.push("Positions must be unique.");
    }
    if (newItems.length === 20) {
      const check = payloadSchema.safeParse(newItems);
      if (!check.success) {
        list.push(
          check.error.issues[0]?.message ?? "The parsed table is not valid.",
        );
      }
    }
    return list;
  }, [newItems, parsed, teams.length]);

  async function confirm() {
    if (!parsed || problems.length > 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await onSubmit({ matchweek: null, standings: newItems });
      setMessage(result.message);
      if (result.ok) {
        setText("");
        setParsed(null);
      }
    } catch {
      setMessage("Something went wrong. No changes were made.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="paste-table-title"
      className="border-border rounded-xl border p-4"
    >
      <h2 className="text-foreground font-black" id="paste-table-title">
        Paste table
      </h2>
      <p className="text-muted mt-1 text-sm leading-6">
        Copy any league table as text. Parsing never guesses: unknown or
        ambiguous clubs block saving.
      </p>
      <textarea
        aria-label="Pasted table text"
        className="border-border bg-surface focus:border-accent focus:ring-accent/30 disabled:bg-surface-subtle mt-3 min-h-40 w-full rounded-xl border p-3 font-mono text-sm outline-none focus:ring-2"
        disabled={disabled || busy}
        onChange={(event) => {
          setText(event.target.value);
          setParsed(null);
          setMessage(null);
        }}
        rows={8}
        value={text}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          disabled={disabled || busy || text.trim().length === 0}
          onClick={() =>
            setParsed(parsePastedStandingsTable(text, parserTeams))
          }
          variant="secondary"
        >
          Parse table
        </Button>
        <Button
          disabled={disabled || busy || !parsed || problems.length > 0}
          onClick={() => void confirm()}
        >
          Save pasted table
        </Button>
      </div>
      {message ? (
        <p className="text-muted mt-2 text-sm font-semibold" role="status">
          {message}
        </p>
      ) : null}
      {parsed ? (
        <div className="mt-4 grid gap-3">
          {problems.length > 0 ? (
            <ul className="bg-danger-soft text-danger list-disc rounded-xl p-3 pl-6 text-sm font-semibold">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
          {diff ? (
            <p className="text-muted text-sm font-semibold" role="status">
              {diff.movedCount} of {diff.rows.length} rows differ from the
              active table.
              {diff.missingTeams.length > 0
                ? ` Missing from paste: ${diff.missingTeams.length}.`
                : ""}
            </p>
          ) : null}
          <div className="border-border max-w-full overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
              <thead className="bg-surface-subtle text-muted text-xs tracking-wide uppercase">
                <tr>
                  <th className="px-3 py-2" scope="col">
                    Pos
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Club
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Played
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Points
                  </th>
                  <th className="px-3 py-2" scope="col">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsed.rows.map((row) => (
                  <tr key={row.rawLine}>
                    <td className="px-3 py-2">{row.actualPosition ?? "—"}</td>
                    <td className="px-3 py-2">{row.teamLabel ?? "—"}</td>
                    <td className="px-3 py-2">{row.playedGames ?? "—"}</td>
                    <td className="px-3 py-2">{row.leaguePoints ?? "—"}</td>
                    <td className="px-3 py-2 text-xs font-bold" role="cell">
                      {row.status === "ok"
                        ? row.numbersLowConfidence
                          ? "Check numbers"
                          : "OK"
                        : row.status === "unknown-club"
                          ? "Unknown club"
                          : "Ambiguous"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
