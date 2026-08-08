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

export interface PredictionSubmissionItem {
  teamId: string;
  predictedPosition: number;
}

export interface PredictionSubmissionPayload {
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
  return value.trim().replace(/\s+/g, " ");
}

function buildTeamSetSignature(teams: readonly PredictionTeam[]) {
  return teams
    .map((team) => team.id)
    .sort()
    .join("|");
}

function messageFromUnknownError(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "We could not submit your prediction. Please try again.";
}

export function PredictionForm({
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
  const previousTeamSetSignatureRef = useRef(teamSetSignature);
  const pendingRef = useRef(false);
  const [orderedTeamIds, setOrderedTeamIds] = useState<string[]>(() =>
    sortTeamsAlphabetically(teams).map((team) => team.id),
  );
  const [participantName, setParticipantName] = useState("");
  const [honeypot, setHoneypot] = useState("");
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
  const uniqueTeamCount = new Set(orderedTeamIds).size;
  const hasCompleteTable =
    orderedTeams.length === EXPECTED_TEAM_COUNT &&
    uniqueTeamCount === EXPECTED_TEAM_COUNT;
  const canReview =
    !disabled &&
    !pending &&
    hasCompleteTable &&
    normalizedName.length >= 2 &&
    normalizedName.length <= 40;

  useEffect(() => {
    if (previousTeamSetSignatureRef.current === teamSetSignature) return;

    previousTeamSetSignatureRef.current = teamSetSignature;
    setOrderedTeamIds(sortTeamsAlphabetically(teams).map((team) => team.id));
    setReviewOpen(false);
    setError(null);
  }, [teamSetSignature, teams]);

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
      items: orderedTeams.map((team, index) => ({
        teamId: team.id,
        predictedPosition: index + 1,
      })),
    };
  }

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (disabled) {
      setError(disabledReason);
      return;
    }

    if (normalizedName.length < 2 || normalizedName.length > 40) {
      setError("Enter a display name between 2 and 40 characters.");
      return;
    }

    if (!hasCompleteTable) {
      setError("Your prediction must include all 20 clubs exactly once.");
      return;
    }

    setParticipantName(normalizedName);
    setReviewOpen(true);
  }

  async function confirmSubmission() {
    if (!canReview || pendingRef.current) return;

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
      <Card className="overflow-hidden border-emerald-200">
        <CardContent className="grid justify-items-center gap-4 px-5 py-10 text-center sm:px-10">
          <span className="grid size-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
            <CheckCircle2 aria-hidden="true" className="size-9" />
          </span>
          <div>
            <Badge variant="success">Prediction submitted</Badge>
            <h2 className="mt-3 text-2xl font-black tracking-tight [overflow-wrap:anywhere] text-slate-950">
              You’re in, {normalizedName}.
            </h2>
            <p
              role="status"
              className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600"
            >
              {success.message ??
                "Your final 1–20 has been saved. It cannot be edited after submission."}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {success.entryId ? (
              <Link
                href={`/entries/${success.entryId}`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 outline-none hover:bg-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                View confirmation
              </Link>
            ) : null}
            <Link
              href="/leaderboard"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              Friends leaderboard
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleReview} className="grid min-w-0 gap-5" noValidate>
      <PredictionSorter
        teams={orderedTeams}
        onChange={handleOrderChange}
        disabled={disabled || pending}
      />

      <Card className="overflow-visible" id="submit-prediction">
        <CardContent className="grid gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-800">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-950">
                Ready to make it official?
              </h2>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Review every position before submitting your immutable{" "}
                {seasonName} prediction.
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
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
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
            <label htmlFor="prediction-website">Leave this field empty</label>
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

      <div className="sticky bottom-0 z-20 -mx-2 border-t border-slate-200/80 bg-white/95 px-2 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-16px_30px_-26px_rgba(15,23,42,0.7)] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!canReview}
          aria-describedby="review-button-help"
        >
          Review your 1–20
        </Button>
        <p
          id="review-button-help"
          className="mt-2 text-center text-xs leading-5 text-slate-500"
        >
          Nothing is saved until you confirm on the next screen.
        </p>
      </div>

      <ReviewDialog
        open={reviewOpen}
        participantName={normalizedName}
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
