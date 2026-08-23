"use client";

import { AlertTriangle, LockKeyhole } from "lucide-react";
import { useActionState } from "react";

import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { TeamMark } from "@/components/team-mark";
import { Card, CardContent } from "@/components/ui/card";
import { formatChicagoUtcDateTime } from "@/shared/format";

import {
  INITIAL_WIN_STREAK_RESULT_ACTION_STATE,
  resolveWinStreakRoundAction,
} from "./actions";

export type WinStreakResultsDeskFixture = Readonly<{
  awayTeam: WinStreakResultsDeskTeam;
  homeTeam: WinStreakResultsDeskTeam;
  id: string;
  kickoffAt: string;
}>;

type WinStreakResultsDeskTeam = Readonly<{
  assetPath: string;
  displayName: string;
  shortName: string;
}>;

type WinStreakResultsDeskProps = Readonly<{
  canResolve: boolean;
  defaultCapturedAt: string;
  fixtures: readonly WinStreakResultsDeskFixture[];
  matchweek: number;
  roundId: string;
}>;

const OUTCOME_OPTIONS = [
  { label: "Home win", value: "home_win" },
  { label: "Draw", value: "draw" },
  { label: "Away win", value: "away_win" },
  { label: "Void", value: "void" },
] as const;

export function WinStreakResultsDesk({
  canResolve,
  defaultCapturedAt,
  fixtures,
  matchweek,
  roundId,
}: WinStreakResultsDeskProps) {
  const [state, formAction, pending] = useActionState(
    resolveWinStreakRoundAction,
    INITIAL_WIN_STREAK_RESULT_ACTION_STATE,
  );
  const controlsDisabled = !canResolve || pending;

  return (
    <form action={formAction} className="grid gap-4">
      <input name="roundId" type="hidden" value={roundId} />

      <div
        className="border-warning/35 bg-warning-soft text-warning flex items-start gap-3 rounded-2xl border p-4"
        role="note"
      >
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-black">Void requires owner review.</p>
          <p className="mt-1 text-sm leading-6 font-semibold">
            Use Void only after you confirm that the fixture does not count for
            this round. A void pick preserves the streak and returns that club
            to the available pool.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3">
          {fixtures.map((fixture, index) => (
            <fieldset
              className="border-border min-w-0 rounded-xl border p-3"
              disabled={controlsDisabled}
              key={fixture.id}
            >
              <legend className="sr-only">
                {`${fixture.homeTeam.displayName} against ${fixture.awayTeam.displayName} result`}
              </legend>
              <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <TeamMark
                      name={fixture.homeTeam.displayName}
                      size="sm"
                      src={fixture.homeTeam.assetPath}
                    />
                    <span className="text-foreground min-w-0 truncate text-sm font-black">
                      {fixture.homeTeam.shortName}
                    </span>
                    <span className="text-muted text-xs font-bold">vs</span>
                    <TeamMark
                      name={fixture.awayTeam.displayName}
                      size="sm"
                      src={fixture.awayTeam.assetPath}
                    />
                    <span className="text-foreground min-w-0 truncate text-sm font-black">
                      {fixture.awayTeam.shortName}
                    </span>
                  </div>
                  <p className="text-muted mt-2 text-xs leading-5">
                    {formatChicagoUtcDateTime(fixture.kickoffAt)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {OUTCOME_OPTIONS.map((option) => {
                    const inputId = `fixture-${index}-${option.value}`;
                    return (
                      <label
                        className="border-border bg-surface hover:border-accent-lilac has-checked:border-accent has-checked:bg-mint has-checked:text-mint-ink focus-within:ring-accent-blue flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-3 text-center text-xs font-black focus-within:ring-2"
                        htmlFor={inputId}
                        key={option.value}
                      >
                        <input
                          className="sr-only"
                          disabled={controlsDisabled}
                          id={inputId}
                          name={`result:${fixture.id}`}
                          required
                          type="radio"
                          value={option.value}
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </fieldset>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4">
          <div>
            <label
              className="text-foreground text-sm font-black"
              htmlFor="win-streak-result-source"
            >
              Source URL
            </label>
            <input
              autoComplete="url"
              className="border-border bg-surface text-foreground focus:border-accent-lilac focus:ring-accent/25 mt-1 min-h-12 w-full rounded-xl border px-3.5 text-base outline-none focus:ring-2 disabled:opacity-55"
              disabled={controlsDisabled}
              id="win-streak-result-source"
              name="sourceReference"
              placeholder="https://www.premierleague.com/..."
              required
              type="url"
            />
          </div>
          <div>
            <label
              className="text-foreground text-sm font-black"
              htmlFor="win-streak-result-captured-at"
            >
              Captured at (UTC)
            </label>
            <input
              className="border-border bg-surface text-foreground focus:border-accent-lilac focus:ring-accent/25 mt-1 min-h-12 w-full rounded-xl border px-3.5 text-base outline-none focus:ring-2 disabled:opacity-55"
              defaultValue={defaultCapturedAt.slice(0, 19)}
              disabled={controlsDisabled}
              id="win-streak-result-captured-at"
              name="capturedAt"
              required
              step="1"
              type="datetime-local"
            />
            <p className="text-muted mt-1 text-xs leading-5">
              Enter the source capture time in Coordinated Universal Time (UTC).
            </p>
          </div>

          {state.message ? (
            <p
              className={state.ok ? "text-mint-ink" : "text-danger"}
              role={state.ok ? "status" : "alert"}
            >
              {state.message}
            </p>
          ) : null}

          <ConfirmSubmitButton
            aria-busy={pending}
            className="w-full sm:w-fit"
            confirmation={`Lock all ten Matchweek ${matchweek} results? Results cannot be edited after this action.`}
            disabled={controlsDisabled}
            variant="danger"
          >
            <LockKeyhole aria-hidden="true" className="size-4" />
            {pending
              ? "Locking results…"
              : canResolve
                ? `Lock Matchweek ${matchweek} results`
                : "Waiting for every kickoff"}
          </ConfirmSubmitButton>
        </CardContent>
      </Card>
    </form>
  );
}
