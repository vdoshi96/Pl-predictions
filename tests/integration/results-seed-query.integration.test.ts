// @vitest-environment node

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getDb } from "@/db/client";
import {
  players,
  predictionCategoryPicks,
  predictions,
  seasons,
  teams,
} from "@/db/schema";
import { getPickedSubjectsByDataset } from "@/features/results/seed-queries";

import { assertIsolatedDatabaseEnvironment } from "../test-environment-safety";

const enabled = process.env.RUN_DB_INTEGRATION === "1";
if (enabled) {
  assertIsolatedDatabaseEnvironment(
    process.env,
    "Results seed-query integration tests",
  );
}

let seasonId = "";
let haalandId = "";
let salahId = "";
let wilsonId = "";
let arsenalTeamId = "";
let cityTeamId = "";

beforeEach(async () => {
  if (!enabled) return;
  const db = getDb();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
  seasonId = randomUUID();
  haalandId = randomUUID();
  salahId = randomUUID();
  wilsonId = randomUUID();
  arsenalTeamId = randomUUID();
  cityTeamId = randomUUID();
  const firstPredictionId = randomUUID();
  const secondPredictionId = randomUUID();

  await db.insert(seasons).values({
    competitionCode: "QA",
    id: seasonId,
    name: "Results seed query QA",
    openingKickoff: new Date("2099-08-01T12:00:00.000Z"),
    revealPredictions: true,
    slug: `seed-query-${suffix}`,
    startYear: 2099,
    submissionsLocked: true,
  });
  await db.insert(teams).values([
    {
      assetPath: "/team-marks/arsenal.png",
      displayName: "Arsenal",
      id: arsenalTeamId,
      seasonId,
      shortName: "Arsenal",
      slug: `arsenal-${suffix}`,
      sortName: "Arsenal",
    },
    {
      assetPath: "/team-marks/manchester-city.png",
      displayName: "Manchester City",
      id: cityTeamId,
      seasonId,
      shortName: "Man City",
      slug: `manchester-city-${suffix}`,
      sortName: "Manchester City",
    },
  ]);
  await db.insert(players).values([
    {
      displayName: `Erling Haaland ${suffix}`,
      id: haalandId,
      seasonId,
      slug: `erling-haaland-${suffix}`,
      sortName: `Haaland Erling ${suffix}`,
      teamId: cityTeamId,
    },
    {
      displayName: `Mohamed Salah ${suffix}`,
      id: salahId,
      seasonId,
      slug: `mohamed-salah-${suffix}`,
      sortName: `Salah Mohamed ${suffix}`,
    },
    {
      displayName: `Callum Wilson ${suffix}`,
      id: wilsonId,
      seasonId,
      slug: `callum-wilson-${suffix}`,
      sortName: `Wilson Callum ${suffix}`,
    },
  ]);
  await db.insert(predictions).values([
    {
      id: firstPredictionId,
      normalizedParticipantName: `seed one ${suffix}`,
      participantName: `Seed One ${suffix}`,
      seasonId,
    },
    {
      id: secondPredictionId,
      normalizedParticipantName: `seed two ${suffix}`,
      participantName: `Seed Two ${suffix}`,
      seasonId,
    },
  ]);
  await db.insert(predictionCategoryPicks).values([
    {
      category: "top_scorer",
      playerId: haalandId,
      predictionId: firstPredictionId,
    },
    {
      category: "top_assister",
      playerId: salahId,
      predictionId: firstPredictionId,
    },
    {
      category: "most_clean_sheets",
      predictionId: firstPredictionId,
      teamId: arsenalTeamId,
    },
    {
      category: "underdog_player",
      playerId: haalandId,
      predictionId: firstPredictionId,
    },
    {
      category: "overrated_player",
      playerId: wilsonId,
      predictionId: firstPredictionId,
    },
    {
      category: "top_scorer",
      playerId: salahId,
      predictionId: secondPredictionId,
    },
    {
      category: "top_assister",
      playerId: salahId,
      predictionId: secondPredictionId,
    },
    {
      category: "most_clean_sheets",
      predictionId: secondPredictionId,
      teamId: cityTeamId,
    },
    {
      category: "underdog_player",
      playerId: wilsonId,
      predictionId: secondPredictionId,
    },
    {
      category: "overrated_player",
      playerId: haalandId,
      predictionId: secondPredictionId,
    },
  ]);
});

afterEach(async () => {
  if (!enabled || !seasonId) return;
  await getDb().delete(seasons).where(eq(seasons.id, seasonId));
  seasonId = "";
});

describe.runIf(enabled)("getPickedSubjectsByDataset", () => {
  it("returns the union of picked subjects per dataset without duplicates", async () => {
    const picked = await getPickedSubjectsByDataset(seasonId);
    expect([...picked.goals].sort()).toEqual([haalandId, salahId].sort());
    expect(picked.assists).toEqual([salahId]);
    expect([...picked.clean_sheets].sort()).toEqual(
      [arsenalTeamId, cityTeamId].sort(),
    );
    expect([...picked.player_ratings].sort()).toEqual(
      [haalandId, wilsonId].sort(),
    );
  });

  it("excludes Other-player spellings that have no resolved player id", async () => {
    const predictionId = randomUUID();
    await getDb()
      .insert(predictions)
      .values({
        id: predictionId,
        normalizedParticipantName: `seed other ${predictionId.slice(0, 8)}`,
        participantName: `Seed Other ${predictionId.slice(0, 8)}`,
        seasonId,
      });
    await getDb().insert(predictionCategoryPicks).values({
      category: "top_scorer",
      customPlayerName: "Zlatan",
      normalizedCustomPlayerName: "zlatan",
      predictionId,
    });

    const picked = await getPickedSubjectsByDataset(seasonId);
    expect(picked.goals).not.toContain("zlatan");
    expect([...picked.goals].sort()).toEqual([haalandId, salahId].sort());
  });
});
