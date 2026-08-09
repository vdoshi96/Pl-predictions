"use client";

import {
  AlertCircle,
  CheckCircle2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import {
  PredictionSorter,
  type PredictionTeam,
  sortTeamsAlphabetically,
} from "./prediction-sorter";
import { ReviewDialog } from "./review-dialog";
import {
  buildSpotlightCategoryPicks,
  buildSpotlightReviewItems,
  type PredictionPlayer,
  SpotlightPredictionsForm,
  type SpotlightCategorySubmissionPick,
  type SpotlightPicksDraft,
  spotlightPicksAreComplete,
} from "./spotlight-predictions-form";

export interface PredictionSubmissionItem {
  teamId: string;
  predictedPosition: number;
}

export interface PredictionSubmissionPayload {
  categoryPicks: SpotlightCategorySubmissionPick[];
  participantName: string;
  honeypot: string;
  items: PredictionSubmissionItem[];
}

export type PredictionSubmissionResult =
  | {
      ok: true;
      message?: string;
      entryId?: string;
    }
  | {
      ok: false;
      message: string;
    };

export interface PredictionFormProps {
  players?: PredictionPlayer[];
  teams: PredictionTeam[];
  onSubmit: (
    submission: PredictionSubmissionPayload,
  ) => Promise<PredictionSubmissionResult>;
  seasonName?: string;
  disabled?: boolean;
  disabledReason?: string;
  onPendingChange?: (pending: boolean) => void;
  onSuccess?: (
    result: Extract<PredictionSubmissionResult, { ok: true }>,
    submission: PredictionSubmissionPayload,
  ) => void;
  onError?: (message: string, submission: PredictionSubmissionPayload) => void;
}

const EXPECTED_TEAM_COUNT = 20;

export function normalizeDisplayName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

function buildTeamSetSignature(teams: readonly PredictionTeam[]) {
  return teams
    .map((team) => team.id)
    .sort()
    .join("|");
}

function buildPlayerSetSignature(players: readonly PredictionPlayer[]) {
  return players
    .map((player) => player.id)
    .sort()
    .join("|");
}

function messageFromUnknownError(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "We could not submit your prediction. Please try again.";
}

export function PredictionForm({
  players = [],
  teams,
  onSubmit,
  seasonName = "2026/27 Premier League",
  disabled = false,
  disabledReason = "Predictions are currently closed.",
  onPendingChange,
  onSuccess,
  onError,
}: PredictionFormProps) {
  const teamSetSignature = buildTeamSetSignature(teams);
  const playerSetSignature = buildPlayerSetSignature(players);
  const previousTeamSetSignatureRef = useRef(teamSetSignature);
  const previousPlayerSetSignatureRef = useRef(playerSetSignature);
  const pendingRef = useRef(false);
  const [orderedTeamIds, setOrderedTeamIds] = useState<string[]>(() =>
    sortTeamsAlphabetically(teams).map((team) => team.id),
  );
  const [participantName, setParticipantName] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [stage, setStage] = useState<"table" | "spotlight">("table");
  const [spotlightPicks, setSpotlightPicks] = useState<SpotlightPicksDraft>({});
  const [spotlightValidationAttempted, setSpotlightValidationAttempted] =
    useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<
    Extract<PredictionSubmissionResult, { ok: true }> | undefined
  >();

  const teamById = useMemo(
    () => new Map(teams.map((team) => [team.id, team])),
    [teams],
  );
  const orderedTeams = useMemo(
    () =>
      orderedTeamIds
        .map((teamId) => teamById.get(teamId))
        .filter((team): team is PredictionTeam => Boolean(team)),
    [orderedTeamIds, teamById],
  );
  const normalizedName = normalizeDisplayName(participantName);
  const normalizedNameKeyLength =
    normalizedName.toLocaleLowerCase("en-GB").length;
  const uniqueTeamCount = new Set(orderedTeamIds).size;
  const hasCompleteTable =
    orderedTeams.length === EXPECTED_TEAM_COUNT &&
    uniqueTeamCount === EXPECTED_TEAM_COUNT;
  const canContinue =
    !disabled &&
    !pending &&
    hasCompleteTable &&
    normalizedName.length >= 2 &&
    normalizedName.length <= 40 &&
    normalizedNameKeyLength <= 40;
  const spotlightReviewItems = useMemo(
    () => buildSpotlightReviewItems(spotlightPicks, players, orderedTeams),
    [orderedTeams, players, spotlightPicks],
  );
  const spotlightComplete =
    spotlightPicksAreComplete(spotlightPicks) &&
    spotlightReviewItems.length === 7;
  const canSubmit = canContinue && spotlightComplete;

  useEffect(() => {
    if (previousTeamSetSignatureRef.current === teamSetSignature) return;

    previousTeamSetSignatureRef.current = teamSetSignature;
    setOrderedTeamIds(sortTeamsAlphabetically(teams).map((team) => team.id));
    setSpotlightPicks({});
    setStage("table");
    setReviewOpen(false);
    setError(null);
  }, [teamSetSignature, teams]);

  useEffect(() => {
    if (previousPlayerSetSignatureRef.current === playerSetSignature) return;

    previousPlayerSetSignatureRef.current = playerSetSignature;
    const activePlayerIds = new Set(players.map((player) => player.id));
    setSpotlightPicks((current) => {
      let changed = false;
      const next = { ...current };
      for (const [category, pick] of Object.entries(next)) {
        if (pick?.kind === "player" && !activePlayerIds.has(pick.playerId)) {
          delete next[category as keyof SpotlightPicksDraft];
          changed = true;
        }
      }
      return changed ? next : current;
    });
    setReviewOpen(false);
    setError(null);
  }, [playerSetSignature, players]);

  function setPendingState(nextPending: boolean) {
    pendingRef.current = nextPending;
    setPending(nextPending);
    onPendingChange?.(nextPending);
  }

  function handleOrderChange(nextTeams: PredictionTeam[]) {
    setOrderedTeamIds(nextTeams.map((team) => team.id));
    setError(null);
  }

  function buildSubmission(): PredictionSubmissionPayload {
    return {
      participantName: normalizedName,
      honeypot,
      categoryPicks: buildSpotlightCategoryPicks(spotlightPicks),
      items: orderedTeams.map((team, index) => ({
        teamId: team.id,
        predictedPosition: index + 1,
      })),
    };
  }

  function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (disabled) {
      setError(disabledReason);
      return;
    }

    if (
      normalizedName.length < 2 ||
      normalizedName.length > 40 ||
      normalizedNameKeyLength > 40
    ) {
      setError("Enter a display name between 2 and 40 characters.");
      return;
    }

    if (!hasCompleteTable) {
      setError("Your prediction must include all 20 clubs exactly once.");
      return;
    }

    setParticipantName(normalizedName);
    setStage("spotlight");
    window.requestAnimationFrame(() => {
      document.getElementById("spotlight-picks-heading")?.focus();
      window.scrollTo({ behavior: "smooth", top: 0 });
    });
  }

  function handleFinalReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSpotlightValidationAttempted(true);

    if (!spotlightComplete) {
      setError(
        "Choose all seven spotlight predictions and complete every Other player name.",
      );
      window.requestAnimationFrame(() => {
        const invalidCard = Array.from(
          document.querySelectorAll<HTMLElement>("[data-category]"),
        ).find((card) => card.querySelector('[aria-invalid="true"]'));
        const target =
          invalidCard?.querySelector<HTMLInputElement>(
            '[data-other-player-input="true"][aria-invalid="true"]',
          ) ??
          invalidCard?.querySelector<HTMLInputElement>(
            'input[aria-invalid="true"]',
          );
        target?.focus();
      });
      return;
    }

    setReviewOpen(true);
  }

  async function confirmSubmission() {
    if (!canSubmit || pendingRef.current) return;

    const submission = buildSubmission();
    setError(null);
    setPendingState(true);

    let result: PredictionSubmissionResult;

    try {
      result = await onSubmit(submission);
    } catch (submissionError) {
      const message = messageFromUnknownError(submissionError);
      setPendingState(false);
      setError(message);
      onError?.(message, submission);
      return;
    }

    setPendingState(false);

    if (!result.ok) {
      setError(result.message);
      onError?.(result.message, submission);
      return;
    }

    setSuccess(result);
    setReviewOpen(false);
    setError(null);
    onSuccess?.(result, submission);
  }

  if (success) {
    return (
      <Card className="border-accent overflow-hidden">
        <CardContent className="grid justify-items-center gap-4 px-5 py-10 text-center sm:px-10">
          <span className="grid size-16 place-items-center rounded-2xl bg-[#ddffef] text-[#08734f]">
            <CheckCircle2 aria-hidden="true" className="size-9" />
          </span>
          <div>
            <Badge variant="success">Prediction submitted</Badge>
            <h2 className="text-brand-strong mt-3 text-2xl font-black tracking-tight [overflow-wrap:anywhere]">
              You’re in, {normalizedName}.
            </h2>
            <p
              role="status"
              className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600"
            >
              {success.message ??
                `Your ${seasonName} table and seven spotlight picks are saved. They cannot be edited after submission.`}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {success.entryId ? (
              <Link
                href={`/entries/${success.entryId}`}
                className="bg-accent text-brand hover:bg-accent-yellow focus-visible:ring-accent-blue inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                View confirmation
              </Link>
            ) : null}
            <Link
              href="/leaderboard"
              className="border-border text-brand hover:border-accent-lilac hover:bg-brand-soft focus-visible:ring-accent-blue inline-flex min-h-11 items-center justify-center rounded-xl border bg-white px-4 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              View leaderboard
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form
      onSubmit={stage === "table" ? handleContinue : handleFinalReview}
      className="grid min-w-0 gap-5"
      noValidate
    >
      {stage === "table" ? (
        <>
          <div className="flex items-center gap-2 text-xs font-black tracking-[0.12em] text-[#8f0033] uppercase">
            <span className="bg-brand text-accent grid size-7 place-items-center rounded-lg">
              1
            </span>
            Step 1 of 3 · Your table
          </div>
          <PredictionSorter
            teams={orderedTeams}
            onChange={handleOrderChange}
            disabled={disabled || pending}
          />

          <Card className="overflow-visible" id="submit-prediction">
            <CardContent className="grid gap-4">
              <div className="flex items-start gap-3">
                <span className="text-brand grid size-10 shrink-0 place-items-center rounded-xl bg-[#dffcff]">
                  <ShieldCheck aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-brand-strong text-lg font-black">
                    Who is making this prediction?
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    Add your display name, then continue to the seven spotlight
                    picks before the final review.
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="participant-name"
                  className="text-sm font-bold text-slate-800"
                >
                  Your display name
                </label>
                <input
                  id="participant-name"
                  name="participantName"
                  type="text"
                  value={participantName}
                  onChange={(event) => {
                    setParticipantName(event.target.value);
                    setError(null);
                  }}
                  autoComplete="name"
                  autoCapitalize="words"
                  enterKeyHint="done"
                  minLength={2}
                  maxLength={40}
                  required
                  disabled={disabled || pending}
                  aria-describedby="participant-name-help"
                  className="border-border text-brand-strong focus:border-accent-lilac mt-2 min-h-12 w-full rounded-xl border bg-white px-3.5 text-base outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-[#dffcff] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  placeholder="e.g. Vishal"
                />
                <p
                  id="participant-name-help"
                  className="mt-1.5 text-xs leading-5 text-slate-500"
                >
                  2–40 characters. This is the only personal information stored.
                </p>
              </div>

              <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-[10000px]"
              >
                <label htmlFor="prediction-website">
                  Leave this field empty
                </label>
                <input
                  id="prediction-website"
                  name="website"
                  type="text"
                  value={honeypot}
                  onChange={(event) => setHoneypot(event.target.value)}
                  autoComplete="off"
                  tabIndex={-1}
                />
              </div>

              {disabled ? (
                <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
                  <LockKeyhole
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span>{disabledReason}</span>
                </p>
              ) : null}

              {error ? (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-5 font-medium text-red-800"
                >
                  <AlertCircle
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span>{error}</span>
                </p>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : (
        <SpotlightPredictionsForm
          disabled={disabled || pending}
          invalid={spotlightValidationAttempted}
          onChange={(nextPicks) => {
            setSpotlightPicks(nextPicks);
            setError(null);
          }}
          picks={spotlightPicks}
          players={players}
          teams={orderedTeams}
        />
      )}

      {stage === "spotlight" && error && !reviewOpen ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-5 font-medium text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}

      <div className="border-border/80 sticky bottom-0 z-20 -mx-2 border-t bg-white/95 px-2 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-16px_30px_-26px_rgba(55,0,60,0.6)] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
        <div
          className={stage === "spotlight" ? "grid gap-2 sm:grid-cols-2" : ""}
        >
          {stage === "spotlight" ? (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => {
                setStage("table");
                setError(null);
                window.requestAnimationFrame(() => window.scrollTo({ top: 0 }));
              }}
            >
              Back to table
            </Button>
          ) : null}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={stage === "table" ? !canContinue : pending}
            aria-describedby="review-button-help"
          >
            {stage === "table"
              ? "Continue to spotlight picks"
              : "Review all predictions"}
          </Button>
        </div>
        <p
          id="review-button-help"
          className="mt-2 text-center text-xs leading-5 text-slate-500"
        >
          {stage === "table"
            ? "Nothing is saved yet. Your table stays here if you go back."
            : `${Object.keys(spotlightPicks).length} of 7 spotlight categories started.`}
        </p>
      </div>

      <ReviewDialog
        open={reviewOpen}
        participantName={normalizedName}
        spotlightPicks={spotlightReviewItems}
        teams={orderedTeams}
        pending={pending}
        error={error}
        onOpenChange={(nextOpen) => {
          setReviewOpen(nextOpen);
          if (!nextOpen) setError(null);
        }}
        onConfirm={confirmSubmission}
      />
    </form>
  );
}
