"use client";

import { AlertTriangle, CheckCircle2, Save } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  PredictionSorter,
  sortTeamsAlphabetically,
  type PredictionTeam,
} from "@/features/predictions/prediction-sorter";

export type ManualStandingsPayload = {
  matchweek: number | null;
  standings: Array<{
    actualPosition: number;
    leaguePoints: number | null;
    playedGames: number | null;
    teamSlug: string;
  }>;
};

export type ManualStandingsResult =
  { ok: true; message: string } | { ok: false; message: string };

export type ManualStandingsTeam = PredictionTeam & { slug: string };

type Props = {
  hasActiveSnapshot: boolean;
  initialLeaguePoints?: Record<string, number | null>;
  initialMatchweek?: number | null;
  initialPlayedGames?: Record<string, number | null>;
  onSubmit: (payload: ManualStandingsPayload) => Promise<ManualStandingsResult>;
  teams: ManualStandingsTeam[];
};

function optionalNumber(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

export function ManualStandingsForm({
  hasActiveSnapshot,
  initialLeaguePoints = {},
  initialMatchweek = null,
  initialPlayedGames = {},
  onSubmit,
  teams,
}: Props) {
  const [orderedTeams, setOrderedTeams] = useState(() =>
    teams.length === 20 ? teams : sortTeamsAlphabetically(teams),
  );
  const [matchweek, setMatchweek] = useState(
    initialMatchweek === null ? "" : String(initialMatchweek),
  );
  const [played, setPlayed] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      teams.map((team) => [
        team.id,
        initialPlayedGames[team.id] === null ||
        initialPlayedGames[team.id] === undefined
          ? ""
          : String(initialPlayedGames[team.id]),
      ]),
    ),
  );
  const [points, setPoints] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      teams.map((team) => [
        team.id,
        initialLeaguePoints[team.id] === null ||
        initialLeaguePoints[team.id] === undefined
          ? ""
          : String(initialLeaguePoints[team.id]),
      ]),
    ),
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<ManualStandingsResult | null>(null);
  const slugById = useMemo(
    () => new Map(teams.map((team) => [team.id, team.slug])),
    [teams],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (
      hasActiveSnapshot &&
      !window.confirm(
        "Save this 1–20 as the active provisional table? The previous valid snapshot will remain in history.",
      )
    ) {
      return;
    }

    const parsedMatchweek = optionalNumber(matchweek);
    if (
      Number.isNaN(parsedMatchweek) ||
      (parsedMatchweek !== null &&
        (parsedMatchweek < 1 || parsedMatchweek > 38))
    ) {
      setMessage({ ok: false, message: "Matchweek must be between 1 and 38." });
      return;
    }

    const standings = orderedTeams.map((team, index) => ({
      actualPosition: index + 1,
      leaguePoints: optionalNumber(points[team.id] ?? ""),
      playedGames: optionalNumber(played[team.id] ?? ""),
      teamSlug: slugById.get(team.id) ?? "",
    }));
    const invalidStats = standings.some(
      (item) =>
        Number.isNaN(item.leaguePoints) ||
        Number.isNaN(item.playedGames) ||
        (item.playedGames !== null &&
          (item.playedGames < 0 || item.playedGames > 38)) ||
        (item.leaguePoints !== null &&
          (item.leaguePoints < -100 || item.leaguePoints > 114)),
    );
    if (invalidStats) {
      setMessage({
        ok: false,
        message: "Played must be 0–38 and points must be -100–114.",
      });
      return;
    }

    setPending(true);
    try {
      const result = await onSubmit({ matchweek: parsedMatchweek, standings });
      setMessage(result);
    } catch {
      setMessage({
        ok: false,
        message:
          "We couldn't save the standings. Check your connection and try again.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid min-w-0 gap-5" onSubmit={handleSubmit}>
      <PredictionSorter
        disabled={pending}
        mode="standings"
        onChange={(next) => setOrderedTeams(next as ManualStandingsTeam[])}
        teams={orderedTeams}
      />

      <Card>
        <CardContent className="grid gap-5">
          <div>
            <label
              className="text-foreground text-sm font-black"
              htmlFor="matchweek"
            >
              Matchweek{" "}
              <span className="text-muted font-medium">(optional)</span>
            </label>
            <input
              className="border-border focus:border-accent focus:ring-accent/30 mt-2 min-h-12 w-full rounded-xl border px-3.5 text-base outline-none focus:ring-2 sm:max-w-40"
              id="matchweek"
              inputMode="numeric"
              max={38}
              min={1}
              onChange={(event) => setMatchweek(event.target.value)}
              type="number"
              value={matchweek}
            />
          </div>

          <details className="border-border bg-surface-subtle rounded-2xl border p-3 sm:p-4">
            <summary className="text-foreground min-h-11 cursor-pointer py-2 font-black">
              Optional games played and league points
            </summary>
            <p className="text-muted mt-1 text-xs leading-5">
              Leave values blank when unknown. Enter 0 played for every club to
              preserve the preseason no-scoring state.
            </p>
            <div className="mt-4 grid gap-2">
              {orderedTeams.map((team) => (
                <div
                  className="bg-surface ring-border grid grid-cols-[1fr_5rem_5rem] items-end gap-2 rounded-xl p-2 ring-1"
                  key={team.id}
                >
                  <span className="text-foreground min-w-0 truncate pb-3 text-sm font-bold">
                    {team.shortName}
                  </span>
                  <label className="text-muted text-[0.65rem] font-bold tracking-wide uppercase">
                    Played
                    <input
                      aria-label={`${team.displayName} games played`}
                      className="border-border text-foreground mt-1 min-h-11 w-full rounded-lg border px-2 text-base"
                      inputMode="numeric"
                      max={38}
                      min={0}
                      onChange={(event) =>
                        setPlayed((current) => ({
                          ...current,
                          [team.id]: event.target.value,
                        }))
                      }
                      type="number"
                      value={played[team.id] ?? ""}
                    />
                  </label>
                  <label className="text-muted text-[0.65rem] font-bold tracking-wide uppercase">
                    Points
                    <input
                      aria-label={`${team.displayName} league points`}
                      className="border-border text-foreground mt-1 min-h-11 w-full rounded-lg border px-2 text-base"
                      inputMode="numeric"
                      max={114}
                      min={-100}
                      onChange={(event) =>
                        setPoints((current) => ({
                          ...current,
                          [team.id]: event.target.value,
                        }))
                      }
                      type="number"
                      value={points[team.id] ?? ""}
                    />
                  </label>
                </div>
              ))}
            </div>
          </details>

          <p className="border-warning/35 bg-warning-soft text-warning flex items-start gap-2 rounded-xl border p-3 text-sm leading-5">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            Saving activates this table atomically. Invalid data never replaces
            the last good snapshot.
          </p>

          {message ? (
            <p
              className={`flex items-start gap-2 rounded-xl border p-3 text-sm font-bold ${message.ok ? "border-accent/30 bg-mint text-mint-ink" : "border-danger/35 bg-danger-soft text-danger"}`}
              role={message.ok ? "status" : "alert"}
            >
              {message.ok ? (
                <CheckCircle2 aria-hidden="true" className="size-5" />
              ) : null}
              {message.message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="border-border/80 bg-surface/95 sticky bottom-0 z-20 -mx-2 border-t px-2 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Button className="w-full" disabled={pending} size="lg" type="submit">
          <Save aria-hidden="true" className="size-5" />
          {pending ? "Saving table…" : "Save provisional standings"}
        </Button>
      </div>
    </form>
  );
}
