"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertCircle,
  Check,
  Clock3,
  Flame,
  History,
  LockKeyhole,
  ShieldCheck,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { TeamMark } from "@/components/team-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { formatChicagoUtcDateTime } from "@/shared/format";

import { getWinStreakTeam, type WinStreakTeamSlug } from "./fixtures";
import type {
  WinStreakActionResult,
  WinStreakActiveRoundView,
  WinStreakFixtureView,
  WinStreakHistoryView,
  WinStreakPublicPick,
  WinStreakViewerView,
} from "./view-model";

type CreateProfileAction = (input: {
  displayName: string;
  website: string;
}) => Promise<WinStreakActionResult>;
type SubmitPickAction = (input: {
  teamSlug: WinStreakTeamSlug;
}) => Promise<WinStreakActionResult>;

const OUTCOME_LABELS: Record<WinStreakHistoryView["outcome"], string> = {
  pending: "Awaiting result",
  win: "Win",
  draw: "Draw · reset",
  loss: "Loss · reset",
  missed: "Missed · held",
  void: "Void · held",
};

const OUTCOME_VARIANTS: Record<
  WinStreakHistoryView["outcome"],
  "neutral" | "accent" | "success" | "warning" | "danger"
> = {
  pending: "accent",
  win: "success",
  draw: "warning",
  loss: "danger",
  missed: "neutral",
  void: "neutral",
};

function pickFixture(
  round: WinStreakActiveRoundView,
  teamSlug: WinStreakTeamSlug,
): WinStreakFixtureView | null {
  return (
    round.fixtures.find(
      (fixture) =>
        fixture.homeTeamSlug === teamSlug || fixture.awayTeamSlug === teamSlug,
    ) ?? null
  );
}

function NameGate({
  activeRound,
  onCreate,
}: {
  activeRound: WinStreakActiveRoundView | null;
  onCreate: CreateProfileAction;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const canJoin = activeRound?.pickOpen === true;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await onCreate({ displayName, website: "" });
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="grid gap-5">
        <div className="flex items-start gap-3">
          <span className="bg-sky-soft text-brand-ink grid size-11 shrink-0 place-items-center rounded-xl">
            <ShieldCheck aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-brand-ink-strong text-xl font-black tracking-tight">
              {canJoin
                ? `Join from Matchweek ${activeRound.matchweek}`
                : "Joining is paused"}
            </h3>
            <p className="text-muted mt-1 text-sm leading-6">
              {canJoin
                ? "Choose the public display name you want on the leaderboard. This browser will remember your profile—there is no account or password."
                : activeRound
                  ? "This matchweek is locked. You can join when the next round opens after results are reviewed."
                  : "The contest has finished for this season."}
            </p>
          </div>
        </div>

        {canJoin ? (
          <form className="grid gap-4" onSubmit={submit}>
            <div>
              <label
                htmlFor="win-streak-display-name"
                className="text-foreground text-sm font-bold"
              >
                Display name
              </label>
              <input
                id="win-streak-display-name"
                autoCapitalize="words"
                autoComplete="name"
                className="border-border text-brand-ink-strong focus:border-accent-lilac focus:ring-accent-blue/30 bg-surface placeholder:text-muted mt-2 min-h-12 w-full rounded-xl border px-3.5 text-base outline-none focus:ring-2"
                maxLength={40}
                minLength={2}
                name="displayName"
                onChange={(event) => {
                  setDisplayName(event.target.value);
                  setMessage(null);
                }}
                placeholder="e.g. Vishal"
                required
                type="text"
                value={displayName}
                aria-describedby="win-streak-display-name-help"
              />
              <p
                id="win-streak-display-name-help"
                className="text-muted mt-1.5 text-xs leading-5"
              >
                2–40 characters. An existing name cannot be claimed from a
                different browser.
              </p>
            </div>
            {message ? (
              <p
                className="border-border bg-surface-lilac text-brand-ink rounded-xl border p-3 text-sm leading-5 font-medium"
                role="alert"
              >
                {message}
              </p>
            ) : null}
            <Button
              className="w-full"
              disabled={pending || displayName.trim().length < 2}
              size="lg"
              type="submit"
            >
              {pending ? "Creating profile…" : "Create profile"}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TeamChoice({
  available,
  checked,
  side,
  teamSlug,
  onSelect,
}: {
  available: boolean;
  checked: boolean;
  side: "Home" | "Away";
  teamSlug: WinStreakTeamSlug;
  onSelect: (teamSlug: WinStreakTeamSlug) => void;
}) {
  const team = getWinStreakTeam(teamSlug);
  const reasonId = useId();
  return (
    <label
      className={cn(
        "border-border bg-surface focus-within:ring-accent-blue relative flex min-h-16 min-w-0 cursor-pointer items-center gap-2 rounded-xl border p-2.5 transition-colors focus-within:ring-2",
        checked && "border-accent-lilac bg-brand-soft",
        !available && "bg-surface-subtle cursor-not-allowed opacity-65",
      )}
    >
      <input
        aria-describedby={!available ? reasonId : undefined}
        checked={checked}
        className="accent-brand size-4 shrink-0"
        disabled={!available}
        name="win-streak-team"
        onChange={() => onSelect(teamSlug)}
        type="radio"
        value={teamSlug}
      />
      <TeamMark
        decorative
        name={team.displayName}
        initials={team.shortName}
        src={team.assetPath}
        size="sm"
      />
      <span className="min-w-0 grow">
        <span className="text-muted block text-[0.62rem] leading-3 font-black tracking-wide uppercase">
          {side}
        </span>
        <span className="text-brand-ink-strong mt-0.5 block text-xs leading-4 font-bold break-words sm:text-sm">
          {team.displayName}
        </span>
        {!available ? (
          <span
            id={reasonId}
            className="text-danger mt-0.5 block text-[0.66rem] leading-4 font-semibold"
          >
            Used in this streak
          </span>
        ) : null}
      </span>
    </label>
  );
}

function LockedPick({ pick }: { pick: WinStreakPublicPick }) {
  const team = getWinStreakTeam(pick.teamSlug);
  const opponent = getWinStreakTeam(pick.opponentTeamSlug);
  return (
    <Card className="overflow-hidden" tabIndex={-1}>
      <CardContent className="flex items-start gap-3">
        <span className="bg-mint text-mint-ink grid size-11 shrink-0 place-items-center rounded-xl">
          <LockKeyhole aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 grow">
          <Badge variant="success">Immutable pick</Badge>
          <h3 className="text-brand-ink-strong mt-2 text-xl font-black tracking-tight break-words">
            Pick locked: {team.displayName}
          </h3>
          <p className="text-muted mt-1 text-sm leading-6">
            Matchweek {pick.matchweek} · {pick.isHome ? "Home vs" : "Away at"}{" "}
            {opponent.displayName}. This pick is now public and cannot be
            changed.
          </p>
        </div>
        <TeamMark
          decorative
          name={team.displayName}
          initials={team.shortName}
          src={team.assetPath}
          size="lg"
        />
      </CardContent>
    </Card>
  );
}

function PickReviewDialog({
  error,
  open,
  pending,
  round,
  teamSlug,
  onConfirm,
  onOpenChange,
}: {
  error: string | null;
  open: boolean;
  pending: boolean;
  round: WinStreakActiveRoundView;
  teamSlug: WinStreakTeamSlug | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  if (!teamSlug) return null;
  const fixture = pickFixture(round, teamSlug);
  if (!fixture) return null;
  const pickedHome = fixture.homeTeamSlug === teamSlug;
  const team = getWinStreakTeam(teamSlug);
  const opponent = getWinStreakTeam(
    pickedHome ? fixture.awayTeamSlug : fixture.homeTeamSlug,
  );

  function handleOpenChange(nextOpen: boolean) {
    if (!pending) onOpenChange(nextOpen);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-brand-strong/75 fixed inset-0 z-50 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-busy={pending}
          aria-describedby="win-streak-review-description"
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (pending) event.preventDefault();
          }}
          className="border-border bg-surface text-foreground fixed inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-50 overflow-y-auto rounded-2xl border p-4 shadow-2xl outline-none sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[min(42rem,calc(100dvh-2rem))] sm:w-[min(30rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge variant="accent">Final review</Badge>
              <Dialog.Title className="text-brand-ink-strong mt-2 text-2xl font-black tracking-tight">
                Review your pick
              </Dialog.Title>
              <Dialog.Description
                id="win-streak-review-description"
                className="text-muted mt-1 text-sm leading-6"
              >
                Confirm only when you are ready. Your Matchweek{" "}
                {round.matchweek} pick is immutable and will appear on the
                public leaderboard.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button
                aria-label="Close pick review"
                className="-mt-2 -mr-2 size-11"
                disabled={pending}
                size="icon"
                variant="ghost"
              >
                <X aria-hidden="true" className="size-5" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="border-border bg-surface-lilac mt-5 flex items-center gap-3 rounded-2xl border p-4">
            <TeamMark
              name={team.displayName}
              initials={team.shortName}
              src={team.assetPath}
              size="lg"
            />
            <div className="min-w-0">
              <strong className="text-brand-ink-strong block text-lg font-black break-words">
                {team.displayName}
              </strong>
              <span className="text-muted mt-1 block text-sm leading-5">
                {pickedHome ? "Home vs" : "Away at"} {opponent.displayName} ·{" "}
                {formatChicagoUtcDateTime(fixture.kickoffAt)}
              </span>
            </div>
          </div>
          {error ? (
            <p
              className="border-danger/35 bg-danger-soft text-danger mt-5 flex items-start gap-2 rounded-xl border p-3 text-sm leading-5 font-medium"
              role="alert"
            >
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <span>{error}</span>
            </p>
          ) : null}
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Dialog.Close asChild>
              <Button disabled={pending} size="lg" variant="secondary">
                Go back
              </Button>
            </Dialog.Close>
            <Button disabled={pending} size="lg" onClick={onConfirm}>
              {pending ? "Locking pick…" : `Confirm ${team.displayName}`}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ProfileHistory({
  history,
}: {
  history: readonly WinStreakHistoryView[];
}) {
  if (history.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History aria-hidden="true" className="text-accent-pink size-5" />
          <h3 className="text-brand-ink-strong text-xl font-black tracking-tight">
            Your history
          </h3>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-2">
          {[...history].reverse().map((entry) => {
            const team = entry.teamSlug
              ? getWinStreakTeam(entry.teamSlug)
              : null;
            const opponent = entry.opponentTeamSlug
              ? getWinStreakTeam(entry.opponentTeamSlug)
              : null;
            return (
              <li
                key={entry.matchweek}
                className="border-border bg-surface-lilac flex min-w-0 items-center gap-2 rounded-xl border p-3"
              >
                <span className="bg-brand grid size-9 shrink-0 place-items-center rounded-xl text-xs font-black text-white tabular-nums">
                  {entry.matchweek}
                </span>
                {team ? (
                  <TeamMark
                    decorative
                    name={team.displayName}
                    initials={team.shortName}
                    src={team.assetPath}
                    size="sm"
                  />
                ) : null}
                <div className="min-w-0 grow">
                  <strong className="text-brand-ink-strong block text-sm font-black break-words">
                    {team
                      ? `${team.displayName}${opponent ? ` ${entry.isHome ? "v" : "at"} ${opponent.displayName}` : ""}`
                      : "No pick"}
                  </strong>
                  <span className="text-muted mt-0.5 block text-xs">
                    Matchweek {entry.matchweek}
                  </span>
                </div>
                <Badge variant={OUTCOME_VARIANTS[entry.outcome]}>
                  {OUTCOME_LABELS[entry.outcome]}
                </Badge>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function ProfilePanel({
  activeRound,
  onPick,
  viewer,
}: {
  activeRound: WinStreakActiveRoundView | null;
  onPick: SubmitPickAction;
  viewer: WinStreakViewerView;
}) {
  const router = useRouter();
  const [selectedTeamSlug, setSelectedTeamSlug] =
    useState<WinStreakTeamSlug | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const messageRef = useRef<HTMLParagraphElement>(null);
  const used = useMemo(
    () => new Set(viewer.usedWinningTeamSlugs),
    [viewer.usedWinningTeamSlugs],
  );

  useEffect(() => {
    if (message && !reviewOpen) messageRef.current?.focus();
  }, [message, reviewOpen]);

  function confirmPick() {
    if (!selectedTeamSlug) return;
    setMessage(null);
    startTransition(async () => {
      const result = await onPick({ teamSlug: selectedTeamSlug });
      setMessage(result.message);
      if (result.ok) {
        setReviewOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-5">
      <Card className="overflow-hidden">
        <CardContent className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Flame aria-hidden="true" className="text-accent-pink size-5" />
              <h3 className="text-brand-ink-strong min-w-0 text-xl font-black tracking-tight break-words">
                {viewer.displayName}&apos;s streak
              </h3>
            </div>
            <p className="text-muted mt-1 text-sm leading-5">
              {used.size === 0
                ? "All clubs are available."
                : `${used.size} winning ${used.size === 1 ? "club is" : "clubs are"} unavailable until this streak resets.`}
            </p>
          </div>
          <Badge variant="accent">This browser</Badge>
        </CardContent>
        <div className="border-border grid grid-cols-2 border-t">
          <div className="border-border border-r p-4 sm:px-6">
            <span className="text-muted block text-xs font-bold tracking-wide uppercase">
              Current
            </span>
            <strong className="text-brand-ink-strong mt-1 block text-2xl font-black tabular-nums">
              {viewer.currentStreak}
            </strong>
          </div>
          <div className="p-4 sm:px-6">
            <span className="text-muted block text-xs font-bold tracking-wide uppercase">
              Personal best
            </span>
            <strong className="text-brand-ink-strong mt-1 block text-2xl font-black tabular-nums">
              {viewer.bestStreak}
            </strong>
          </div>
        </div>
      </Card>

      {message ? (
        <p
          className="border-border bg-surface-lilac text-brand-ink rounded-xl border p-3 text-sm leading-5 font-medium"
          role="status"
          aria-live="polite"
          ref={messageRef}
          tabIndex={-1}
        >
          {message}
        </p>
      ) : null}

      {viewer.currentPick ? (
        <LockedPick pick={viewer.currentPick} />
      ) : activeRound?.pickOpen ? (
        <Card aria-label="Choose one club to win">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Badge variant="accent">Pick open</Badge>
                <h3 className="text-brand-ink-strong mt-2 text-xl font-black tracking-tight">
                  Matchweek {activeRound.matchweek}
                </h3>
                <p className="text-muted mt-1 text-sm leading-5">
                  Locks {formatChicagoUtcDateTime(activeRound.deadlineAt)}
                </p>
              </div>
              <Badge>{20 - used.size} clubs available</Badge>
            </div>
          </CardHeader>
          <CardContent className="pb-2">
            <fieldset>
              <legend className="sr-only">
                Choose one club to win Matchweek {activeRound.matchweek}
              </legend>
              <div className="grid gap-2">
                {activeRound.fixtures.map((fixture) => (
                  <div
                    key={`${fixture.homeTeamSlug}:${fixture.awayTeamSlug}`}
                    className="border-border bg-surface-lilac grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 rounded-2xl border p-1.5 sm:gap-3 sm:p-2"
                  >
                    <TeamChoice
                      available={!used.has(fixture.homeTeamSlug)}
                      checked={selectedTeamSlug === fixture.homeTeamSlug}
                      side="Home"
                      teamSlug={fixture.homeTeamSlug}
                      onSelect={(teamSlug) => {
                        setSelectedTeamSlug(teamSlug);
                        setMessage(null);
                      }}
                    />
                    <span className="text-muted px-0.5 text-center text-[0.62rem] leading-4 font-black uppercase">
                      <span className="block">v</span>
                      <span className="hidden max-w-28 normal-case lg:block">
                        {formatChicagoUtcDateTime(fixture.kickoffAt)}
                      </span>
                    </span>
                    <TeamChoice
                      available={!used.has(fixture.awayTeamSlug)}
                      checked={selectedTeamSlug === fixture.awayTeamSlug}
                      side="Away"
                      teamSlug={fixture.awayTeamSlug}
                      onSelect={(teamSlug) => {
                        setSelectedTeamSlug(teamSlug);
                        setMessage(null);
                      }}
                    />
                  </div>
                ))}
              </div>
            </fieldset>
          </CardContent>
          <CardFooter className="bg-surface/95 sticky bottom-0 z-10 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:static">
            <Button
              className="w-full"
              disabled={!selectedTeamSlug}
              size="lg"
              onClick={() => {
                setMessage(null);
                setReviewOpen(true);
              }}
            >
              Review pick
            </Button>
          </CardFooter>
        </Card>
      ) : activeRound ? (
        <Card>
          <CardContent className="flex items-start gap-3">
            <Clock3
              aria-hidden="true"
              className="text-accent-lilac mt-0.5 size-5 shrink-0"
            />
            <div>
              <h3 className="text-brand-ink-strong font-black">
                Matchweek {activeRound.matchweek} is locked
              </h3>
              <p className="text-muted mt-1 text-sm leading-6">
                You missed this round. Your streak and club restrictions stay
                unchanged while results are reviewed.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex items-start gap-3">
            <Check aria-hidden="true" className="text-accent size-5" />
            <div>
              <h3 className="text-brand-ink-strong font-black">
                Season complete
              </h3>
              <p className="text-muted mt-1 text-sm">
                Your best streak remains on the leaderboard.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <ProfileHistory history={viewer.history} />

      {activeRound ? (
        <PickReviewDialog
          error={message}
          open={reviewOpen}
          pending={pending}
          round={activeRound}
          teamSlug={selectedTeamSlug}
          onConfirm={confirmPick}
          onOpenChange={setReviewOpen}
        />
      ) : null}
    </div>
  );
}

export function WinStreakEntryPanel({
  activeRound,
  createProfileAction,
  submitPickAction,
  viewer,
}: {
  activeRound: WinStreakActiveRoundView | null;
  createProfileAction: CreateProfileAction;
  submitPickAction: SubmitPickAction;
  viewer: WinStreakViewerView | null;
}) {
  return (
    <section aria-label="Your Win Streak" className="min-w-0">
      <div className="mb-3 flex items-center gap-2 px-1">
        <Flame aria-hidden="true" className="text-accent-pink size-5" />
        <h2 className="text-brand-ink-strong text-lg font-black tracking-tight">
          Your Win Streak
        </h2>
      </div>
      {viewer ? (
        <ProfilePanel
          activeRound={activeRound}
          onPick={submitPickAction}
          viewer={viewer}
        />
      ) : (
        <NameGate activeRound={activeRound} onCreate={createProfileAction} />
      )}
    </section>
  );
}
