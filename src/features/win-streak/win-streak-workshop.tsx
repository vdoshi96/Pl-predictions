"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  CalendarDays,
  Check,
  CircleAlert,
  Flame,
  HardDrive,
  History,
  LockKeyhole,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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

import {
  WIN_STREAK_WORKSHOP_SOURCE,
  getWinStreakTeam,
  type WinStreakTeamSlug,
  type WinStreakWorkshopFixture,
  type WinStreakWorkshopRound,
} from "./fixtures";
import {
  WIN_STREAK_WORKSHOP_STORAGE_KEY,
  WinStreakWorkshopError,
  activateWinStreakProfile,
  clearWinStreakWorkshopState,
  createEmptyWinStreakWorkshopState,
  deriveWinStreakProfile,
  getCurrentWinStreakRound,
  getRequiredWinStreakResultFixtures,
  getWinStreakClubAvailability,
  loadWinStreakWorkshopState,
  rankWinStreakProfiles,
  recordWinStreakPick,
  resolveWinStreakRound,
  saveWinStreakWorkshopState,
  type WinStreakFixtureResult,
  type WinStreakHistoryEntry,
  type WinStreakLeaderboardEntry,
  type WinStreakWorkshopState,
} from "./workshop-state";

const resultOptions = [
  { label: "Home win", value: "home" },
  { label: "Draw", value: "draw" },
  { label: "Away win", value: "away" },
  { label: "Void", value: "void" },
] as const satisfies readonly {
  label: string;
  value: WinStreakFixtureResult;
}[];

const outcomeLabels: Record<WinStreakHistoryEntry["outcome"], string> = {
  pending: "Pick open",
  win: "Win",
  draw: "Draw · streak reset",
  loss: "Loss · streak reset",
  missed: "Missed · streak held",
  void: "Void · streak held",
};

const outcomeVariants: Record<
  WinStreakHistoryEntry["outcome"],
  "neutral" | "accent" | "success" | "warning" | "danger"
> = {
  pending: "accent",
  win: "success",
  draw: "warning",
  loss: "danger",
  missed: "neutral",
  void: "neutral",
};

function formatRoundDate(dateIso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateIso}T12:00:00.000Z`));
}

function readableError(error: unknown): string {
  if (error instanceof WinStreakWorkshopError) return error.message;
  return "The workshop could not save that change. Please try again.";
}

function WorkshopHero({
  currentRound,
}: {
  currentRound: WinStreakWorkshopRound | null;
}) {
  return (
    <section className="brand-hero rounded-3xl p-5 text-white sm:p-8">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="bg-accent text-accent-ink ring-accent">
          Local workshop
        </Badge>
        <Badge className="bg-white/10 text-white ring-white/20">
          <HardDrive aria-hidden="true" className="mr-1 size-3.5" />
          This browser only
        </Badge>
        <Badge className="bg-white/10 text-white ring-white/20">
          {currentRound
            ? `Matchweek ${currentRound.matchweek}`
            : "Workshop complete"}
        </Badge>
      </div>
      <div className="mt-5 flex items-start gap-3">
        <Flame
          aria-hidden="true"
          className="text-accent-blue mt-1 size-7 shrink-0"
        />
        <div className="min-w-0">
          <h1 className="text-3xl font-black tracking-tight text-balance sm:text-4xl">
            Win Streak
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
            Pick one club to win each matchweek. A win extends your streak; a
            draw or loss resets it. Winning clubs stay unavailable until the
            streak breaks.
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/15 pt-4 text-xs leading-5 font-semibold text-white/70">
        <span>4 shared matchweeks</span>
        <span>Static official fixture snapshot</span>
        <span>No login or database</span>
      </div>
    </section>
  );
}

function NameGate({
  complete,
  profileCount,
  onActivate,
}: {
  complete: boolean;
  profileCount: number;
  onActivate: (displayName: string) => string | null;
}) {
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(onActivate(displayName));
  }

  return (
    <Card className="panel-shadow overflow-hidden">
      <CardContent className="grid gap-5">
        <div className="flex items-start gap-3">
          <span className="bg-sky-soft text-brand-ink grid size-11 shrink-0 place-items-center rounded-xl">
            <ShieldCheck aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-brand-ink-strong text-xl font-black tracking-tight">
              {profileCount > 0
                ? "Create or resume a profile"
                : "Choose a display name"}
            </h2>
            <p className="text-muted mt-1 text-sm leading-6">
              {complete
                ? "The four rounds are complete. Enter an existing local name to see its final streak."
                : "This unlocks the fixtures. Names create or resume profiles in this browser; no account is created."}
            </p>
          </div>
        </div>

        <form className="grid gap-4" noValidate onSubmit={handleSubmit}>
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
              enterKeyHint="done"
              maxLength={40}
              minLength={2}
              name="displayName"
              onChange={(event) => {
                setDisplayName(event.target.value);
                setError(null);
              }}
              placeholder="e.g. Vishal"
              required
              type="text"
              value={displayName}
              aria-describedby="win-streak-display-name-help"
              aria-invalid={Boolean(error)}
            />
            <p
              id="win-streak-display-name-help"
              className="text-muted mt-1.5 text-xs leading-5"
            >
              2–40 characters. Use the name you want on the local leaderboard.
            </p>
          </div>
          {error ? (
            <p
              className="border-danger/35 bg-danger-soft text-danger rounded-xl border p-3 text-sm leading-5 font-medium"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <Button className="w-full" size="lg" type="submit">
            Create or resume profile
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function StreakSummary({
  profile,
  onSwitch,
}: {
  profile: ReturnType<typeof deriveWinStreakProfile>;
  onSwitch: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Flame aria-hidden="true" className="text-accent-pink size-5" />
            <h2 className="text-brand-ink-strong min-w-0 text-xl font-black tracking-tight break-words">
              {profile.displayName}&apos;s streak
            </h2>
          </div>
          <p className="text-muted mt-1 text-sm leading-5">
            {profile.usedTeamSlugs.length === 0
              ? "All clubs are currently available."
              : `${profile.usedTeamSlugs.length} winning ${profile.usedTeamSlugs.length === 1 ? "club is" : "clubs are"} unavailable while this streak continues.`}
          </p>
        </div>
        <Button variant="secondary" onClick={onSwitch}>
          <Users aria-hidden="true" className="size-4" />
          Switch profile
        </Button>
      </CardContent>
      <div className="border-border grid grid-cols-2 border-t">
        <div className="border-border border-r p-4 sm:px-6">
          <span className="text-muted block text-xs font-bold tracking-wide uppercase">
            Current
          </span>
          <strong className="text-brand-ink-strong mt-1 block text-2xl font-black tabular-nums">
            {profile.currentStreak}
          </strong>
          <span className="sr-only">
            Current streak {profile.currentStreak}
          </span>
        </div>
        <div className="p-4 sm:px-6">
          <span className="text-muted block text-xs font-bold tracking-wide uppercase">
            Personal best
          </span>
          <strong className="text-brand-ink-strong mt-1 block text-2xl font-black tabular-nums">
            {profile.bestStreak}
          </strong>
          <span className="sr-only">Best streak {profile.bestStreak}</span>
        </div>
      </div>
    </Card>
  );
}

function TeamChoice({
  available,
  checked,
  id,
  side,
  teamSlug,
  onChange,
}: {
  available: boolean;
  checked: boolean;
  id: string;
  side: "Home" | "Away";
  teamSlug: WinStreakTeamSlug;
  onChange: (teamSlug: WinStreakTeamSlug) => void;
}) {
  const team = getWinStreakTeam(teamSlug);
  const reasonId = `${id}-reason`;

  return (
    <label
      className={cn(
        "border-border bg-surface focus-within:ring-accent-blue relative flex min-h-16 min-w-0 cursor-pointer items-center gap-2 rounded-xl border p-2.5 transition-colors focus-within:ring-2",
        checked && "border-accent-lilac bg-brand-soft",
        !available && "bg-surface-subtle cursor-not-allowed opacity-65",
      )}
    >
      <input
        type="radio"
        className="accent-brand size-4 shrink-0"
        name="win-streak-team"
        value={teamSlug}
        checked={checked}
        disabled={!available}
        aria-describedby={!available ? reasonId : undefined}
        onChange={() => onChange(teamSlug)}
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

function FixturePicker({
  round,
  state,
  profileId,
  selectedTeamSlug,
  onSelect,
  onReview,
}: {
  round: WinStreakWorkshopRound;
  state: WinStreakWorkshopState;
  profileId: string;
  selectedTeamSlug: WinStreakTeamSlug | null;
  onSelect: (teamSlug: WinStreakTeamSlug) => void;
  onReview: () => void;
}) {
  const availability = getWinStreakClubAvailability(state, profileId, round.id);
  const availabilityBySlug = new Map(
    availability.map((item) => [item.team.slug, item.available] as const),
  );

  return (
    <Card
      className="overflow-hidden"
      role="region"
      aria-label="Choose one club to win"
    >
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge variant="accent">Pick open</Badge>
            <h2 className="text-brand-ink-strong mt-2 text-xl font-black tracking-tight">
              Matchweek {round.matchweek}
            </h2>
            <p className="text-muted mt-1 text-sm leading-5">
              {formatRoundDate(round.dateIso)} · choose one club to win
            </p>
          </div>
          <Badge>
            {availability.filter((item) => item.available).length} clubs
            available
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <fieldset>
          <legend className="sr-only">
            Choose one club to win Matchweek {round.matchweek}
          </legend>
          <div className="grid gap-2">
            {round.fixtures.map((fixture) => (
              <div
                key={fixture.id}
                className="border-border bg-surface-lilac grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 rounded-2xl border p-1.5 sm:gap-3 sm:p-2"
              >
                <TeamChoice
                  available={
                    availabilityBySlug.get(fixture.homeTeamSlug) ?? false
                  }
                  checked={selectedTeamSlug === fixture.homeTeamSlug}
                  id={`${fixture.id}-home`}
                  side="Home"
                  teamSlug={fixture.homeTeamSlug}
                  onChange={onSelect}
                />
                <span className="text-muted px-0.5 text-[0.65rem] font-black uppercase">
                  v
                </span>
                <TeamChoice
                  available={
                    availabilityBySlug.get(fixture.awayTeamSlug) ?? false
                  }
                  checked={selectedTeamSlug === fixture.awayTeamSlug}
                  id={`${fixture.id}-away`}
                  side="Away"
                  teamSlug={fixture.awayTeamSlug}
                  onChange={onSelect}
                />
              </div>
            ))}
          </div>
        </fieldset>
      </CardContent>
      <CardFooter className="bg-surface/95 sticky bottom-0 z-10 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:static">
        <Button
          className="w-full"
          size="lg"
          disabled={!selectedTeamSlug}
          onClick={onReview}
        >
          Review pick
        </Button>
      </CardFooter>
    </Card>
  );
}

function LockedPick({
  round,
  teamSlug,
}: {
  round: WinStreakWorkshopRound;
  teamSlug: WinStreakTeamSlug;
}) {
  const team = getWinStreakTeam(teamSlug);
  const fixture = round.fixtures.find(
    (candidate) =>
      candidate.homeTeamSlug === teamSlug ||
      candidate.awayTeamSlug === teamSlug,
  )!;
  const opponent = getWinStreakTeam(
    fixture.homeTeamSlug === teamSlug
      ? fixture.awayTeamSlug
      : fixture.homeTeamSlug,
  );

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-start gap-3">
        <span className="bg-mint text-mint-ink grid size-11 shrink-0 place-items-center rounded-xl">
          <LockKeyhole aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 grow">
          <Badge variant="success">Immutable pick</Badge>
          <h2 className="text-brand-ink-strong mt-2 text-xl font-black tracking-tight">
            Pick locked: {team.displayName}
          </h2>
          <p className="text-muted mt-1 text-sm leading-6">
            Matchweek {round.matchweek} ·{" "}
            {fixture.homeTeamSlug === teamSlug ? "Home" : "Away"} to{" "}
            {opponent.displayName}. This pick cannot be changed.
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
  open,
  round,
  teamSlug,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  round: WinStreakWorkshopRound;
  teamSlug: WinStreakTeamSlug | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  if (!teamSlug) return null;
  const team = getWinStreakTeam(teamSlug);
  const fixture = round.fixtures.find(
    (candidate) =>
      candidate.homeTeamSlug === teamSlug ||
      candidate.awayTeamSlug === teamSlug,
  )!;
  const pickedHome = fixture.homeTeamSlug === teamSlug;
  const opponent = getWinStreakTeam(
    pickedHome ? fixture.awayTeamSlug : fixture.homeTeamSlug,
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-brand-strong/75 fixed inset-0 z-50 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby="win-streak-review-description"
          className="border-border bg-surface text-foreground fixed inset-x-2 top-1/2 z-50 max-h-[calc(100dvh-1rem)] -translate-y-1/2 overflow-y-auto rounded-2xl border p-4 shadow-2xl outline-none sm:left-1/2 sm:w-[min(30rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:p-6"
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
                {round.matchweek}
                pick is immutable.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close pick review"
                className="-mt-2 -mr-2 size-11"
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
                {pickedHome ? "Home" : "Away"} vs {opponent.displayName} ·{" "}
                {formatRoundDate(round.dateIso)}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Dialog.Close asChild>
              <Button variant="secondary" size="lg">
                Go back
              </Button>
            </Dialog.Close>
            <Button size="lg" onClick={onConfirm}>
              Confirm {team.displayName}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function WorkshopControls({
  round,
  state,
  onResolve,
}: {
  round: WinStreakWorkshopRound;
  state: WinStreakWorkshopState;
  onResolve: (results: Record<string, WinStreakFixtureResult>) => void;
}) {
  const fixtures = getRequiredWinStreakResultFixtures(state, round.id);
  const [results, setResults] = useState<
    Record<string, WinStreakFixtureResult>
  >({});

  const allReady =
    fixtures.length === 0 ||
    fixtures.every((fixture) => Boolean(results[fixture.id]));

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="bg-brand-soft text-brand-ink grid size-11 shrink-0 place-items-center rounded-xl">
            <Settings2 aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="text-brand-ink-strong text-xl font-black tracking-tight">
              Workshop controls
            </h2>
            <p className="text-muted mt-1 text-sm leading-6">
              Resolve each fixture with a locked pick once, then advance every
              local profile together.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {fixtures.length === 0 ? (
          <div className="border-border bg-surface-lilac rounded-xl border p-4">
            <p className="text-brand-ink-strong text-sm font-bold">
              No locked picks yet
            </p>
            <p className="text-muted mt-1 text-sm leading-5">
              Advancing now records a missed round for profiles that already
              joined. Their streaks and club restrictions stay unchanged.
            </p>
          </div>
        ) : (
          fixtures.map((fixture) => (
            <ResultFixture
              key={fixture.id}
              fixture={fixture}
              value={results[fixture.id] ?? null}
              onChange={(value) =>
                setResults((current) => ({
                  ...current,
                  [fixture.id]: value,
                }))
              }
            />
          ))
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          size="lg"
          disabled={!allReady}
          onClick={() => onResolve(results)}
        >
          {fixtures.length === 0
            ? "Advance without picks"
            : "Apply results and advance"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function ResultFixture({
  fixture,
  value,
  onChange,
}: {
  fixture: WinStreakWorkshopFixture;
  value: WinStreakFixtureResult | null;
  onChange: (value: WinStreakFixtureResult) => void;
}) {
  const home = getWinStreakTeam(fixture.homeTeamSlug);
  const away = getWinStreakTeam(fixture.awayTeamSlug);
  const name = `${home.displayName} v ${away.displayName}`;

  return (
    <fieldset
      className="border-border bg-surface-lilac min-w-0 rounded-2xl border p-3"
      aria-label={name}
    >
      <legend className="px-1 text-sm font-black">
        <span className="flex min-w-0 items-center gap-2">
          <TeamMark
            decorative
            name={home.displayName}
            initials={home.shortName}
            src={home.assetPath}
            size="sm"
          />
          <span className="min-w-0 break-words">{name}</span>
          <TeamMark
            decorative
            name={away.displayName}
            initials={away.shortName}
            src={away.assetPath}
            size="sm"
          />
        </span>
      </legend>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {resultOptions.map((option) => (
          <label
            key={option.value}
            className={cn(
              "border-border bg-surface focus-within:ring-accent-blue flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-2.5 text-xs font-bold focus-within:ring-2",
              value === option.value && "border-accent-lilac bg-brand-soft",
            )}
          >
            <input
              className="accent-brand size-4 shrink-0"
              type="radio"
              name={`result-${fixture.id}`}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ProfileHistory({ history }: { history: WinStreakHistoryEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History aria-hidden="true" className="text-accent-pink size-5" />
          <h2 className="text-brand-ink-strong text-xl font-black tracking-tight">
            Your history
          </h2>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-2">
          {history.map((entry) => {
            const team = entry.teamSlug
              ? getWinStreakTeam(entry.teamSlug)
              : null;
            const opponent = entry.opponentTeamSlug
              ? getWinStreakTeam(entry.opponentTeamSlug)
              : null;
            const outcomeLabel =
              entry.outcome === "pending" && team
                ? "Awaiting result"
                : outcomeLabels[entry.outcome];
            return (
              <li
                key={entry.roundId}
                className="border-border bg-surface-lilac flex min-w-0 items-center gap-3 rounded-xl border p-3"
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
                      : entry.outcome === "pending"
                        ? "No pick locked yet"
                        : "No pick"}
                  </strong>
                  <span className="text-muted mt-0.5 block text-xs">
                    Matchweek {entry.matchweek}
                  </span>
                </div>
                <Badge variant={outcomeVariants[entry.outcome]}>
                  {outcomeLabel}
                </Badge>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function WorkshopLeaderboard({
  entries,
}: {
  entries: WinStreakLeaderboardEntry[];
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="bg-mint text-mint-ink grid size-11 shrink-0 place-items-center rounded-xl">
            <Trophy aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="text-brand-ink-strong text-xl font-black tracking-tight">
              Win Streak leaderboard
            </h2>
            <p className="text-muted mt-1 text-sm leading-5">
              Ranked by personal best only. Equal bests share a rank.
            </p>
          </div>
        </div>
      </CardHeader>
      <div className="border-border border-t">
        <table
          className="w-full table-fixed text-left text-sm"
          aria-label="Win Streak leaderboard"
        >
          <thead className="bg-brand-soft text-brand-ink text-[0.65rem] tracking-wide uppercase">
            <tr>
              <th className="w-12 px-3 py-2.5 text-center font-black sm:w-16">
                Rank
              </th>
              <th className="px-2 py-2.5 font-black">Player</th>
              <th className="w-16 px-1 py-2.5 text-center font-black sm:w-20">
                Current
              </th>
              <th className="w-14 px-2 py-2.5 text-center font-black sm:w-20">
                Best
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-border border-t first:border-t-0"
              >
                <td className="px-3 py-3 text-center font-mono font-black tabular-nums">
                  {entry.rank}
                </td>
                <th
                  scope="row"
                  className="text-brand-ink-strong px-2 py-3 leading-5 font-bold [overflow-wrap:anywhere]"
                >
                  {entry.displayName}
                </th>
                <td className="px-1 py-3 text-center font-mono tabular-nums">
                  {entry.currentStreak}
                </td>
                <td className="text-rose-score px-2 py-3 text-center font-mono font-black tabular-nums">
                  {entry.bestStreak}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ResetDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-brand-strong/75 fixed inset-0 z-50 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby="win-streak-reset-description"
          className="border-border bg-surface text-foreground fixed inset-x-2 top-1/2 z-50 -translate-y-1/2 rounded-2xl border p-5 shadow-2xl outline-none sm:left-1/2 sm:w-[min(30rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:p-6"
        >
          <Badge variant="danger">Permanent in this browser</Badge>
          <Dialog.Title className="text-brand-ink-strong mt-2 text-2xl font-black tracking-tight">
            Clear all workshop data?
          </Dialog.Title>
          <Dialog.Description
            id="win-streak-reset-description"
            className="text-muted mt-2 text-sm leading-6"
          >
            This removes every local profile, pick, shared result, and streak.
            It cannot be recovered.
          </Dialog.Description>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Dialog.Close asChild>
              <Button variant="secondary" size="lg">
                Keep data
              </Button>
            </Dialog.Close>
            <Button variant="danger" size="lg" onClick={onConfirm}>
              Clear all workshop data
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SourceNote() {
  return (
    <Card>
      <CardContent className="flex items-start gap-3">
        <CalendarDays
          aria-hidden="true"
          className="text-accent-lilac mt-0.5 size-5 shrink-0"
        />
        <div className="min-w-0">
          <h2 className="text-brand-ink-strong font-black">
            Frozen workshop schedule
          </h2>
          <p className="text-muted mt-1 text-xs leading-5 sm:text-sm">
            Matchweeks 20–23 use a static official fixture snapshot verified
            August 23, 2026. Fixtures are subject to change; this page does not
            fetch live football data.{" "}
            <a
              className="text-brand-ink font-bold underline underline-offset-4"
              href={WIN_STREAK_WORKSHOP_SOURCE.fixtureListUrl}
              target="_blank"
              rel="noreferrer"
            >
              View the official fixture list
            </a>
            .
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function WinStreakWorkshop() {
  const [state, setState] = useState<WinStreakWorkshopState>(() =>
    createEmptyWinStreakWorkshopState(),
  );
  const [hydrated, setHydrated] = useState(false);
  const [showProfileGate, setShowProfileGate] = useState(false);
  const [selectedTeamSlug, setSelectedTeamSlug] =
    useState<WinStreakTeamSlug | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const restored = loadWinStreakWorkshopState(window.localStorage);
    if (restored.status === "invalid" || restored.status === "oversized") {
      try {
        window.localStorage.removeItem(WIN_STREAK_WORKSHOP_STORAGE_KEY);
      } catch {
        // The validated empty state still keeps corrupt data out of the UI.
      }
    }
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setState(restored.state);
      if (restored.status === "invalid" || restored.status === "oversized") {
        setNotice(
          "Stored workshop data was invalid and has been safely ignored.",
        );
      }
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const currentRound = getCurrentWinStreakRound(state);
  const activeProfile = state.activeProfileId
    ? (state.profiles.find((profile) => profile.id === state.activeProfileId) ??
      null)
    : null;
  const profileView = activeProfile
    ? deriveWinStreakProfile(state, activeProfile.id)
    : null;
  const leaderboard = useMemo(() => rankWinStreakProfiles(state), [state]);
  const activePick =
    activeProfile && currentRound
      ? (activeProfile.picks.find((pick) => pick.roundId === currentRound.id) ??
        null)
      : null;

  function commit(
    nextState: WinStreakWorkshopState,
    nextNotice: string,
  ): boolean {
    try {
      saveWinStreakWorkshopState(window.localStorage, nextState);
      setState(nextState);
      setError(null);
      setNotice(nextNotice);
      return true;
    } catch (nextError) {
      setError(readableError(nextError));
      return false;
    }
  }

  function handleActivate(displayName: string): string | null {
    try {
      const activated = activateWinStreakProfile(state, displayName);
      if (
        !commit(
          activated.state,
          activated.created
            ? `${activated.profile.displayName}'s profile is ready.`
            : `${activated.profile.displayName}'s profile was resumed.`,
        )
      ) {
        return "The profile could not be saved in this browser.";
      }
      setSelectedTeamSlug(null);
      setReviewOpen(false);
      setShowProfileGate(false);
      return null;
    } catch (nextError) {
      return readableError(nextError);
    }
  }

  function handleConfirmPick() {
    if (!activeProfile || !currentRound || !selectedTeamSlug) return;
    try {
      const nextState = recordWinStreakPick(
        state,
        activeProfile.id,
        currentRound.id,
        selectedTeamSlug,
      );
      const team = getWinStreakTeam(selectedTeamSlug);
      if (commit(nextState, `Pick locked: ${team.displayName}.`)) {
        setReviewOpen(false);
      }
    } catch (nextError) {
      setError(readableError(nextError));
    }
  }

  function handleResolve(results: Record<string, WinStreakFixtureResult>) {
    if (!currentRound) return;
    const fixtures = getRequiredWinStreakResultFixtures(state, currentRound.id);
    try {
      const nextState = resolveWinStreakRound(
        state,
        currentRound.id,
        fixtures.map((fixture) => ({
          fixtureId: fixture.id,
          result: results[fixture.id]!,
        })),
      );
      const nextRound = getCurrentWinStreakRound(nextState);
      if (
        commit(
          nextState,
          nextRound
            ? `Matchweek ${currentRound.matchweek} resolved. Matchweek ${nextRound.matchweek} is open.`
            : "All four workshop matchweeks are complete.",
        )
      ) {
        setSelectedTeamSlug(null);
        setReviewOpen(false);
      }
    } catch (nextError) {
      setError(readableError(nextError));
    }
  }

  function handleClear() {
    try {
      const nextState = clearWinStreakWorkshopState(window.localStorage);
      setState(nextState);
      setShowProfileGate(false);
      setSelectedTeamSlug(null);
      setResetOpen(false);
      setError(null);
      setNotice("All workshop data was cleared from this browser.");
    } catch {
      setError("The browser did not allow workshop data to be cleared.");
    }
  }

  return (
    <main className="page-shell w-full flex-1 py-6 sm:py-10">
      <div className="mx-auto grid max-w-4xl gap-5 sm:gap-7">
        <WorkshopHero currentRound={currentRound} />

        <p className="sr-only" role="status" aria-live="polite">
          {notice}
        </p>
        {error ? (
          <p
            role="alert"
            className="border-danger/35 bg-danger-soft text-danger flex items-start gap-2 rounded-xl border p-3 text-sm leading-5 font-medium"
          >
            <CircleAlert
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            {error}
          </p>
        ) : null}

        {!hydrated ? (
          <Card>
            <CardContent className="text-muted py-10 text-center text-sm">
              Loading this browser&apos;s workshop…
            </CardContent>
          </Card>
        ) : !activeProfile || showProfileGate ? (
          <NameGate
            complete={!currentRound}
            profileCount={state.profiles.length}
            onActivate={handleActivate}
          />
        ) : profileView ? (
          <>
            <StreakSummary
              profile={profileView}
              onSwitch={() => setShowProfileGate(true)}
            />

            {currentRound ? (
              activePick ? (
                <LockedPick
                  round={currentRound}
                  teamSlug={activePick.teamSlug}
                />
              ) : (
                <FixturePicker
                  round={currentRound}
                  state={state}
                  profileId={activeProfile.id}
                  selectedTeamSlug={selectedTeamSlug}
                  onSelect={setSelectedTeamSlug}
                  onReview={() => setReviewOpen(true)}
                />
              )
            ) : (
              <Card>
                <CardContent className="flex items-start gap-3">
                  <span className="bg-mint text-mint-ink grid size-11 shrink-0 place-items-center rounded-xl">
                    <Check aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <h2 className="text-brand-ink-strong text-xl font-black">
                      Workshop complete
                    </h2>
                    <p className="text-muted mt-1 text-sm leading-6">
                      All four shared matchweeks are resolved. The leaderboard
                      below is final for this browser run.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentRound ? (
              <WorkshopControls
                round={currentRound}
                state={state}
                onResolve={handleResolve}
              />
            ) : null}

            <ProfileHistory history={profileView.history} />
            <WorkshopLeaderboard entries={leaderboard} />

            <Card>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-brand-ink-strong font-black">
                    Local data controls
                  </h2>
                  <p className="text-muted mt-1 text-sm leading-5">
                    Clearing removes every workshop profile and result from this
                    browser.
                  </p>
                </div>
                <Button variant="danger" onClick={() => setResetOpen(true)}>
                  <RotateCcw aria-hidden="true" className="size-4" />
                  Clear all workshop data
                </Button>
              </CardContent>
            </Card>
          </>
        ) : null}

        <SourceNote />
      </div>

      {currentRound ? (
        <PickReviewDialog
          open={reviewOpen}
          round={currentRound}
          teamSlug={selectedTeamSlug}
          onOpenChange={setReviewOpen}
          onConfirm={handleConfirmPick}
        />
      ) : null}
      <ResetDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        onConfirm={handleClear}
      />
    </main>
  );
}
