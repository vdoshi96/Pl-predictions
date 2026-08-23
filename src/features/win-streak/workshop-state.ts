import { z } from "zod";

import { PREMIER_LEAGUE_2026_27_TEAMS, type TeamSeed } from "@/data/teams";
import { normalizedParticipantNameKey } from "@/features/predictions/normalization";
import { participantNameSchema } from "@/features/predictions/validation";

import {
  WIN_STREAK_WORKSHOP_ROUNDS,
  WIN_STREAK_WORKSHOP_ROUND_IDS,
  getWinStreakFixture,
  getWinStreakFixtureForTeam,
  type WinStreakFixtureId,
  type WinStreakRoundId,
  type WinStreakTeamSlug,
  type WinStreakWorkshopFixture,
  type WinStreakWorkshopRound,
} from "./fixtures";

export const WIN_STREAK_WORKSHOP_STORAGE_VERSION = 1 as const;
export const WIN_STREAK_WORKSHOP_STORAGE_KEY =
  "dranx-win-streak-workshop:2026-27:v1";
export const WIN_STREAK_WORKSHOP_MAX_STORAGE_BYTES = 128 * 1024;
export const WIN_STREAK_WORKSHOP_MAX_PROFILES = 50;

export type WinStreakFixtureResult = "home" | "draw" | "away" | "void";

export type WinStreakFixtureResultInput = {
  fixtureId: WinStreakFixtureId;
  result: WinStreakFixtureResult;
};

export type WinStreakWorkshopPick = {
  pickedAtIso: string;
  roundId: WinStreakRoundId;
  teamSlug: WinStreakTeamSlug;
};

export type WinStreakWorkshopProfile = {
  createdAtIso: string;
  displayName: string;
  id: string;
  joinedRoundId: WinStreakRoundId;
  picks: WinStreakWorkshopPick[];
};

export type WinStreakWorkshopRoundResult = {
  fixtures: WinStreakFixtureResultInput[];
  resolvedAtIso: string;
  roundId: WinStreakRoundId;
};

export type WinStreakWorkshopState = {
  activeProfileId: string | null;
  profiles: WinStreakWorkshopProfile[];
  results: WinStreakWorkshopRoundResult[];
  version: typeof WIN_STREAK_WORKSHOP_STORAGE_VERSION;
};

export type WinStreakPickOutcome =
  "pending" | "win" | "draw" | "loss" | "missed" | "void";

export type WinStreakHistoryEntry = {
  fixtureId: WinStreakFixtureId | null;
  isHome: boolean | null;
  matchweek: number;
  opponentTeamSlug: WinStreakTeamSlug | null;
  outcome: WinStreakPickOutcome;
  pickedAtIso: string | null;
  result: WinStreakFixtureResult | null;
  roundDateIso: string;
  roundId: WinStreakRoundId;
  teamSlug: WinStreakTeamSlug | null;
};

export type WinStreakProfileView = {
  availableTeamCount: number;
  bestStreak: number;
  currentStreak: number;
  displayName: string;
  history: WinStreakHistoryEntry[];
  id: string;
  joinedRoundId: WinStreakRoundId;
  usedTeamSlugs: WinStreakTeamSlug[];
};

export type WinStreakLeaderboardEntry = WinStreakProfileView & {
  rank: number;
};

export type WinStreakClubAvailability = {
  available: boolean;
  fixture: WinStreakWorkshopFixture;
  reason: "used-in-current-streak" | null;
  team: TeamSeed;
};

export type WinStreakWorkshopStorageStatus =
  "empty" | "restored" | "invalid" | "oversized";

export type WinStreakWorkshopStorageParseResult = {
  state: WinStreakWorkshopState;
  status: WinStreakWorkshopStorageStatus;
};

export type WinStreakWorkshopErrorCode =
  | "invalid-state"
  | "invalid-name"
  | "invalid-time"
  | "profiles-full"
  | "profile-not-found"
  | "workshop-complete"
  | "round-not-open"
  | "pick-exists"
  | "team-unavailable"
  | "result-fixtures-mismatch"
  | "result-exists"
  | "storage-too-large";

export class WinStreakWorkshopError extends Error {
  readonly code: WinStreakWorkshopErrorCode;

  constructor(code: WinStreakWorkshopErrorCode, message: string) {
    super(message);
    this.name = "WinStreakWorkshopError";
    this.code = code;
  }
}

const ROUND_ID_SET = new Set<string>(WIN_STREAK_WORKSHOP_ROUND_IDS);
const TEAM_SLUG_SET = new Set<string>(
  PREMIER_LEAGUE_2026_27_TEAMS.map((team) => team.slug),
);
const RESULT_SET = new Set<WinStreakFixtureResult>([
  "home",
  "draw",
  "away",
  "void",
]);

const roundIdSchema = z
  .string()
  .refine(
    (value): value is WinStreakRoundId => ROUND_ID_SET.has(value),
    "The round is not part of this workshop.",
  );
const teamSlugSchema = z
  .string()
  .refine(
    (value): value is WinStreakTeamSlug => TEAM_SLUG_SET.has(value),
    "The club is not part of this season.",
  );
const isoInstantSchema = z
  .string()
  .length(24)
  .refine(isCanonicalIsoInstant, "The stored time must be a UTC ISO instant.");
const fixtureResultSchema = z
  .object({
    fixtureId: z.string().min(1).max(128),
    result: z.enum(["home", "draw", "away", "void"]),
  })
  .strict();
const pickSchema = z
  .object({
    pickedAtIso: isoInstantSchema,
    roundId: roundIdSchema,
    teamSlug: teamSlugSchema,
  })
  .strict();
const profileSchema = z
  .object({
    createdAtIso: isoInstantSchema,
    displayName: z.string().min(2).max(40),
    id: z.string().min(2).max(40),
    joinedRoundId: roundIdSchema,
    picks: z.array(pickSchema).max(WIN_STREAK_WORKSHOP_ROUNDS.length),
  })
  .strict();
const roundResultSchema = z
  .object({
    fixtures: z.array(fixtureResultSchema).max(10),
    resolvedAtIso: isoInstantSchema,
    roundId: roundIdSchema,
  })
  .strict();
const stateSchema = z
  .object({
    activeProfileId: z.string().min(2).max(40).nullable(),
    profiles: z.array(profileSchema).max(WIN_STREAK_WORKSHOP_MAX_PROFILES),
    results: z.array(roundResultSchema).max(WIN_STREAK_WORKSHOP_ROUNDS.length),
    version: z.literal(WIN_STREAK_WORKSHOP_STORAGE_VERSION),
  })
  .strict();

function isCanonicalIsoInstant(value: string): boolean {
  const instant = new Date(value);
  return !Number.isNaN(instant.getTime()) && instant.toISOString() === value;
}

function parseIsoInstant(value: string): string {
  if (!isCanonicalIsoInstant(value)) {
    throw new WinStreakWorkshopError(
      "invalid-time",
      "Use a complete UTC ISO instant for workshop facts.",
    );
  }
  return value;
}

function currentIsoInstant(): string {
  return new Date().toISOString();
}

function roundIndex(roundId: WinStreakRoundId): number {
  return WIN_STREAK_WORKSHOP_ROUNDS.findIndex((round) => round.id === roundId);
}

function profileById(
  state: WinStreakWorkshopState,
  profileId: string,
): WinStreakWorkshopProfile {
  const profile = state.profiles.find(
    (candidate) => candidate.id === profileId,
  );
  if (!profile) {
    throw new WinStreakWorkshopError(
      "profile-not-found",
      "This workshop profile is unavailable.",
    );
  }
  return profile;
}

function resultByRoundId(
  state: WinStreakWorkshopState,
  roundId: WinStreakRoundId,
): WinStreakWorkshopRoundResult | null {
  return state.results.find((result) => result.roundId === roundId) ?? null;
}

function pickByRoundId(
  profile: WinStreakWorkshopProfile,
  roundId: WinStreakRoundId,
): WinStreakWorkshopPick | null {
  return profile.picks.find((pick) => pick.roundId === roundId) ?? null;
}

function fixtureResultById(
  roundResult: WinStreakWorkshopRoundResult,
  fixtureId: string,
): WinStreakFixtureResultInput | null {
  return (
    roundResult.fixtures.find((result) => result.fixtureId === fixtureId) ??
    null
  );
}

function expectedPickedFixtureIds(
  state: WinStreakWorkshopState,
  roundId: WinStreakRoundId,
): Set<string> {
  const fixtureIds = new Set<string>();
  for (const profile of state.profiles) {
    const pick = pickByRoundId(profile, roundId);
    if (pick) {
      fixtureIds.add(getWinStreakFixtureForTeam(roundId, pick.teamSlug).id);
    }
  }
  return fixtureIds;
}

function sameStringSet(left: Set<string>, right: Set<string>): boolean {
  return (
    left.size === right.size && [...left].every((value) => right.has(value))
  );
}

function hasCanonicalStateShape(state: WinStreakWorkshopState): boolean {
  if (
    state.activeProfileId !== null &&
    !state.profiles.some((profile) => profile.id === state.activeProfileId)
  ) {
    return false;
  }

  const profileIds = new Set<string>();
  for (const profile of state.profiles) {
    const parsedName = participantNameSchema.safeParse(profile.displayName);
    if (
      !parsedName.success ||
      parsedName.data !== profile.displayName ||
      normalizedParticipantNameKey(profile.displayName) !== profile.id ||
      profileIds.has(profile.id)
    ) {
      return false;
    }
    profileIds.add(profile.id);

    const joinedIndex = roundIndex(profile.joinedRoundId);
    if (joinedIndex < 0 || joinedIndex > state.results.length) return false;
    const previousJoinResult = state.results[joinedIndex - 1];
    const joinedRoundResult = state.results[joinedIndex];
    if (
      (previousJoinResult &&
        profile.createdAtIso < previousJoinResult.resolvedAtIso) ||
      (joinedRoundResult &&
        profile.createdAtIso > joinedRoundResult.resolvedAtIso)
    ) {
      return false;
    }

    const pickRounds = new Set<WinStreakRoundId>();
    let lastPickIndex = -1;
    for (const pick of profile.picks) {
      const pickIndex = roundIndex(pick.roundId);
      if (
        pickIndex < joinedIndex ||
        pickIndex > state.results.length ||
        pickIndex <= lastPickIndex ||
        pickRounds.has(pick.roundId) ||
        !getWinStreakFixtureForTeam(pick.roundId, pick.teamSlug) ||
        pick.pickedAtIso < profile.createdAtIso ||
        (state.results[pickIndex - 1] &&
          pick.pickedAtIso < state.results[pickIndex - 1]!.resolvedAtIso)
      ) {
        return false;
      }
      lastPickIndex = pickIndex;
      pickRounds.add(pick.roundId);
    }
  }

  for (let index = 0; index < state.results.length; index += 1) {
    const result = state.results[index];
    const round = WIN_STREAK_WORKSHOP_ROUNDS[index];
    if (!result || !round || result.roundId !== round.id) return false;
    if (
      state.results[index - 1] &&
      result.resolvedAtIso < state.results[index - 1]!.resolvedAtIso
    ) {
      return false;
    }

    const fixtureIds = new Set<string>();
    for (const fixtureResult of result.fixtures) {
      if (
        !getWinStreakFixture(result.roundId, fixtureResult.fixtureId) ||
        fixtureIds.has(fixtureResult.fixtureId) ||
        !RESULT_SET.has(fixtureResult.result)
      ) {
        return false;
      }
      fixtureIds.add(fixtureResult.fixtureId);
    }
    if (
      !sameStringSet(
        fixtureIds,
        expectedPickedFixtureIds(state, result.roundId),
      )
    ) {
      return false;
    }

    for (const profile of state.profiles) {
      const pick = pickByRoundId(profile, result.roundId);
      if (pick && pick.pickedAtIso > result.resolvedAtIso) return false;
    }
  }

  return state.profiles.every((profile) =>
    profilePicksRespectAvailability(state, profile),
  );
}

function profilePicksRespectAvailability(
  state: WinStreakWorkshopState,
  profile: WinStreakWorkshopProfile,
): boolean {
  const usedTeamSlugs = new Set<WinStreakTeamSlug>();
  const joinedIndex = roundIndex(profile.joinedRoundId);
  const lastRelevantIndex = Math.min(
    state.results.length,
    WIN_STREAK_WORKSHOP_ROUNDS.length - 1,
  );

  for (let index = joinedIndex; index <= lastRelevantIndex; index += 1) {
    const round = WIN_STREAK_WORKSHOP_ROUNDS[index];
    if (!round) return false;
    const pick = pickByRoundId(profile, round.id);
    if (pick && usedTeamSlugs.has(pick.teamSlug)) return false;

    const roundResult = state.results[index];
    if (!pick || !roundResult) continue;
    const fixture = getWinStreakFixtureForTeam(round.id, pick.teamSlug);
    const fixtureResult = fixtureResultById(roundResult, fixture.id);
    if (!fixtureResult) return false;
    const outcome = outcomeForPick(pick, fixture, fixtureResult.result);
    if (outcome === "win") {
      usedTeamSlugs.add(pick.teamSlug);
    } else if (outcome === "draw" || outcome === "loss") {
      usedTeamSlugs.clear();
    }
  }

  return true;
}

function parsedState(value: unknown): WinStreakWorkshopState | null {
  const parsed = stateSchema.safeParse(value);
  if (!parsed.success) return null;
  const state = parsed.data as WinStreakWorkshopState;
  return hasCanonicalStateShape(state) ? state : null;
}

function assertValidState(state: WinStreakWorkshopState): void {
  if (!parsedState(state)) {
    throw new WinStreakWorkshopError(
      "invalid-state",
      "The workshop state contains invalid or inconsistent facts.",
    );
  }
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function orderedFixtureResults(
  round: WinStreakWorkshopRound,
  inputs: readonly WinStreakFixtureResultInput[],
): WinStreakFixtureResultInput[] {
  const byFixtureId = new Map(
    inputs.map((input) => [input.fixtureId, input] as const),
  );
  return round.fixtures.flatMap((fixture) => {
    const input = byFixtureId.get(fixture.id as WinStreakFixtureId);
    return input ? [{ ...input }] : [];
  });
}

function outcomeForPick(
  pick: WinStreakWorkshopPick,
  fixture: WinStreakWorkshopFixture,
  fixtureResult: WinStreakFixtureResult,
): Exclude<WinStreakPickOutcome, "pending" | "missed"> {
  if (fixtureResult === "void") return "void";
  if (fixtureResult === "draw") return "draw";

  const pickedHome = fixture.homeTeamSlug === pick.teamSlug;
  return (fixtureResult === "home" && pickedHome) ||
    (fixtureResult === "away" && !pickedHome)
    ? "win"
    : "loss";
}

function historyEntry(
  round: WinStreakWorkshopRound,
  pick: WinStreakWorkshopPick | null,
  roundResult: WinStreakWorkshopRoundResult | null,
): WinStreakHistoryEntry {
  if (!pick) {
    return {
      fixtureId: null,
      isHome: null,
      matchweek: round.matchweek,
      opponentTeamSlug: null,
      outcome: roundResult ? "missed" : "pending",
      pickedAtIso: null,
      result: null,
      roundDateIso: round.dateIso,
      roundId: round.id,
      teamSlug: null,
    };
  }

  const fixture = getWinStreakFixtureForTeam(round.id, pick.teamSlug);
  const fixtureResult = roundResult
    ? fixtureResultById(roundResult, fixture.id)
    : null;
  const isHome = fixture.homeTeamSlug === pick.teamSlug;

  return {
    fixtureId: fixture.id as WinStreakFixtureId,
    isHome,
    matchweek: round.matchweek,
    opponentTeamSlug: isHome ? fixture.awayTeamSlug : fixture.homeTeamSlug,
    outcome:
      roundResult && fixtureResult
        ? outcomeForPick(pick, fixture, fixtureResult.result)
        : "pending",
    pickedAtIso: pick.pickedAtIso,
    result: fixtureResult?.result ?? null,
    roundDateIso: round.dateIso,
    roundId: round.id,
    teamSlug: pick.teamSlug,
  };
}

export function createEmptyWinStreakWorkshopState(): WinStreakWorkshopState {
  return {
    activeProfileId: null,
    profiles: [],
    results: [],
    version: WIN_STREAK_WORKSHOP_STORAGE_VERSION,
  };
}

export function resetWinStreakWorkshopState(
  state: WinStreakWorkshopState,
): WinStreakWorkshopState {
  void state;
  return createEmptyWinStreakWorkshopState();
}

export function getCurrentWinStreakRound(
  state: WinStreakWorkshopState,
): WinStreakWorkshopRound | null {
  return WIN_STREAK_WORKSHOP_ROUNDS[state.results.length] ?? null;
}

export function activateWinStreakProfile(
  state: WinStreakWorkshopState,
  displayName: string,
  createdAtIso = currentIsoInstant(),
): {
  created: boolean;
  profile: WinStreakWorkshopProfile;
  state: WinStreakWorkshopState;
} {
  assertValidState(state);
  const parsedName = participantNameSchema.safeParse(displayName);
  if (!parsedName.success) {
    throw new WinStreakWorkshopError(
      "invalid-name",
      parsedName.error.issues[0]?.message ?? "Enter a valid display name.",
    );
  }
  const normalizedName = parsedName.data;
  const profileId = normalizedParticipantNameKey(normalizedName);
  const existing = state.profiles.find((profile) => profile.id === profileId);
  if (existing) {
    return {
      created: false,
      profile: existing,
      state: { ...state, activeProfileId: existing.id },
    };
  }

  if (state.profiles.length >= WIN_STREAK_WORKSHOP_MAX_PROFILES) {
    throw new WinStreakWorkshopError(
      "profiles-full",
      "This workshop browser has reached the 50-profile limit.",
    );
  }
  const currentRound = getCurrentWinStreakRound(state);
  if (!currentRound) {
    throw new WinStreakWorkshopError(
      "workshop-complete",
      "All workshop rounds are complete. Reset the workshop to start again.",
    );
  }

  const createdInstant = parseIsoInstant(createdAtIso);
  const previousRoundResult = state.results.at(-1);
  if (
    previousRoundResult &&
    createdInstant < previousRoundResult.resolvedAtIso
  ) {
    throw new WinStreakWorkshopError(
      "invalid-time",
      "The profile creation time cannot precede the previous round result.",
    );
  }

  const profile: WinStreakWorkshopProfile = {
    createdAtIso: createdInstant,
    displayName: normalizedName,
    id: profileId,
    joinedRoundId: currentRound.id,
    picks: [],
  };
  return {
    created: true,
    profile,
    state: {
      ...state,
      activeProfileId: profile.id,
      profiles: [...state.profiles, profile],
    },
  };
}

export function recordWinStreakPick(
  state: WinStreakWorkshopState,
  profileId: string,
  roundId: WinStreakRoundId,
  teamSlug: WinStreakTeamSlug,
  pickedAtIso = currentIsoInstant(),
): WinStreakWorkshopState {
  assertValidState(state);
  const profile = profileById(state, profileId);
  const currentRound = getCurrentWinStreakRound(state);
  if (!currentRound || currentRound.id !== roundId) {
    throw new WinStreakWorkshopError(
      "round-not-open",
      "You can submit a pick only for the open workshop round.",
    );
  }
  if (pickByRoundId(profile, roundId)) {
    throw new WinStreakWorkshopError(
      "pick-exists",
      "This profile already has a locked pick for the round.",
    );
  }

  const availability = getWinStreakClubAvailability(state, profileId, roundId);
  const selected = availability.find((item) => item.team.slug === teamSlug);
  if (!selected?.available) {
    throw new WinStreakWorkshopError(
      "team-unavailable",
      "Choose a club that is available in the current streak.",
    );
  }

  const pickedInstant = parseIsoInstant(pickedAtIso);
  const previousRoundResult = state.results.at(-1);
  if (
    pickedInstant < profile.createdAtIso ||
    (previousRoundResult && pickedInstant < previousRoundResult.resolvedAtIso)
  ) {
    throw new WinStreakWorkshopError(
      "invalid-time",
      "The pick time must fall after the profile joined and the previous round resolved.",
    );
  }

  const pick: WinStreakWorkshopPick = {
    pickedAtIso: pickedInstant,
    roundId,
    teamSlug,
  };
  return {
    ...state,
    activeProfileId: profileId,
    profiles: state.profiles.map((candidate) =>
      candidate.id === profileId
        ? { ...candidate, picks: [...candidate.picks, pick] }
        : candidate,
    ),
  };
}

export function getRequiredWinStreakResultFixtures(
  state: WinStreakWorkshopState,
  roundId: WinStreakRoundId,
): WinStreakWorkshopFixture[] {
  assertValidState(state);
  const currentRound = getCurrentWinStreakRound(state);
  if (!currentRound || currentRound.id !== roundId) {
    throw new WinStreakWorkshopError(
      "round-not-open",
      "Result controls are available only for the open workshop round.",
    );
  }

  const requiredFixtureIds = expectedPickedFixtureIds(state, roundId);
  return currentRound.fixtures.filter((fixture) =>
    requiredFixtureIds.has(fixture.id),
  );
}

export function resolveWinStreakRound(
  state: WinStreakWorkshopState,
  roundId: WinStreakRoundId,
  fixtureResults: readonly WinStreakFixtureResultInput[],
  resolvedAtIso = currentIsoInstant(),
): WinStreakWorkshopState {
  assertValidState(state);
  if (resultByRoundId(state, roundId)) {
    throw new WinStreakWorkshopError(
      "result-exists",
      "This workshop round already has a result.",
    );
  }
  const currentRound = getCurrentWinStreakRound(state);
  if (!currentRound || currentRound.id !== roundId) {
    throw new WinStreakWorkshopError(
      "round-not-open",
      "Resolve the open workshop round before another round.",
    );
  }

  const actualFixtureIds = new Set<string>();
  let inputsValid = true;
  for (const fixtureResult of fixtureResults) {
    if (
      !getWinStreakFixture(roundId, fixtureResult.fixtureId) ||
      !RESULT_SET.has(fixtureResult.result) ||
      actualFixtureIds.has(fixtureResult.fixtureId)
    ) {
      inputsValid = false;
      break;
    }
    actualFixtureIds.add(fixtureResult.fixtureId);
  }
  if (
    !inputsValid ||
    !sameStringSet(actualFixtureIds, expectedPickedFixtureIds(state, roundId))
  ) {
    throw new WinStreakWorkshopError(
      "result-fixtures-mismatch",
      "Provide one result for every distinct picked fixture and no others.",
    );
  }

  const resolvedInstant = parseIsoInstant(resolvedAtIso);
  const previousRoundResult = state.results.at(-1);
  if (
    previousRoundResult &&
    resolvedInstant < previousRoundResult.resolvedAtIso
  ) {
    throw new WinStreakWorkshopError(
      "invalid-time",
      "The round result cannot precede the previous round result.",
    );
  }
  const latestPick = state.profiles
    .map((profile) => pickByRoundId(profile, roundId)?.pickedAtIso ?? null)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1);
  if (latestPick && latestPick > resolvedInstant) {
    throw new WinStreakWorkshopError(
      "invalid-time",
      "The round result cannot precede a locked pick.",
    );
  }

  return {
    ...state,
    results: [
      ...state.results,
      {
        fixtures: orderedFixtureResults(currentRound, fixtureResults),
        resolvedAtIso: resolvedInstant,
        roundId,
      },
    ],
  };
}

export function deriveWinStreakProfile(
  state: WinStreakWorkshopState,
  profileId: string,
): WinStreakProfileView {
  assertValidState(state);
  const profile = profileById(state, profileId);
  const joinedIndex = roundIndex(profile.joinedRoundId);
  const historyEnd = Math.min(
    state.results.length + 1,
    WIN_STREAK_WORKSHOP_ROUNDS.length,
  );
  const history = WIN_STREAK_WORKSHOP_ROUNDS.slice(joinedIndex, historyEnd).map(
    (round) =>
      historyEntry(
        round,
        pickByRoundId(profile, round.id),
        resultByRoundId(state, round.id),
      ),
  );

  let bestStreak = 0;
  let currentStreak = 0;
  const usedTeamSlugs = new Set<WinStreakTeamSlug>();
  for (const entry of history) {
    if (entry.outcome === "win" && entry.teamSlug) {
      currentStreak += 1;
      bestStreak = Math.max(bestStreak, currentStreak);
      usedTeamSlugs.add(entry.teamSlug);
    } else if (entry.outcome === "draw" || entry.outcome === "loss") {
      currentStreak = 0;
      usedTeamSlugs.clear();
    }
  }

  return {
    availableTeamCount:
      PREMIER_LEAGUE_2026_27_TEAMS.length - usedTeamSlugs.size,
    bestStreak,
    currentStreak,
    displayName: profile.displayName,
    history,
    id: profile.id,
    joinedRoundId: profile.joinedRoundId,
    usedTeamSlugs: [...usedTeamSlugs],
  };
}

export function getWinStreakClubAvailability(
  state: WinStreakWorkshopState,
  profileId: string,
  roundId: WinStreakRoundId,
): WinStreakClubAvailability[] {
  assertValidState(state);
  const currentRound = getCurrentWinStreakRound(state);
  if (!currentRound || currentRound.id !== roundId) {
    throw new WinStreakWorkshopError(
      "round-not-open",
      "Club availability is available only for the open workshop round.",
    );
  }
  const usedTeamSlugs = new Set(
    deriveWinStreakProfile(state, profileId).usedTeamSlugs,
  );

  return PREMIER_LEAGUE_2026_27_TEAMS.map((team) => {
    const available = !usedTeamSlugs.has(team.slug);
    return {
      available,
      fixture: getWinStreakFixtureForTeam(roundId, team.slug),
      reason: available ? null : "used-in-current-streak",
      team,
    };
  });
}

export function rankWinStreakProfiles(
  state: WinStreakWorkshopState,
): WinStreakLeaderboardEntry[] {
  assertValidState(state);
  const ranked = state.profiles
    .map((profile) => deriveWinStreakProfile(state, profile.id))
    .sort(
      (left, right) =>
        right.bestStreak - left.bestStreak ||
        compareDisplayNames(left.displayName, right.displayName),
    );

  let previousBest: number | null = null;
  let rank = 0;
  return ranked.map((profile, index) => {
    if (profile.bestStreak !== previousBest) {
      rank = index + 1;
      previousBest = profile.bestStreak;
    }
    return { ...profile, rank };
  });
}

function compareDisplayNames(left: string, right: string): number {
  const localized = left.localeCompare(right, "en-GB", {
    sensitivity: "base",
  });
  if (localized !== 0) return localized;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function parseWinStreakWorkshopStorage(
  raw: string | null,
): WinStreakWorkshopStorageParseResult {
  if (raw === null) {
    return { state: createEmptyWinStreakWorkshopState(), status: "empty" };
  }
  if (utf8ByteLength(raw) > WIN_STREAK_WORKSHOP_MAX_STORAGE_BYTES) {
    return { state: createEmptyWinStreakWorkshopState(), status: "oversized" };
  }

  try {
    const state = parsedState(JSON.parse(raw));
    return state
      ? { state, status: "restored" }
      : { state: createEmptyWinStreakWorkshopState(), status: "invalid" };
  } catch {
    return { state: createEmptyWinStreakWorkshopState(), status: "invalid" };
  }
}

export function serializeWinStreakWorkshopState(
  state: WinStreakWorkshopState,
): string {
  assertValidState(state);
  const serialized = JSON.stringify(state);
  if (utf8ByteLength(serialized) > WIN_STREAK_WORKSHOP_MAX_STORAGE_BYTES) {
    throw new WinStreakWorkshopError(
      "storage-too-large",
      "The workshop state exceeds the 128 KB storage limit.",
    );
  }
  return serialized;
}

export function loadWinStreakWorkshopState(
  storage: Pick<Storage, "getItem">,
): WinStreakWorkshopStorageParseResult {
  try {
    return parseWinStreakWorkshopStorage(
      storage.getItem(WIN_STREAK_WORKSHOP_STORAGE_KEY),
    );
  } catch {
    return { state: createEmptyWinStreakWorkshopState(), status: "invalid" };
  }
}

export function saveWinStreakWorkshopState(
  storage: Pick<Storage, "setItem">,
  state: WinStreakWorkshopState,
): void {
  storage.setItem(
    WIN_STREAK_WORKSHOP_STORAGE_KEY,
    serializeWinStreakWorkshopState(state),
  );
}

export function clearWinStreakWorkshopState(
  storage: Pick<Storage, "removeItem">,
): WinStreakWorkshopState {
  storage.removeItem(WIN_STREAK_WORKSHOP_STORAGE_KEY);
  return createEmptyWinStreakWorkshopState();
}
