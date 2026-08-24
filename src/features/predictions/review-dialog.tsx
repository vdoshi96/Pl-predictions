"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertCircle, X } from "lucide-react";

import { PlayerMark } from "@/components/player-mark";
import { TeamMark } from "@/components/team-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { PredictionTeam } from "./prediction-sorter";
import type { SpotlightReviewItem } from "./spotlight-predictions-form";

export interface ReviewDialogProps {
  confirmDisabled?: boolean;
  open: boolean;
  participantName: string;
  spotlightPicks: SpotlightReviewItem[];
  teams: PredictionTeam[];
  pending: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
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

export function ReviewDialog({
  confirmDisabled = false,
  open,
  participantName,
  spotlightPicks,
  teams,
  pending,
  error,
  onOpenChange,
  onConfirm,
}: ReviewDialogProps) {
  function handleOpenChange(nextOpen: boolean) {
    if (!pending) onOpenChange(nextOpen);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="t-modal-overlay bg-brand-strong/75 fixed inset-0 z-50 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby="prediction-review-description"
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (pending) event.preventDefault();
          }}
          className={`t-modal t-modal-centered-responsive border-border text-foreground bg-surface fixed inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] bottom-2 z-50 flex flex-col overflow-hidden rounded-2xl border shadow-2xl outline-none sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[min(900px,calc(100dvh-2rem))] sm:w-[min(48rem,calc(100vw-2rem))] ${open ? "is-open" : "is-closing"}`}
        >
          <div className="border-border flex shrink-0 items-start justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="accent">Final review</Badge>
                <Badge>{teams.length} clubs</Badge>
                <Badge>{spotlightPicks.length} spotlight picks</Badge>
              </div>
              <Dialog.Title className="text-brand-ink-strong text-xl font-black tracking-tight sm:text-2xl">
                Review every prediction
              </Dialog.Title>
              <Dialog.Description
                id="prediction-review-description"
                className="text-muted mt-1 text-sm leading-5 [overflow-wrap:anywhere]"
              >
                Submitting as{" "}
                <span className="text-brand-ink-strong font-bold">
                  {participantName}
                </span>
                . Your table and spotlight picks cannot be edited after
                submission.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={pending}
                aria-label="Close prediction review"
                className="-mt-1 -mr-2 size-11"
              >
                <X aria-hidden="true" className="size-5" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 grow overflow-y-auto overscroll-contain px-3 py-3 sm:px-5">
            <section aria-labelledby="spotlight-review-heading">
              <h2
                id="spotlight-review-heading"
                className="text-brand-ink-strong px-1 text-sm font-black"
              >
                Spotlight picks
              </h2>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
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

            <section className="mt-5" aria-labelledby="table-review-heading">
              <div className="flex items-center justify-between gap-3 px-1">
                <h2
                  id="table-review-heading"
                  className="text-brand-ink-strong text-sm font-black"
                >
                  Predicted table
                </h2>
                <span className="text-muted text-xs font-semibold">
                  Champion: {teams[0]?.displayName}
                </span>
              </div>
              <div
                aria-label="Prediction review, positions 1 through 20"
                role="group"
                className="mt-2 grid gap-2"
              >
                <div>
                  <p className="text-rose-ink mb-1 px-1 text-[0.65rem] font-black tracking-wide uppercase">
                    Top 5
                  </p>
                  <ol className="grid gap-1">
                    {teams.slice(0, 5).map((team, index) => (
                      <ReviewTeamRow
                        key={team.id}
                        position={index + 1}
                        team={team}
                      />
                    ))}
                  </ol>
                </div>

                <details className="border-border bg-surface-lilac rounded-xl border">
                  <summary className="text-brand-ink cursor-pointer px-3 py-2.5 text-sm font-black">
                    Show all 20 clubs
                  </summary>
                  <ol className="grid gap-1 px-2 pb-2" start={6}>
                    {teams.slice(5, 17).map((team, index) => (
                      <ReviewTeamRow
                        key={team.id}
                        position={index + 6}
                        team={team}
                      />
                    ))}
                  </ol>
                </details>

                <div>
                  <p className="text-rose-ink mb-1 px-1 text-[0.65rem] font-black tracking-wide uppercase">
                    Bottom 3
                  </p>
                  <ol className="grid gap-1" start={18}>
                    {teams.slice(17).map((team, index) => (
                      <ReviewTeamRow
                        key={team.id}
                        position={index + 18}
                        team={team}
                      />
                    ))}
                  </ol>
                </div>
              </div>
            </section>
          </div>

          <div className="border-border bg-surface shrink-0 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
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
              <Dialog.Close asChild>
                <Button variant="secondary" size="lg" disabled={pending}>
                  Go back
                </Button>
              </Dialog.Close>
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
