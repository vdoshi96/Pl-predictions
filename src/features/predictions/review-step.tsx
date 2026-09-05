"use client";

import { useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";
import { PlayerMark } from "@/components/player-mark";
import { TeamMark } from "@/components/team-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PredictionTeam } from "./prediction-sorter";
import type { SpotlightReviewItem } from "./spotlight-predictions-form";

interface ReviewStepProps {
  confirmDisabled?: boolean;
  participantName: string;
  spotlightPicks: SpotlightReviewItem[];
  teams: PredictionTeam[];
  pending: boolean;
  error?: string | null;
  onEdit: (stage: "table" | "spotlight") => void;
  onConfirm: () => void;
}

function ReviewTeamRow({
  position,
  team,
}: {
  position: number;
  team: PredictionTeam;
}) {
  return (
    <li
      value={position}
      className="border-border bg-surface-lilac flex min-h-11 min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-1"
    >
      <span className="bg-brand grid size-7 shrink-0 place-items-center rounded-lg font-mono text-xs font-black text-white tabular-nums">
        {position}
      </span>
      <TeamMark
        name={team.displayName}
        initials={team.shortName}
        src={team.assetPath}
        size="sm"
      />
      <span className="text-brand-ink-strong min-w-0 grow text-sm leading-4 font-bold break-words">
        {team.displayName}
      </span>
    </li>
  );
}

export function ReviewStep({
  confirmDisabled = false,
  participantName,
  spotlightPicks,
  teams,
  pending,
  error,
  onEdit,
  onConfirm,
}: ReviewStepProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section
      className="prediction-review-step grid gap-6"
      aria-labelledby="prediction-review-heading"
      aria-describedby="prediction-review-description"
    >
      <header>
        <div className="mb-3 flex flex-wrap gap-2">
          <Badge variant="accent">Step 3 of 3</Badge>
          <Badge>{teams.length} clubs</Badge>
          <Badge>{spotlightPicks.length} spotlight picks</Badge>
        </div>
        <h1
          ref={heading}
          tabIndex={-1}
          id="prediction-review-heading"
          className="text-foreground text-3xl font-black tracking-tight outline-none sm:text-4xl"
        >
          Review every prediction
        </h1>
        <p
          id="prediction-review-description"
          className="text-muted mt-2 text-sm leading-6 wrap-anywhere"
        >
          Submitting as{" "}
          <strong className="text-foreground">{participantName}</strong>. Your
          table and spotlight picks cannot be edited after submission.
        </p>
      </header>
      <div className="grid items-start gap-6 sm:grid-cols-2">
        <section aria-labelledby="table-review-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="table-review-heading" className="font-black">
              Predicted table
            </h2>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => onEdit("table")}
            >
              Edit table
            </Button>
          </div>
          <p className="text-muted mb-2 text-xs">
            Champion: {teams[0]?.displayName}
          </p>
          <div
            role="group"
            aria-label="Prediction review, positions 1 through 20"
          >
            <ol className="grid gap-1">
              {teams.map((team, index) => (
                <ReviewTeamRow key={team.id} position={index + 1} team={team} />
              ))}
            </ol>
          </div>
        </section>
        <div className="grid gap-4">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => onEdit("spotlight")}
            >
              Edit picks
            </Button>
          </div>
          <section aria-labelledby="spotlight-review-heading">
            <h2
              id="spotlight-review-heading"
              className="text-brand-ink-strong px-1 text-sm font-black"
            >
              Spotlight picks
            </h2>
            <div className="mt-2 grid gap-1.5">
              {spotlightPicks.map((pick) => (
                <div
                  className="border-border bg-surface-lilac flex min-h-12 min-w-0 items-center gap-2 rounded-xl border p-2"
                  data-category={pick.category}
                  key={pick.category}
                >
                  {pick.subject === "team" ? (
                    <TeamMark
                      name={pick.displayName}
                      initials={pick.shortName}
                      src={pick.assetPath}
                      size="sm"
                    />
                  ) : (
                    <PlayerMark
                      name={pick.displayName}
                      src={pick.assetPath}
                      size="sm"
                    />
                  )}
                  <div className="min-w-0">
                    <span className="text-rose-ink text-[0.65rem] font-black tracking-wide uppercase">
                      {pick.label}
                    </span>
                    <strong className="text-brand-ink-strong mt-0.5 block text-sm leading-5 break-words">
                      {pick.displayName}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <p className="border-border bg-surface rounded-xl border p-4 text-sm leading-6">
            Your complete table and all seven picks are submitted together. If
            the deadline has passed, nothing is accepted.
          </p>
        </div>
      </div>
      <div className="border-border border-t pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {error ? (
          <p
            role="alert"
            className="border-danger/35 bg-danger-soft text-danger mb-3 flex items-start gap-2 rounded-xl border p-3 text-sm leading-5 font-medium"
          >
            <AlertCircle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <span>{error}</span>
          </p>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="secondary"
            size="lg"
            disabled={pending}
            onClick={() => onEdit("spotlight")}
          >
            Go back
          </Button>
          <Button
            size="lg"
            onClick={onConfirm}
            disabled={pending || confirmDisabled}
            aria-busy={pending}
          >
            {pending ? "Submitting…" : "Submit prediction"}
          </Button>
        </div>
      </div>
    </section>
  );
}
