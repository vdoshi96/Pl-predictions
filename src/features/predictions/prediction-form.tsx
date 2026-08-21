"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { AlphabeticalOrderDialog } from "./alphabetical-order-dialog";
import type { PredictionCategory } from "./categories";
import {
  parsePredictionDraft,
  predictionDraftStorageKey,
  serializePredictionDraft,
  type PredictionDraft,
} from "./prediction-draft";
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
  spotlightIncompleteCategories,
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
  teams: PredictionTeam[];
  onSubmit: (
    submission: PredictionSubmissionPayload,
  ) => Promise<PredictionSubmissionResult>;
  seasonName?: string;
  seasonSlug?: string;
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

type PlayerCatalogueStatus = "idle" | "loading" | "ready" | "error";

function parsePlayerCataloguePayload(
  value: unknown,
  expectedSeasonSlug: string,
): PredictionPlayer[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("The player catalogue response was invalid.");
  }

  const payload = value as Record<string, unknown>;
  if (
    payload.seasonSlug !== expectedSeasonSlug ||
    !Array.isArray(payload.players) ||
    payload.players.length > 1_000
  ) {
    throw new Error("The player catalogue did not match this season.");
  }

  const seenIds = new Set<string>();
  return payload.players.map((candidate) => {
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      Array.isArray(candidate)
    ) {
      throw new Error("The player catalogue response was invalid.");
    }
    const player = candidate as Record<string, unknown>;
    const id = typeof player.id === "string" ? player.id : "";
    const displayName =
      typeof player.displayName === "string" ? player.displayName : "";
    const firstName =
      player.firstName === null || typeof player.firstName === "string"
        ? player.firstName
        : null;
    const lastName =
      player.lastName === null || typeof player.lastName === "string"
        ? player.lastName
        : null;
    const assetPath =
      player.assetPath === null ||
      (typeof player.assetPath === "string" &&
        player.assetPath.startsWith("/player-faces/") &&
        !player.assetPath.includes(".."))
        ? player.assetPath
        : null;

    if (
      !id ||
      id.length > 100 ||
      seenIds.has(id) ||
      !displayName.trim() ||
      displayName.length > 120 ||
      (typeof firstName === "string" && firstName.length > 80) ||
      (typeof lastName === "string" && lastName.length > 80)
    ) {
      throw new Error("The player catalogue response was invalid.");
    }
    seenIds.add(id);

    return { assetPath, displayName, firstName, id, lastName };
  });
}

export function normalizeDisplayName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

function buildTeamSetSignature(teams: readonly PredictionTeam[]) {
  return teams
    .map((team) => team.id)
    .sort()
    .join("|");
}

function draftHasChanges(
  draft: PredictionDraft,
  alphabeticalTeamIds: readonly string[],
) {
  return (
    draft.participantName.length > 0 ||
    draft.orderedTeamIds.length !== alphabeticalTeamIds.length ||
    draft.orderedTeamIds.some(
      (teamId, index) => teamId !== alphabeticalTeamIds[index],
    ) ||
    Object.keys(draft.spotlightPicks).length > 0 ||
    draft.stage === "spotlight"
  );
}

function draftContentSignature(draft: PredictionDraft, seasonSlug: string) {
  return JSON.stringify({ ...draft, seasonSlug });
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
  seasonSlug = "2026-27",
  disabled = false,
  disabledReason = "Predictions are currently closed.",
  onPendingChange,
  onSuccess,
  onError,
}: PredictionFormProps) {
  const resolvedSeasonSlug = seasonSlug.trim();
  const teamSetSignature = buildTeamSetSignature(teams);
  const activeSeasonSlugRef = useRef(resolvedSeasonSlug);
  const previousSeasonSlugRef = useRef(resolvedSeasonSlug);
  const previousTeamSetSignatureRef = useRef(teamSetSignature);
  const lastPersistedDraftContentRef = useRef<string | null>(null);
  const pendingDraftPersistenceRef = useRef<PredictionDraft | null>(null);
  const draftPersistenceTimerRef = useRef<number | null>(null);
  const skipNextDraftPersistenceRef = useRef(false);
  const pendingRef = useRef(false);
  const [orderedTeamIds, setOrderedTeamIds] = useState<string[]>(() =>
    sortTeamsAlphabetically(teams).map((team) => team.id),
  );
  const [participantName, setParticipantName] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [stage, setStage] = useState<"table" | "spotlight">("table");
  const [spotlightPicks, setSpotlightPicks] = useState<SpotlightPicksDraft>({});
  const spotlightPicksRef = useRef<SpotlightPicksDraft>({});
  const [spotlightValidationAttempted, setSpotlightValidationAttempted] =
    useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<
    Extract<PredictionSubmissionResult, { ok: true }> | undefined
  >();
  const [alphabeticalWarningOpen, setAlphabeticalWarningOpen] = useState(false);
  const [alphabeticalOrderAcknowledged, setAlphabeticalOrderAcknowledged] =
    useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState<
    "idle" | "restored" | "saved" | "unavailable"
  >("idle");
  const [persistedDraftContent, setPersistedDraftContent] = useState<
    string | null
  >(null);
  const [cataloguePlayers, setCataloguePlayers] = useState<PredictionPlayer[]>(
    [],
  );
  const [playerCatalogueStatus, setPlayerCatalogueStatus] =
    useState<PlayerCatalogueStatus>("idle");
  const [playerCatalogueMessage, setPlayerCatalogueMessage] = useState<
    string | null
  >(null);
  const [expandedSelectorCategory, setExpandedSelectorCategory] =
    useState<PredictionCategory | null>(null);
  const playerCatalogueRequestRef = useRef<Promise<void> | null>(null);
  const playerCatalogueAbortRef = useRef<AbortController | null>(null);

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
  const alphabeticalTeams = useMemo(
    () => sortTeamsAlphabetically(teams),
    [teams],
  );
  const alphabeticalTeamIds = useMemo(
    () => alphabeticalTeams.map((team) => team.id),
    [alphabeticalTeams],
  );
  const isAlphabetical =
    orderedTeamIds.length === alphabeticalTeamIds.length &&
    orderedTeamIds.every(
      (teamId, index) => teamId === alphabeticalTeamIds[index],
    );
  const storageKey = predictionDraftStorageKey(resolvedSeasonSlug);
  const normalizedName = normalizeDisplayName(participantName);
  const normalizedNameKeyLength =
    normalizedName.toLocaleLowerCase("en-GB").length;
  const uniqueTeamCount = new Set(orderedTeamIds).size;
  const hasCompleteTable =
    orderedTeams.length === EXPECTED_TEAM_COUNT &&
    uniqueTeamCount === EXPECTED_TEAM_COUNT;
  const canContinue =
    draftReady &&
    !disabled &&
    !pending &&
    hasCompleteTable &&
    normalizedName.length >= 2 &&
    normalizedName.length <= 40 &&
    normalizedNameKeyLength <= 40;
  const spotlightReviewItems = useMemo(
    () =>
      buildSpotlightReviewItems(spotlightPicks, cataloguePlayers, orderedTeams),
    [cataloguePlayers, orderedTeams, spotlightPicks],
  );
  const spotlightComplete =
    spotlightPicksAreComplete(spotlightPicks) &&
    spotlightReviewItems.length === 7;
  const incompleteSpotlightCategories =
    spotlightIncompleteCategories(spotlightPicks);
  const canSubmit = canContinue && spotlightComplete;
  const currentDraft: PredictionDraft = {
    orderedTeamIds,
    participantName,
    spotlightPicks,
    stage,
  };
  const currentDraftHasChanges = draftHasChanges(
    currentDraft,
    alphabeticalTeamIds,
  );
  const currentDraftContent = draftContentSignature(
    currentDraft,
    resolvedSeasonSlug,
  );
  const currentDraftIsPersisted =
    currentDraftHasChanges && currentDraftContent === persistedDraftContent;
  const draftStatusMessage = !draftReady
    ? "Checking this browser for a saved draft…"
    : draftStatus === "unavailable"
      ? "This browser could not save a draft. Refreshing may lose your changes."
      : draftStatus === "restored" && currentDraftIsPersisted
        ? "Draft restored from this browser."
        : currentDraftIsPersisted
          ? "Draft saved in this browser until you submit."
          : "Not submitted. Your progress will be saved in this browser until you submit.";

  const persistDraftSnapshot = useCallback(
    (nextDraft: PredictionDraft) => {
      if (
        !draftReady ||
        success ||
        disabled ||
        activeSeasonSlugRef.current !== resolvedSeasonSlug
      ) {
        return;
      }

      try {
        if (!draftHasChanges(nextDraft, alphabeticalTeamIds)) {
          window.localStorage.removeItem(storageKey);
          lastPersistedDraftContentRef.current = null;
          setPersistedDraftContent(null);
          setDraftStatus("idle");
          return;
        }

        const content = draftContentSignature(nextDraft, resolvedSeasonSlug);
        if (content !== lastPersistedDraftContentRef.current) {
          window.localStorage.setItem(
            storageKey,
            serializePredictionDraft(nextDraft, resolvedSeasonSlug),
          );
          lastPersistedDraftContentRef.current = content;
          setDraftStatus("saved");
        } else {
          setDraftStatus((currentStatus) =>
            currentStatus === "restored" ? currentStatus : "saved",
          );
        }
        setPersistedDraftContent(content);
      } catch {
        setDraftStatus("unavailable");
      }
    },
    [
      alphabeticalTeamIds,
      disabled,
      draftReady,
      resolvedSeasonSlug,
      storageKey,
      success,
    ],
  );

  const flushDraftPersistence = useCallback(() => {
    if (draftPersistenceTimerRef.current !== null) {
      window.clearTimeout(draftPersistenceTimerRef.current);
      draftPersistenceTimerRef.current = null;
    }
    const pendingDraft = pendingDraftPersistenceRef.current;
    pendingDraftPersistenceRef.current = null;
    if (pendingDraft) persistDraftSnapshot(pendingDraft);
  }, [persistDraftSnapshot]);

  const commitDraftSnapshot = useCallback(
    (nextDraft: PredictionDraft) => {
      pendingDraftPersistenceRef.current = null;
      if (draftPersistenceTimerRef.current !== null) {
        window.clearTimeout(draftPersistenceTimerRef.current);
        draftPersistenceTimerRef.current = null;
      }
      persistDraftSnapshot(nextDraft);
    },
    [persistDraftSnapshot],
  );

  const scheduleDraftPersistence = useCallback(
    (nextDraft: PredictionDraft) => {
      pendingDraftPersistenceRef.current = nextDraft;
      if (draftPersistenceTimerRef.current !== null) {
        window.clearTimeout(draftPersistenceTimerRef.current);
      }
      draftPersistenceTimerRef.current = window.setTimeout(
        flushDraftPersistence,
        400,
      );
    },
    [flushDraftPersistence],
  );

  /* eslint-disable react-hooks/set-state-in-effect -- localStorage is a browser-only external store; hydration and write outcomes must update the visible draft state. */
  useEffect(() => {
    const seasonChanged = previousSeasonSlugRef.current !== resolvedSeasonSlug;
    const teamSetChanged =
      previousTeamSetSignatureRef.current !== teamSetSignature;
    if (!seasonChanged && !teamSetChanged) return;

    previousSeasonSlugRef.current = resolvedSeasonSlug;
    previousTeamSetSignatureRef.current = teamSetSignature;
    activeSeasonSlugRef.current = resolvedSeasonSlug;
    skipNextDraftPersistenceRef.current = true;
    lastPersistedDraftContentRef.current = null;
    pendingDraftPersistenceRef.current = null;
    if (draftPersistenceTimerRef.current !== null) {
      window.clearTimeout(draftPersistenceTimerRef.current);
      draftPersistenceTimerRef.current = null;
    }

    if (seasonChanged) {
      playerCatalogueAbortRef.current?.abort();
      playerCatalogueAbortRef.current = null;
      playerCatalogueRequestRef.current = null;
    }

    setOrderedTeamIds(alphabeticalTeamIds);
    setParticipantName("");
    spotlightPicksRef.current = {};
    setSpotlightPicks({});
    setStage("table");
    setSpotlightValidationAttempted(false);
    setReviewOpen(false);
    setAlphabeticalWarningOpen(false);
    setAlphabeticalOrderAcknowledged(false);
    setError(null);
    setDraftReady(false);
    setDraftStatus("idle");
    setPersistedDraftContent(null);
    if (seasonChanged) {
      setCataloguePlayers([]);
      setPlayerCatalogueStatus("idle");
      setPlayerCatalogueMessage(null);
    }
    setExpandedSelectorCategory(null);
  }, [alphabeticalTeamIds, resolvedSeasonSlug, teamSetSignature]);

  useEffect(() => {
    try {
      const serialized = window.localStorage.getItem(storageKey);
      if (!serialized) {
        lastPersistedDraftContentRef.current = null;
        setPersistedDraftContent(null);
        setDraftStatus("idle");
        setDraftReady(true);
        return;
      }

      const restored = parsePredictionDraft(
        serialized,
        resolvedSeasonSlug,
        alphabeticalTeams,
      );
      if (!restored) {
        window.localStorage.removeItem(storageKey);
        lastPersistedDraftContentRef.current = null;
        setPersistedDraftContent(null);
        setDraftStatus("idle");
        setDraftReady(true);
        return;
      }

      setOrderedTeamIds(restored.orderedTeamIds);
      setParticipantName(restored.participantName);
      spotlightPicksRef.current = restored.spotlightPicks;
      setSpotlightPicks(restored.spotlightPicks);
      setStage(restored.stage);
      const restoredContent = draftContentSignature(
        restored,
        resolvedSeasonSlug,
      );
      lastPersistedDraftContentRef.current = restoredContent;
      setPersistedDraftContent(restoredContent);
      skipNextDraftPersistenceRef.current = true;
      setDraftStatus("restored");
      setDraftReady(true);
    } catch {
      lastPersistedDraftContentRef.current = null;
      setPersistedDraftContent(null);
      setDraftStatus("unavailable");
      setDraftReady(true);
    }
  }, [alphabeticalTeams, resolvedSeasonSlug, storageKey, teamSetSignature]);

  useEffect(() => {
    if (!draftReady || success || disabled) return;
    if (skipNextDraftPersistenceRef.current) {
      skipNextDraftPersistenceRef.current = false;
      return;
    }

    scheduleDraftPersistence({
      orderedTeamIds,
      participantName,
      spotlightPicks,
      stage,
    });
  }, [
    draftReady,
    disabled,
    orderedTeamIds,
    participantName,
    scheduleDraftPersistence,
    spotlightPicks,
    stage,
    success,
  ]);

  useEffect(() => {
    const flushOnPageHide = () => flushDraftPersistence();
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") flushDraftPersistence();
    };
    window.addEventListener("pagehide", flushOnPageHide);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      window.removeEventListener("pagehide", flushOnPageHide);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    };
  }, [flushDraftPersistence]);

  useEffect(() => {
    if (!draftReady || !disabled || success) return;

    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // The server-verified permanent closure remains authoritative even when
      // this browser's storage backend is unavailable.
    }
    lastPersistedDraftContentRef.current = null;
    setPersistedDraftContent(null);
    setOrderedTeamIds(alphabeticalTeamIds);
    setParticipantName("");
    spotlightPicksRef.current = {};
    setSpotlightPicks({});
    setStage("table");
    setSpotlightValidationAttempted(false);
    setReviewOpen(false);
    setAlphabeticalWarningOpen(false);
    setAlphabeticalOrderAcknowledged(false);
    setExpandedSelectorCategory(null);
    setError(null);
    setDraftStatus("idle");
  }, [alphabeticalTeamIds, disabled, draftReady, storageKey, success]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!currentDraftHasChanges || draftStatus !== "unavailable" || success)
      return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [currentDraftHasChanges, draftStatus, success]);

  const loadPlayerCatalogue = useCallback(
    async (force = false) => {
      if (
        playerCatalogueRequestRef.current ||
        (!force && playerCatalogueStatus !== "idle")
      ) {
        return;
      }

      const request = (async () => {
        const controller = new AbortController();
        const requestSeasonSlug = resolvedSeasonSlug;
        playerCatalogueAbortRef.current = controller;
        setPlayerCatalogueStatus("loading");
        setPlayerCatalogueMessage(null);
        try {
          const response = await fetch("/api/player-catalogue", {
            cache: "no-store",
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });
          if (!response.ok)
            throw new Error("The player catalogue is unavailable.");
          const loadedPlayers = parsePlayerCataloguePayload(
            await response.json(),
            requestSeasonSlug,
          );
          if (
            controller.signal.aborted ||
            activeSeasonSlugRef.current !== requestSeasonSlug
          ) {
            return;
          }
          const loadedPlayerIds = new Set(
            loadedPlayers.map((player) => player.id),
          );
          const currentPicks = spotlightPicksRef.current;
          const stalePlayerCategories = Object.entries(currentPicks).flatMap(
            ([category, pick]) =>
              pick?.kind === "player" && !loadedPlayerIds.has(pick.playerId)
                ? [category as keyof SpotlightPicksDraft]
                : [],
          );
          if (stalePlayerCategories.length > 0) {
            const nextPicks = { ...currentPicks };
            for (const category of stalePlayerCategories) {
              const currentPick = currentPicks[category];
              if (
                currentPick?.kind === "player" &&
                !loadedPlayerIds.has(currentPick.playerId)
              ) {
                delete nextPicks[category];
              }
            }
            spotlightPicksRef.current = nextPicks;
            setSpotlightPicks(nextPicks);
            commitDraftSnapshot({
              orderedTeamIds,
              participantName,
              spotlightPicks: nextPicks,
              stage,
            });
          }
          setCataloguePlayers(loadedPlayers);
          setPlayerCatalogueStatus("ready");
          if (stalePlayerCategories.length > 0) {
            setPlayerCatalogueMessage(
              `${stalePlayerCategories.length} saved player ${
                stalePlayerCategories.length === 1
                  ? "selection is"
                  : "selections are"
              } no longer in this season’s catalogue. Choose again or use Other player.`,
            );
          }
        } catch {
          if (
            controller.signal.aborted ||
            activeSeasonSlugRef.current !== requestSeasonSlug
          ) {
            return;
          }
          setPlayerCatalogueStatus("error");
          setPlayerCatalogueMessage(
            "The player catalogue could not be loaded. Retry, or use Other player in each player category.",
          );
        } finally {
          if (playerCatalogueAbortRef.current === controller) {
            playerCatalogueAbortRef.current = null;
          }
        }
      })();

      playerCatalogueRequestRef.current = request;
      try {
        await request;
      } finally {
        playerCatalogueRequestRef.current = null;
      }
    },
    [
      playerCatalogueStatus,
      orderedTeamIds,
      participantName,
      commitDraftSnapshot,
      resolvedSeasonSlug,
      setCataloguePlayers,
      setPlayerCatalogueMessage,
      setPlayerCatalogueStatus,
      stage,
    ],
  );

  useEffect(() => {
    if (draftReady && stage === "spotlight") {
      void loadPlayerCatalogue();
    }
  }, [draftReady, loadPlayerCatalogue, stage]);

  useEffect(
    () => () => {
      playerCatalogueAbortRef.current?.abort();
    },
    [],
  );

  function setPendingState(nextPending: boolean) {
    pendingRef.current = nextPending;
    setPending(nextPending);
    onPendingChange?.(nextPending);
  }

  const handleOrderChange = useCallback(
    (nextTeams: PredictionTeam[]) => {
      const nextOrderedTeamIds = nextTeams.map((team) => team.id);
      setOrderedTeamIds(nextOrderedTeamIds);
      setAlphabeticalWarningOpen(false);
      setError(null);
    },
    [setAlphabeticalWarningOpen, setError, setOrderedTeamIds],
  );

  const handleSpotlightPicksChange = useCallback(
    (update: (currentPicks: SpotlightPicksDraft) => SpotlightPicksDraft) => {
      const nextPicks = update(spotlightPicksRef.current);
      spotlightPicksRef.current = nextPicks;
      setSpotlightPicks(nextPicks);
      setError(null);
    },
    [setError, setSpotlightPicks],
  );

  function continueToSpotlight() {
    if (disabled) {
      setAlphabeticalWarningOpen(false);
      setError(disabledReason);
      return;
    }
    setParticipantName(normalizedName);
    setAlphabeticalWarningOpen(false);
    setStage("spotlight");
    commitDraftSnapshot({
      orderedTeamIds,
      participantName: normalizedName,
      spotlightPicks,
      stage: "spotlight",
    });
    window.requestAnimationFrame(() => {
      const heading = document.getElementById("spotlight-picks-heading");
      heading?.focus();
      heading?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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

    if (isAlphabetical && !alphabeticalOrderAcknowledged) {
      setAlphabeticalWarningOpen(true);
      return;
    }

    continueToSpotlight();
  }

  function handleFinalReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (disabled) {
      setError(disabledReason);
      return;
    }

    setSpotlightValidationAttempted(true);

    if (!spotlightComplete) {
      setError(null);
      window.requestAnimationFrame(() => {
        const summary = document.querySelector<HTMLElement>(
          '[data-spotlight-validation-summary="true"]',
        );
        summary?.focus();
        summary?.scrollIntoView({ behavior: "smooth", block: "center" });
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

    try {
      window.localStorage.removeItem(storageKey);
      lastPersistedDraftContentRef.current = null;
      setPersistedDraftContent(null);
    } catch {
      // Submission succeeded on the server; local cleanup must not mask success.
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
          <span className="bg-mint text-mint-ink grid size-16 place-items-center rounded-2xl">
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
      className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-5"
      noValidate
    >
      {stage === "table" ? (
        <>
          <div className="text-rose-ink flex items-center gap-2 text-xs font-black tracking-[0.12em] uppercase">
            <span className="bg-brand text-accent grid size-7 place-items-center rounded-lg">
              1
            </span>
            Step 1 of 3 · Your table
          </div>
          <Card className="overflow-visible" id="submit-prediction">
            <CardContent className="grid gap-4">
              <div className="flex items-start gap-3">
                <span className="bg-sky-soft text-brand grid size-10 shrink-0 place-items-center rounded-xl">
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
                    const nextParticipantName = event.target.value;
                    setParticipantName(nextParticipantName);
                    setError(null);
                  }}
                  autoComplete="name"
                  autoCapitalize="words"
                  enterKeyHint="done"
                  minLength={2}
                  maxLength={40}
                  required
                  disabled={!draftReady || disabled || pending}
                  aria-describedby="participant-name-help"
                  className="border-border text-brand-strong focus:border-accent-lilac focus:ring-sky-soft mt-2 min-h-12 w-full rounded-xl border bg-white px-3.5 text-base outline-none placeholder:text-slate-400 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
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

          {isAlphabetical ? (
            <aside
              aria-labelledby="alphabetical-blank-slate-heading"
              className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950"
            >
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-amber-800"
              />
              <div>
                <h2
                  id="alphabetical-blank-slate-heading"
                  className="text-sm font-black"
                >
                  The table starts A–Z as a blank slate
                </h2>
                <p className="mt-1 text-sm leading-5 text-amber-900">
                  This is not last season’s table or a suggested prediction.
                  Reorder the clubs, or confirm the A–Z order when you continue
                  if it is really your prediction.
                </p>
              </div>
            </aside>
          ) : null}

          <PredictionSorter
            teams={orderedTeams}
            onChange={handleOrderChange}
            onReset={() => setAlphabeticalOrderAcknowledged(false)}
            disabled={!draftReady || disabled || pending}
          />
        </>
      ) : (
        <>
          {playerCatalogueStatus === "loading" ? (
            <p
              className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-bold text-sky-900"
              role="status"
            >
              Loading this season’s player catalogue… Other player remains
              available while it loads.
            </p>
          ) : null}
          {playerCatalogueMessage ? (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900"
              role="alert"
            >
              <span>{playerCatalogueMessage}</span>
              {playerCatalogueStatus === "error" ? (
                <Button
                  onClick={() => void loadPlayerCatalogue(true)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Retry player catalogue
                </Button>
              ) : null}
            </div>
          ) : null}
          <SpotlightPredictionsForm
            disabled={disabled || pending}
            invalidCategory={
              spotlightValidationAttempted
                ? (incompleteSpotlightCategories[0] ?? null)
                : null
            }
            invalidCount={
              spotlightValidationAttempted
                ? incompleteSpotlightCategories.length
                : 0
            }
            onChange={handleSpotlightPicksChange}
            onSelectorExpandedChange={(category, expanded) =>
              setExpandedSelectorCategory((current) =>
                expanded ? category : current === category ? null : current,
              )
            }
            picks={spotlightPicks}
            players={cataloguePlayers}
            teams={orderedTeams}
          />
        </>
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

      <div
        className={`border-border/80 sticky bottom-0 z-20 -mx-2 border-t bg-white/95 px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-16px_30px_-26px_rgba(55,0,60,0.6)] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none ${
          stage === "spotlight" && expandedSelectorCategory ? "hidden" : ""
        }`}
      >
        <div
          className={
            stage === "spotlight"
              ? "grid grid-cols-[auto_minmax(0,1fr)] gap-2 sm:grid-cols-2"
              : ""
          }
        >
          {stage === "spotlight" ? (
            <Button
              type="button"
              variant="secondary"
              size="md"
              aria-label="Back to table"
              className="px-3 sm:min-h-12 sm:px-5 sm:text-base"
              onClick={() => {
                setStage("table");
                commitDraftSnapshot({
                  orderedTeamIds,
                  participantName,
                  spotlightPicks,
                  stage: "table",
                });
                setError(null);
                window.requestAnimationFrame(() =>
                  document
                    .getElementById("participant-name")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                );
              }}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">Back to table</span>
              <span className="sm:hidden">Back</span>
            </Button>
          ) : null}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={stage === "table" ? !canContinue : pending || disabled}
            aria-describedby="review-button-help"
          >
            {stage === "table"
              ? "Continue to spotlight picks"
              : "Review all predictions"}
          </Button>
        </div>
        <p
          id="review-button-help"
          aria-live="polite"
          className="mt-1 truncate text-center text-xs leading-5 text-slate-500"
        >
          {stage === "table"
            ? draftStatusMessage
            : `${Object.keys(spotlightPicks).length} of 7 spotlight categories started. ${draftStatusMessage}`}
        </p>
      </div>

      <AlphabeticalOrderDialog
        onConfirm={() => {
          setAlphabeticalOrderAcknowledged(true);
          continueToSpotlight();
        }}
        onOpenChange={setAlphabeticalWarningOpen}
        open={alphabeticalWarningOpen}
      />

      <ReviewDialog
        confirmDisabled={!canSubmit}
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
