import { describe, expect, it } from "vitest";

import { PREMIER_LEAGUE_2026_27_TEAMS } from "@/data/teams";
import {
  WIN_STREAK_WORKSHOP_ROUNDS,
  WIN_STREAK_WORKSHOP_SOURCE,
  getWinStreakFixtureForTeam,
} from "@/features/win-streak/fixtures";
import {
  WIN_STREAK_WORKSHOP_MAX_PROFILES,
  WIN_STREAK_WORKSHOP_MAX_STORAGE_BYTES,
  WinStreakWorkshopError,
  activateWinStreakProfile,
  createEmptyWinStreakWorkshopState,
  deriveWinStreakProfile,
  getCurrentWinStreakRound,
  getRequiredWinStreakResultFixtures,
  getWinStreakClubAvailability,
  parseWinStreakWorkshopStorage,
  rankWinStreakProfiles,
  recordWinStreakPick,
  resetWinStreakWorkshopState,
  resolveWinStreakRound,
  serializeWinStreakWorkshopState,
  type WinStreakFixtureResultInput,
  type WinStreakWorkshopState,
} from "@/features/win-streak/workshop-state";

const AT = {
  join: "2026-12-20T12:00:00.000Z",
  mw20Pick: "2027-01-05T12:00:00.000Z",
  mw20Result: "2027-01-07T12:00:00.000Z",
  mw21Pick: "2027-01-15T12:00:00.000Z",
  mw21Result: "2027-01-17T12:00:00.000Z",
  mw22Pick: "2027-01-22T12:00:00.000Z",
  mw22Result: "2027-01-24T12:00:00.000Z",
  mw23Pick: "2027-01-29T12:00:00.000Z",
  mw23Result: "2027-01-31T12:00:00.000Z",
} as const;

function activate(
  state: WinStreakWorkshopState,
  name: string,
  atIso: string = AT.join,
) {
  return activateWinStreakProfile(state, name, atIso);
}

function pick(
  state: WinStreakWorkshopState,
  profileId: string,
  roundId: "mw20" | "mw21" | "mw22" | "mw23",
  teamSlug: Parameters<typeof recordWinStreakPick>[3],
  atIso: string,
) {
  return recordWinStreakPick(state, profileId, roundId, teamSlug, atIso);
}

function resolve(
  state: WinStreakWorkshopState,
  roundId: "mw20" | "mw21" | "mw22" | "mw23",
  results: readonly WinStreakFixtureResultInput[],
  resolvedAtIso: string,
) {
  return resolveWinStreakRound(state, roundId, results, resolvedAtIso);
}

describe("Win Streak workshop fixtures", () => {
  it("pins the approved official Matchweek 20-23 snapshot", () => {
    expect(WIN_STREAK_WORKSHOP_SOURCE).toEqual({
      fixtureListUrl:
        "https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-202627-premier-league-season/",
      lastFanStandingUrl:
        "https://www.premierleague.com/en/news/4685390/premier-league-last-fan-standing-202627",
      verifiedOn: "2026-08-23",
    });

    expect(
      WIN_STREAK_WORKSHOP_ROUNDS.map((round) => ({
        dateIso: round.dateIso,
        fixtures: round.fixtures.map(
          ({ awayTeamSlug, homeTeamSlug }) => `${homeTeamSlug}:${awayTeamSlug}`,
        ),
        id: round.id,
        matchweek: round.matchweek,
      })),
    ).toEqual([
      {
        dateIso: "2027-01-06",
        fixtures: [
          "arsenal:brentford",
          "brighton-and-hove-albion:afc-bournemouth",
          "crystal-palace:chelsea",
          "everton:aston-villa",
          "fulham:tottenham-hotspur",
          "ipswich-town:coventry-city",
          "leeds-united:manchester-city",
          "manchester-united:newcastle-united",
          "nottingham-forest:hull-city",
          "sunderland:liverpool",
        ],
        id: "mw20",
        matchweek: 20,
      },
      {
        dateIso: "2027-01-16",
        fixtures: [
          "afc-bournemouth:ipswich-town",
          "aston-villa:manchester-united",
          "brentford:brighton-and-hove-albion",
          "chelsea:sunderland",
          "coventry-city:everton",
          "hull-city:arsenal",
          "liverpool:crystal-palace",
          "manchester-city:nottingham-forest",
          "newcastle-united:fulham",
          "tottenham-hotspur:leeds-united",
        ],
        id: "mw21",
        matchweek: 21,
      },
      {
        dateIso: "2027-01-23",
        fixtures: [
          "arsenal:newcastle-united",
          "brighton-and-hove-albion:manchester-city",
          "crystal-palace:tottenham-hotspur",
          "everton:brentford",
          "fulham:aston-villa",
          "ipswich-town:hull-city",
          "leeds-united:chelsea",
          "manchester-united:liverpool",
          "nottingham-forest:afc-bournemouth",
          "sunderland:coventry-city",
        ],
        id: "mw22",
        matchweek: 22,
      },
      {
        dateIso: "2027-01-30",
        fixtures: [
          "afc-bournemouth:fulham",
          "aston-villa:ipswich-town",
          "brentford:manchester-united",
          "chelsea:nottingham-forest",
          "coventry-city:leeds-united",
          "hull-city:crystal-palace",
          "liverpool:everton",
          "manchester-city:arsenal",
          "newcastle-united:brighton-and-hove-albion",
          "tottenham-hotspur:sunderland",
        ],
        id: "mw23",
        matchweek: 23,
      },
    ]);
  });

  it("uses every canonical club exactly once in each round", () => {
    const canonicalSlugs = PREMIER_LEAGUE_2026_27_TEAMS.map(
      (team) => team.slug,
    ).sort();

    for (const round of WIN_STREAK_WORKSHOP_ROUNDS) {
      const roundSlugs = round.fixtures
        .flatMap((fixture) => [fixture.homeTeamSlug, fixture.awayTeamSlug])
        .sort();
      expect(round.fixtures).toHaveLength(10);
      expect(roundSlugs).toEqual(canonicalSlugs);
    }

    expect(
      getWinStreakFixtureForTeam("mw22", "newcastle-united"),
    ).toMatchObject({
      awayTeamSlug: "newcastle-united",
      homeTeamSlug: "arsenal",
      id: "mw22-arsenal-newcastle-united",
    });
  });
});

describe("Win Streak workshop state", () => {
  it("normalizes display names and activates an existing profile", () => {
    const created = activate(
      createEmptyWinStreakWorkshopState(),
      "  Ada   LOVELACE  ",
    );
    const activated = activate(created.state, "ada lovelace");

    expect(created.created).toBe(true);
    expect(created.profile).toMatchObject({
      displayName: "Ada LOVELACE",
      id: "ada lovelace",
      joinedRoundId: "mw20",
    });
    expect(activated.created).toBe(false);
    expect(activated.profile).toEqual(created.profile);
    expect(activated.state.profiles).toHaveLength(1);
    expect(activated.state.activeProfileId).toBe("ada lovelace");
  });

  it.each(["", "a", "x".repeat(41), "Ada\u0000Lovelace"])(
    "rejects invalid display name %j",
    (displayName) => {
      expect(() =>
        activate(createEmptyWinStreakWorkshopState(), displayName),
      ).toThrow(WinStreakWorkshopError);
    },
  );

  it("keeps one immutable pick per profile and round", () => {
    const created = activate(createEmptyWinStreakWorkshopState(), "Ada");
    const picked = pick(
      created.state,
      created.profile.id,
      "mw20",
      "arsenal",
      AT.mw20Pick,
    );

    expect(
      deriveWinStreakProfile(picked, created.profile.id).history[0],
    ).toMatchObject({
      outcome: "pending",
      roundId: "mw20",
      teamSlug: "arsenal",
    });
    expect(() =>
      pick(picked, created.profile.id, "mw20", "brentford", AT.mw20Pick),
    ).toThrow(
      expect.objectContaining<Partial<WinStreakWorkshopError>>({
        code: "pick-exists",
      }),
    );
  });

  it("resolves one shared fixture fact for opposing picks", () => {
    const ada = activate(createEmptyWinStreakWorkshopState(), "Ada");
    const ben = activate(ada.state, "Ben");
    let state = pick(ben.state, ada.profile.id, "mw20", "arsenal", AT.mw20Pick);
    state = pick(state, ben.profile.id, "mw20", "brentford", AT.mw20Pick);
    state = resolve(
      state,
      "mw20",
      [{ fixtureId: "mw20-arsenal-brentford", result: "home" }],
      AT.mw20Result,
    );

    expect(deriveWinStreakProfile(state, ada.profile.id)).toMatchObject({
      bestStreak: 1,
      currentStreak: 1,
    });
    expect(
      deriveWinStreakProfile(state, ada.profile.id).history[0]?.outcome,
    ).toBe("win");
    expect(deriveWinStreakProfile(state, ben.profile.id)).toMatchObject({
      bestStreak: 0,
      currentStreak: 0,
    });
    expect(
      deriveWinStreakProfile(state, ben.profile.id).history[0]?.outcome,
    ).toBe("loss");
  });

  it("requires exactly the distinct fixtures that received picks", () => {
    const ada = activate(createEmptyWinStreakWorkshopState(), "Ada");
    const ben = activate(ada.state, "Ben");
    let state = pick(ben.state, ada.profile.id, "mw20", "arsenal", AT.mw20Pick);
    state = pick(state, ben.profile.id, "mw20", "sunderland", AT.mw20Pick);

    expect(
      getRequiredWinStreakResultFixtures(state, "mw20").map(
        (fixture) => fixture.id,
      ),
    ).toEqual(["mw20-arsenal-brentford", "mw20-sunderland-liverpool"]);

    expect(() =>
      resolve(
        state,
        "mw20",
        [{ fixtureId: "mw20-arsenal-brentford", result: "home" }],
        AT.mw20Result,
      ),
    ).toThrow(
      expect.objectContaining<Partial<WinStreakWorkshopError>>({
        code: "result-fixtures-mismatch",
      }),
    );
    expect(() =>
      resolve(
        state,
        "mw20",
        [
          { fixtureId: "mw20-arsenal-brentford", result: "home" },
          { fixtureId: "mw20-sunderland-liverpool", result: "away" },
          {
            fixtureId: "mw20-brighton-and-hove-albion-afc-bournemouth",
            result: "draw",
          },
        ],
        AT.mw20Result,
      ),
    ).toThrow(
      expect.objectContaining<Partial<WinStreakWorkshopError>>({
        code: "result-fixtures-mismatch",
      }),
    );
  });

  it("derives win, missed, void, and draw without storing streak totals", () => {
    const created = activate(createEmptyWinStreakWorkshopState(), "Ada");
    let state = pick(
      created.state,
      created.profile.id,
      "mw20",
      "arsenal",
      AT.mw20Pick,
    );
    state = resolve(
      state,
      "mw20",
      [{ fixtureId: "mw20-arsenal-brentford", result: "home" }],
      AT.mw20Result,
    );
    state = resolve(state, "mw21", [], AT.mw21Result);

    let availability = getWinStreakClubAvailability(
      state,
      created.profile.id,
      "mw22",
    );
    expect(
      availability.find((item) => item.team.slug === "arsenal"),
    ).toMatchObject({ available: false, reason: "used-in-current-streak" });

    state = pick(
      state,
      created.profile.id,
      "mw22",
      "newcastle-united",
      AT.mw22Pick,
    );
    state = resolve(
      state,
      "mw22",
      [{ fixtureId: "mw22-arsenal-newcastle-united", result: "void" }],
      AT.mw22Result,
    );

    availability = getWinStreakClubAvailability(
      state,
      created.profile.id,
      "mw23",
    );
    expect(
      availability.find((item) => item.team.slug === "newcastle-united"),
    ).toMatchObject({ available: true, reason: null });

    state = pick(
      state,
      created.profile.id,
      "mw23",
      "manchester-city",
      AT.mw23Pick,
    );
    state = resolve(
      state,
      "mw23",
      [{ fixtureId: "mw23-manchester-city-arsenal", result: "draw" }],
      AT.mw23Result,
    );

    const view = deriveWinStreakProfile(state, created.profile.id);
    expect(view).toMatchObject({
      availableTeamCount: 20,
      bestStreak: 1,
      currentStreak: 0,
      usedTeamSlugs: [],
    });
    expect(view.history.map((item) => item.outcome)).toEqual([
      "win",
      "missed",
      "void",
      "draw",
    ]);
    expect(state.profiles[0]).not.toHaveProperty("bestStreak");
    expect(state.profiles[0]).not.toHaveProperty("currentStreak");
  });

  it("keeps the best streak after a loss and unlocks the club pool", () => {
    const created = activate(createEmptyWinStreakWorkshopState(), "Ada");
    let state = pick(
      created.state,
      created.profile.id,
      "mw20",
      "arsenal",
      AT.mw20Pick,
    );
    state = resolve(
      state,
      "mw20",
      [{ fixtureId: "mw20-arsenal-brentford", result: "home" }],
      AT.mw20Result,
    );
    state = pick(state, created.profile.id, "mw21", "hull-city", AT.mw21Pick);
    state = resolve(
      state,
      "mw21",
      [{ fixtureId: "mw21-hull-city-arsenal", result: "home" }],
      AT.mw21Result,
    );
    state = pick(state, created.profile.id, "mw22", "liverpool", AT.mw22Pick);
    state = resolve(
      state,
      "mw22",
      [{ fixtureId: "mw22-manchester-united-liverpool", result: "home" }],
      AT.mw22Result,
    );

    expect(deriveWinStreakProfile(state, created.profile.id)).toMatchObject({
      availableTeamCount: 20,
      bestStreak: 2,
      currentStreak: 0,
      usedTeamSlugs: [],
    });
  });

  it("does not penalize a participant for rounds before they join", () => {
    let state = resolve(
      createEmptyWinStreakWorkshopState(),
      "mw20",
      [],
      AT.mw20Result,
    );
    const created = activate(state, "Late Ada", AT.mw21Pick);
    state = resolve(created.state, "mw21", [], AT.mw21Result);

    const view = deriveWinStreakProfile(state, created.profile.id);
    expect(created.profile.joinedRoundId).toBe("mw21");
    expect(view.history.map((item) => item.roundId)).toEqual(["mw21", "mw22"]);
    expect(view.history.map((item) => item.outcome)).toEqual([
      "missed",
      "pending",
    ]);
  });

  it("rejects facts outside their round's chronological window", () => {
    const afterMw20 = resolve(
      createEmptyWinStreakWorkshopState(),
      "mw20",
      [],
      AT.mw20Result,
    );

    expect(() =>
      activate(afterMw20, "Early Ada", "2027-01-06T12:00:00.000Z"),
    ).toThrow(
      expect.objectContaining<Partial<WinStreakWorkshopError>>({
        code: "invalid-time",
      }),
    );

    const created = activate(afterMw20, "Ada", "2027-01-08T12:00:00.000Z");
    expect(() =>
      pick(
        created.state,
        created.profile.id,
        "mw21",
        "arsenal",
        "2027-01-06T12:00:00.000Z",
      ),
    ).toThrow(
      expect.objectContaining<Partial<WinStreakWorkshopError>>({
        code: "invalid-time",
      }),
    );
    expect(() =>
      resolve(created.state, "mw21", [], "2027-01-06T12:00:00.000Z"),
    ).toThrow(
      expect.objectContaining<Partial<WinStreakWorkshopError>>({
        code: "invalid-time",
      }),
    );

    const retroactiveJoin = structuredClone(created.state);
    retroactiveJoin.profiles[0]!.joinedRoundId = "mw20";
    expect(
      parseWinStreakWorkshopStorage(JSON.stringify(retroactiveJoin)).status,
    ).toBe("invalid");
  });

  it("uses competition ranks and alphabetizes tied best streaks", () => {
    const zoe = activate(createEmptyWinStreakWorkshopState(), "Zoe");
    const ada = activate(zoe.state, "Ada");
    const ben = activate(ada.state, "Ben");
    let state = pick(ben.state, zoe.profile.id, "mw20", "arsenal", AT.mw20Pick);
    state = pick(state, ada.profile.id, "mw20", "arsenal", AT.mw20Pick);
    state = pick(state, ben.profile.id, "mw20", "brentford", AT.mw20Pick);
    state = resolve(
      state,
      "mw20",
      [{ fixtureId: "mw20-arsenal-brentford", result: "home" }],
      AT.mw20Result,
    );

    expect(
      rankWinStreakProfiles(state).map(({ bestStreak, displayName, rank }) => ({
        bestStreak,
        displayName,
        rank,
      })),
    ).toEqual([
      { bestStreak: 1, displayName: "Ada", rank: 1 },
      { bestStreak: 1, displayName: "Zoe", rank: 1 },
      { bestStreak: 0, displayName: "Ben", rank: 3 },
    ]);
  });

  it("round-trips a valid versioned store and falls back for corrupt data", () => {
    const created = activate(createEmptyWinStreakWorkshopState(), "Ada");
    const state = pick(
      created.state,
      created.profile.id,
      "mw20",
      "arsenal",
      AT.mw20Pick,
    );
    const serialized = serializeWinStreakWorkshopState(state);

    expect(parseWinStreakWorkshopStorage(serialized)).toEqual({
      state,
      status: "restored",
    });
    expect(parseWinStreakWorkshopStorage(null).status).toBe("empty");
    expect(parseWinStreakWorkshopStorage("not json").status).toBe("invalid");
    expect(
      parseWinStreakWorkshopStorage(JSON.stringify({ ...state, version: 2 }))
        .status,
    ).toBe("invalid");

    const corrupt = structuredClone(state) as unknown as Record<
      string,
      unknown
    >;
    const profiles = corrupt.profiles as Array<Record<string, unknown>>;
    profiles[0] = { ...profiles[0], displayName: "x" };
    expect(parseWinStreakWorkshopStorage(JSON.stringify(corrupt)).status).toBe(
      "invalid",
    );
  });

  it("rejects oversized storage and more than 50 profiles", () => {
    const oversized = `\"${"😀".repeat(
      Math.ceil(WIN_STREAK_WORKSHOP_MAX_STORAGE_BYTES / 2),
    )}\"`;
    expect(new TextEncoder().encode(oversized).byteLength).toBeGreaterThan(
      WIN_STREAK_WORKSHOP_MAX_STORAGE_BYTES,
    );
    expect(parseWinStreakWorkshopStorage(oversized).status).toBe("oversized");

    let state = createEmptyWinStreakWorkshopState();
    for (let index = 0; index < WIN_STREAK_WORKSHOP_MAX_PROFILES; index += 1) {
      state = activate(state, `Profile ${index}`).state;
    }
    expect(() => activate(state, "Profile overflow")).toThrow(
      expect.objectContaining<Partial<WinStreakWorkshopError>>({
        code: "profiles-full",
      }),
    );

    const tooManyProfiles = {
      ...state,
      profiles: [
        ...state.profiles,
        {
          createdAtIso: AT.join,
          displayName: "Overflow",
          id: "overflow",
          joinedRoundId: "mw20",
          picks: [],
        },
      ],
    };
    expect(
      parseWinStreakWorkshopStorage(JSON.stringify(tooManyProfiles)).status,
    ).toBe("invalid");
  });

  it("rejects stored result facts that do not exactly match picked fixtures", () => {
    const created = activate(createEmptyWinStreakWorkshopState(), "Ada");
    const state = pick(
      created.state,
      created.profile.id,
      "mw20",
      "arsenal",
      AT.mw20Pick,
    );
    const missing = {
      ...state,
      results: [
        {
          fixtures: [],
          resolvedAtIso: AT.mw20Result,
          roundId: "mw20",
        },
      ],
    };
    const unrelated = {
      ...state,
      results: [
        {
          fixtures: [
            {
              fixtureId: "mw20-sunderland-liverpool",
              result: "home",
            },
          ],
          resolvedAtIso: AT.mw20Result,
          roundId: "mw20",
        },
      ],
    };

    expect(parseWinStreakWorkshopStorage(JSON.stringify(missing)).status).toBe(
      "invalid",
    );
    expect(
      parseWinStreakWorkshopStorage(JSON.stringify(unrelated)).status,
    ).toBe("invalid");
  });

  it("rejects a stored pick that reuses a winning club before reset", () => {
    const created = activate(createEmptyWinStreakWorkshopState(), "Ada");
    let state = pick(
      created.state,
      created.profile.id,
      "mw20",
      "arsenal",
      AT.mw20Pick,
    );
    state = resolve(
      state,
      "mw20",
      [{ fixtureId: "mw20-arsenal-brentford", result: "home" }],
      AT.mw20Result,
    );
    const corrupt = structuredClone(state);
    corrupt.profiles[0]?.picks.push({
      pickedAtIso: AT.mw21Pick,
      roundId: "mw21",
      teamSlug: "arsenal",
    });

    expect(parseWinStreakWorkshopStorage(JSON.stringify(corrupt)).status).toBe(
      "invalid",
    );
  });

  it("resets the complete workshop to the versioned empty state", () => {
    const created = activate(createEmptyWinStreakWorkshopState(), "Ada");

    expect(resetWinStreakWorkshopState(created.state)).toEqual(
      createEmptyWinStreakWorkshopState(),
    );
    expect(
      getCurrentWinStreakRound(resetWinStreakWorkshopState(created.state)),
    ).toMatchObject({ id: "mw20" });
  });
});
