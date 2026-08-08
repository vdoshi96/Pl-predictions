"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertCircle, Check, X } from "lucide-react";

import { TeamMark } from "@/components/team-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { PredictionTeam } from "./prediction-sorter";

export interface ReviewDialogProps {
  open: boolean;
  participantName: string;
  teams: PredictionTeam[];
  pending: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ReviewDialog({
  open,
  participantName,
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
        <Dialog.Overlay className="bg-brand-strong/75 fixed inset-0 z-50 backdrop-blur-[2px] data-[state=closed]:animate-none motion-reduce:animate-none" />
        <Dialog.Content
          aria-describedby="prediction-review-description"
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (pending) event.preventDefault();
          }}
          className="border-border text-foreground fixed inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] bottom-2 z-50 flex flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl outline-none sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[min(860px,calc(100dvh-2rem))] sm:w-[min(36rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2"
        >
          <div className="border-border flex shrink-0 items-start justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="accent">Final review</Badge>
                <Badge>{teams.length} clubs</Badge>
              </div>
              <Dialog.Title className="text-brand-strong text-xl font-black tracking-tight sm:text-2xl">
                Check your 1–20
              </Dialog.Title>
              <Dialog.Description
                id="prediction-review-description"
                className="mt-1 text-sm leading-5 [overflow-wrap:anywhere] text-slate-600"
              >
                Submitting as{" "}
                <span className="text-brand-strong font-bold">
                  {participantName}
                </span>
                . Predictions cannot be edited after submission.
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
            <ol
              aria-label="Prediction review, positions 1 through 20"
              className="grid gap-1.5"
            >
              {teams.map((team, index) => {
                const position = index + 1;

                return (
                  <li
                    key={team.id}
                    value={position}
                    className="border-border flex min-h-12 min-w-0 items-center gap-3 rounded-xl border bg-[#fcf9fd] px-2.5 py-1.5"
                  >
                    <span className="bg-brand grid size-8 shrink-0 place-items-center rounded-lg font-mono text-xs font-black text-white tabular-nums">
                      {position}
                    </span>
                    <TeamMark
                      name={team.displayName}
                      initials={team.shortName}
                      src={team.assetPath}
                      size="sm"
                    />
                    <span className="text-brand-strong min-w-0 grow text-sm leading-4 font-bold break-words">
                      {team.displayName}
                    </span>
                    <Check
                      aria-hidden="true"
                      className="size-4 shrink-0 text-[#08734f]"
                    />
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="border-border shrink-0 border-t bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
            {error ? (
              <p
                role="alert"
                className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-5 font-medium text-red-800"
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
                disabled={pending}
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
