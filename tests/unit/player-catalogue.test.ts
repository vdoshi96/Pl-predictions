import { existsSync } from "node:fs";
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import {
  PREMIER_LEAGUE_2026_27_PLAYER_COUNT,
  PREMIER_LEAGUE_2026_27_PLAYER_PORTRAIT_COUNT,
  PREMIER_LEAGUE_2026_27_PLAYERS,
  PREMIER_LEAGUE_2026_27_TEAMS,
} from "@/data";
import {
  normalizePlayerCatalogue,
  PLAYER_CATALOGUE_DELTA_EXPECTATIONS,
  PLAYER_PORTRAIT_EXPECTATIONS,
  publishValidatedCatalogue,
  runPlayerCatalogueNormalizer,
  SOURCE_TEAM_SLUG_MAP,
  validateNormalizedPlayerFixture,
  verifyPlayerCatalogueDelta,
  verifyPlayerPortraits,
  verifyReviewedPlayerDeltaIdentity,
} from "../../scripts/normalize-player-catalogue";
import { buildPlayerSeedValues } from "../../scripts/seed";

const temporaryDirectories: string[] = [];
const previousHandoffRoot = join(
  process.cwd(),
  "premier-league-players-2026-08-08",
);
const currentHandoffRoot = join(
  process.cwd(),
  "premier-league-players-2026-08-13",
);
const privateHandoffsAvailable =
  existsSync(previousHandoffRoot) && existsSync(currentHandoffRoot);

async function createTemporaryDirectory(label: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), label));
  temporaryDirectories.push(directory);
  return directory;
}

async function createCleanCloneCatalogueRepository(
  label: string,
): Promise<string> {
  const repository = await createTemporaryDirectory(label);
  await Promise.all([
    mkdir(join(repository, "src/data"), { recursive: true }),
    mkdir(join(repository, "public"), { recursive: true }),
  ]);
  await Promise.all([
    copyFile(
      join(process.cwd(), "src/data/players-2026-27.json"),
      join(repository, "src/data/players-2026-27.json"),
    ),
    cp(
      join(process.cwd(), "public/player-faces"),
      join(repository, "public/player-faces"),
      { recursive: true },
    ),
  ]);
  return repository;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("normalized 2026/27 player catalogue", () => {
  it("contains the exact reviewed roster and portrait coverage", () => {
    expect(PREMIER_LEAGUE_2026_27_PLAYERS).toHaveLength(
      PREMIER_LEAGUE_2026_27_PLAYER_COUNT,
    );
    expect(
      new Set(
        PREMIER_LEAGUE_2026_27_PLAYERS.map((player) => player.externalId),
      ),
    ).toHaveLength(PREMIER_LEAGUE_2026_27_PLAYER_COUNT);
    expect(
      PREMIER_LEAGUE_2026_27_PLAYERS.every(
        (player) =>
          Number.isSafeInteger(player.externalId) && player.externalId > 0,
      ),
    ).toBe(true);
    expect(
      new Set(
        PREMIER_LEAGUE_2026_27_PLAYERS.map((player) =>
          player.displayName.normalize("NFKC").toLocaleLowerCase("en-GB"),
        ),
      ),
    ).toHaveLength(PREMIER_LEAGUE_2026_27_PLAYER_COUNT);

    const portraits = PREMIER_LEAGUE_2026_27_PLAYERS.filter(
      (player) => player.assetPath !== null,
    );
    const fallbacks = PREMIER_LEAGUE_2026_27_PLAYERS.filter(
      (player) => player.assetPath === null,
    );
    expect(portraits).toHaveLength(
      PREMIER_LEAGUE_2026_27_PLAYER_PORTRAIT_COUNT,
    );
    expect(new Set(portraits.map((player) => player.assetPath))).toHaveLength(
      PREMIER_LEAGUE_2026_27_PLAYER_PORTRAIT_COUNT,
    );
    expect(
      portraits.every(
        (player) =>
          player.assetPath !== null &&
          existsSync(join(process.cwd(), "public", player.assetPath.slice(1))),
      ),
    ).toBe(true);
    expect(fallbacks.map((player) => player.displayName).toSorted()).toEqual(
      [],
    );
  });

  it("fully decodes the exact public portrait set with unique SHA-256 digests", async () => {
    const result = await runPlayerCatalogueNormalizer("check");

    expect(result.players).toHaveLength(PREMIER_LEAGUE_2026_27_PLAYER_COUNT);
    expect(result.portraits).toMatchObject({
      format: PLAYER_PORTRAIT_EXPECTATIONS.format,
      height: PLAYER_PORTRAIT_EXPECTATIONS.height,
      imageCount: PREMIER_LEAGUE_2026_27_PLAYER_PORTRAIT_COUNT,
      minimumByteCount: expect.any(Number),
      uniquePixelSha256Count: PREMIER_LEAGUE_2026_27_PLAYER_PORTRAIT_COUNT,
      uniqueSha256Count: PREMIER_LEAGUE_2026_27_PLAYER_PORTRAIT_COUNT,
      width: PLAYER_PORTRAIT_EXPECTATIONS.width,
    });
    expect(result.portraits.sha256ByFileName.size).toBe(
      PREMIER_LEAGUE_2026_27_PLAYER_PORTRAIT_COUNT,
    );
    expect(result.portraits.pixelSha256ByFileName.size).toBe(
      PREMIER_LEAGUE_2026_27_PLAYER_PORTRAIT_COUNT,
    );
    expect(result.portraits.minimumByteCount).toBeGreaterThanOrEqual(
      PLAYER_PORTRAIT_EXPECTATIONS.minimumByteCount,
    );
    expect(result.sourceHandoffReconciled).toBe(privateHandoffsAvailable);
  }, 15_000);

  it.runIf(privateHandoffsAvailable)(
    "matches the reviewed 12/17/4/7/10 handoff transition",
    async () => {
      const [previousSource, currentSource] = await Promise.all([
        readFile(
          join(previousHandoffRoot, "scripts/data/players_final.json"),
          "utf8",
        ),
        readFile(
          join(currentHandoffRoot, "scripts/data/players_final.json"),
          "utf8",
        ),
      ]);
      const summary = await verifyPlayerCatalogueDelta(
        JSON.parse(previousSource) as unknown,
        JSON.parse(currentSource) as unknown,
        join(previousHandoffRoot, "images"),
        join(currentHandoffRoot, "images"),
      );

      expect(summary).toEqual({
        addedCount: PLAYER_CATALOGUE_DELTA_EXPECTATIONS.addedCount,
        currentPlayerCount: PREMIER_LEAGUE_2026_27_PLAYER_COUNT,
        movedCount: PLAYER_CATALOGUE_DELTA_EXPECTATIONS.movedCount,
        nameChangedCount: 0,
        positionChangedCount: 0,
        previousPlayerCount:
          PLAYER_CATALOGUE_DELTA_EXPECTATIONS.previousPlayerCount,
        removedCount: PLAYER_CATALOGUE_DELTA_EXPECTATIONS.removedCount,
        replacedPortraitCount:
          PLAYER_CATALOGUE_DELTA_EXPECTATIONS.replacedPortraitCount,
        restoredPortraitCount:
          PLAYER_CATALOGUE_DELTA_EXPECTATIONS.restoredPortraitCount,
      });
    },
  );

  it("maps all source clubs to the canonical 20-team fixture", () => {
    expect(Object.keys(SOURCE_TEAM_SLUG_MAP)).toHaveLength(20);
    expect(new Set(Object.values(SOURCE_TEAM_SLUG_MAP))).toEqual(
      new Set(PREMIER_LEAGUE_2026_27_TEAMS.map((team) => team.slug)),
    );
    expect(
      new Set(PREMIER_LEAGUE_2026_27_PLAYERS.map((player) => player.teamSlug)),
    ).toEqual(new Set(PREMIER_LEAGUE_2026_27_TEAMS.map((team) => team.slug)));
  });

  it("builds active seed rows with canonical team IDs and null fallbacks", () => {
    const teamIdBySlug = new Map(
      PREMIER_LEAGUE_2026_27_TEAMS.map((team) => [
        team.slug,
        `team:${team.slug}`,
      ]),
    );
    const rows = buildPlayerSeedValues("season:2026-27", teamIdBySlug);

    expect(rows).toHaveLength(PREMIER_LEAGUE_2026_27_PLAYER_COUNT);
    expect(rows.every((row) => row.isActive)).toBe(true);
    expect(rows.filter((row) => row.assetPath === null)).toHaveLength(0);
    expect(rows.every((row) => row.teamId.startsWith("team:"))).toBe(true);
    expect(rows.find((row) => row.displayName === "Bukayo Saka")).toMatchObject(
      {
        assetPath: "/player-faces/fc_arsenal_saka_bukayo.png",
        teamId: "team:arsenal",
      },
    );
    expect(rows.find((row) => row.displayName === "Alysson")).toMatchObject({
      assetPath: "/player-faces/aston_villa_alysson_alysson.png",
      teamId: "team:aston-villa",
    });
    expect(
      rows.find((row) => row.displayName === "Ronald Araujo"),
    ).toMatchObject({
      assetPath: "/player-faces/fc_liverpool_araujo_ronald.png",
      teamId: "team:liverpool",
    });
  });

  it("fails closed when a player references an unavailable canonical team", () => {
    expect(() => buildPlayerSeedValues("season:2026-27", new Map())).toThrow(
      "references unavailable team",
    );
  });
});

describe("player catalogue normalizer", () => {
  const expectations = {
    imageCount: 1,
    missingImageCount: 1,
    playerCount: 2,
    requireAllSourceTeams: false,
  };
  const sourceRows = [
    {
      club_slug: "fc-arsenal",
      image_filename: "alex_test.png",
      image_found: "Yes",
      player_name: "  A\u0301lex   Test  ",
      tm_player_id: "7",
    },
    {
      club_slug: "aston-villa",
      image_filename: "",
      image_found: "No",
      player_name: "Alysson",
      tm_player_id: "8",
    },
  ];

  it("normalizes names, IDs, team slugs, and missing portraits", () => {
    const players = normalizePlayerCatalogue(
      sourceRows,
      new Set(["alex_test.png"]),
      expectations,
    );

    expect(players).toEqual([
      {
        assetPath: "/player-faces/alex_test.png",
        displayName: "\u00c1lex Test",
        externalId: 7,
        firstName: "\u00c1lex",
        lastName: "Test",
        slug: "alex-test-7",
        sortName: "Test, \u00c1lex",
        teamSlug: "arsenal",
      },
      {
        assetPath: null,
        displayName: "Alysson",
        externalId: 8,
        firstName: "Alysson",
        lastName: null,
        slug: "alysson-8",
        sortName: "Alysson",
        teamSlug: "aston-villa",
      },
    ]);
  });

  it("rejects tracked searchable fields that are not derived from the player identity", () => {
    const brokenFixture = PREMIER_LEAGUE_2026_27_PLAYERS.map((player, index) =>
      index === 0
        ? { ...player, firstName: `${player.firstName} wrong` }
        : { ...player },
    );
    const publishedImageFileNames = new Set(
      PREMIER_LEAGUE_2026_27_PLAYERS.flatMap((player) =>
        player.assetPath
          ? [player.assetPath.slice("/player-faces/".length)]
          : [],
      ),
    );

    expect(() =>
      validateNormalizedPlayerFixture(brokenFixture, publishedImageFileNames),
    ).toThrow("does not match its derived searchable fields");
  });

  it("rejects a well-shaped fixture change in a clean clone", async () => {
    const repository = await createCleanCloneCatalogueRepository(
      "pl-player-release-fixture-",
    );
    const fixturePath = join(repository, "src/data/players-2026-27.json");
    const fixture = JSON.parse(await readFile(fixturePath, "utf8")) as Array<{
      externalId: number;
      slug: string;
    }>;
    const player = fixture[0];
    expect(player).toBeDefined();
    const changedExternalId = 9_000_000_001;
    player!.externalId = changedExternalId;
    player!.slug = player!.slug.replace(/-\d+$/u, `-${changedExternalId}`);
    await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`);

    await expect(
      runPlayerCatalogueNormalizer("check", repository),
    ).rejects.toThrow("tracked fixture is not the reviewed 2026-08-13 release");
  }, 15_000);

  it("rejects a valid unique 192px portrait change in a clean clone", async () => {
    const repository = await createCleanCloneCatalogueRepository(
      "pl-player-release-portrait-",
    );
    const portraitPath = join(
      repository,
      "public/player-faces/fc_arsenal_saka_bukayo.png",
    );
    const mutationPath = join(repository, "mutated-portrait.png");
    const { data, info } = await sharp(portraitPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    data[0] = data[0]! ^ 0xff;
    await sharp(data, { raw: info }).png().toFile(mutationPath);
    await rename(mutationPath, portraitPath);

    await expect(
      runPlayerCatalogueNormalizer("check", repository),
    ).rejects.toThrow(
      "published portraits are not the reviewed 2026-08-13 release",
    );
  }, 15_000);

  it("rejects duplicate positive external IDs and unreferenced images", () => {
    expect(() =>
      normalizePlayerCatalogue(
        [sourceRows[0], { ...sourceRows[1], tm_player_id: "7" }],
        new Set(["alex_test.png"]),
        expectations,
      ),
    ).toThrow("duplicates tm_player_id 7");

    expect(() =>
      normalizePlayerCatalogue(
        sourceRows,
        new Set(["different.png"]),
        expectations,
      ),
    ).toThrow("references missing PNG alex_test.png");
  });

  it("rejects same-sized but unreviewed delta identity sets", () => {
    expect(() =>
      verifyReviewedPlayerDeltaIdentity(
        "added",
        Array.from(
          { length: PLAYER_CATALOGUE_DELTA_EXPECTATIONS.addedCount },
          (_, index) => `${index + 1}\tWrong Player\tfc-arsenal\twrong.png`,
        ),
      ),
    ).toThrow("added player identity set is not the reviewed transition");
  });

  it("rejects unsafe portrait paths and non-string delta fields before reading files", async () => {
    const baseRow = {
      club_slug: "fc-arsenal",
      image_filename: "safe.png",
      image_found: "Yes",
      image_source: "fotmob",
      player_name: "Safe Player",
      position: "MID",
      tm_player_id: "1",
    };
    await expect(
      verifyPlayerCatalogueDelta(
        [{ ...baseRow, image_filename: "../outside.png" }],
        [{ ...baseRow, club_slug: "fc-chelsea" }],
        process.cwd(),
        process.cwd(),
      ),
    ).rejects.toThrow("unsafe image_filename");
    await expect(
      verifyPlayerCatalogueDelta(
        [{ ...baseRow, position: undefined }],
        [baseRow],
        process.cwd(),
        process.cwd(),
      ),
    ).rejects.toThrow("non-string position");
  });

  it("rejects missing, duplicate, and wrong portrait provenance IDs", async () => {
    const buildRows = () => {
      const current = Array.from({ length: 582 }, (_, index) => ({
        club_slug: "fc-arsenal",
        fotmob_id: 200_000 + index,
        image_filename: `current_${index}.png`,
        image_found: "Yes",
        image_source: "fotmob",
        player_name: `Current Player ${index}`,
        position: "MID",
        tm_player_id: String(index + 1),
      })) as Array<Record<string, unknown>>;
      const previous = Array.from({ length: 587 }, (_, index) => {
        const imageSource =
          index < 570 ? "fotmob" : index < 580 ? "creative_commons" : "none";
        return {
          club_slug: "fc-arsenal",
          fotmob_id: imageSource === "fotmob" ? 100_000 + index : "",
          image_filename: imageSource === "none" ? "" : `previous_${index}.png`,
          image_found: imageSource === "none" ? "No" : "Yes",
          image_source: imageSource,
          player_name: `Previous Player ${index}`,
          position: "MID",
          tm_player_id: String(index + 1),
        };
      }) as Array<Record<string, unknown>>;
      return { current, previous };
    };

    const missing = buildRows();
    delete missing.current[0]!.fotmob_id;
    await expect(
      verifyPlayerCatalogueDelta(
        missing.previous,
        missing.current,
        process.cwd(),
        process.cwd(),
      ),
    ).rejects.toThrow("invalid fotmob_id");

    const duplicateCurrent = buildRows();
    duplicateCurrent.current[1]!.fotmob_id =
      duplicateCurrent.current[0]!.fotmob_id;
    await expect(
      verifyPlayerCatalogueDelta(
        duplicateCurrent.previous,
        duplicateCurrent.current,
        process.cwd(),
        process.cwd(),
      ),
    ).rejects.toThrow("582 unique positive fotmob_id values");

    const duplicatePrevious = buildRows();
    duplicatePrevious.previous[1]!.fotmob_id =
      duplicatePrevious.previous[0]!.fotmob_id;
    await expect(
      verifyPlayerCatalogueDelta(
        duplicatePrevious.previous,
        duplicatePrevious.current,
        process.cwd(),
        process.cwd(),
      ),
    ).rejects.toThrow("570 unique positive fotmob_id values");

    const wrongSource = buildRows();
    wrongSource.current[0]!.image_source = "creative_commons";
    wrongSource.current[0]!.fotmob_id = "";
    await expect(
      verifyPlayerCatalogueDelta(
        wrongSource.previous,
        wrongSource.current,
        process.cwd(),
        process.cwd(),
      ),
    ).rejects.toThrow("exactly 582 fotmob portrait rows");
  });

  it("fails closed before mutation when write mode lacks the previous handoff", async () => {
    const repository = await createTemporaryDirectory("pl-player-write-pair-");
    await Promise.all([
      mkdir(
        join(repository, "premier-league-players-2026-08-13/scripts/data"),
        { recursive: true },
      ),
      mkdir(join(repository, "premier-league-players-2026-08-13/images"), {
        recursive: true,
      }),
      mkdir(join(repository, "src/data"), { recursive: true }),
      mkdir(join(repository, "public/player-faces"), { recursive: true }),
    ]);
    const fixturePath = join(repository, "src/data/players-2026-27.json");
    const sentinelPath = join(repository, "public/player-faces/sentinel.txt");
    await Promise.all([
      writeFile(
        join(
          repository,
          "premier-league-players-2026-08-13/scripts/data/players_final.json",
        ),
        "[]\n",
      ),
      writeFile(fixturePath, "fixture sentinel\n"),
      writeFile(sentinelPath, "portrait sentinel\n"),
    ]);

    await expect(
      runPlayerCatalogueNormalizer("write", repository),
    ).rejects.toThrow("requires the complete private 2026-08-08 handoff");
    await expect(readFile(fixturePath, "utf8")).resolves.toBe(
      "fixture sentinel\n",
    );
    await expect(readFile(sentinelPath, "utf8")).resolves.toBe(
      "portrait sentinel\n",
    );
  });

  it("rolls back both published outputs when the staged fixture swap fails", async () => {
    const repository = await createTemporaryDirectory("pl-player-rollback-");
    const sourceDirectory = join(repository, "source");
    const destinationImageDirectory = join(repository, "public/player-faces");
    const fixturePath = join(repository, "src/data/players.json");
    await Promise.all([
      mkdir(sourceDirectory, { recursive: true }),
      mkdir(destinationImageDirectory, { recursive: true }),
      mkdir(join(repository, "src/data"), { recursive: true }),
    ]);
    await Promise.all([
      copyFile(
        join(process.cwd(), "public/player-faces/fc_arsenal_saka_bukayo.png"),
        join(sourceDirectory, "portrait.png"),
      ),
      writeFile(join(destinationImageDirectory, ".gitkeep"), ""),
      writeFile(join(destinationImageDirectory, "old.txt"), "old portrait\n"),
      writeFile(fixturePath, "old fixture\n"),
    ]);

    let renameCount = 0;
    const renameWithInjectedFailure: typeof rename = async (
      oldPath,
      newPath,
    ) => {
      renameCount += 1;
      if (renameCount === 4) throw new Error("injected fixture swap failure");
      await rename(oldPath, newPath);
    };

    await expect(
      publishValidatedCatalogue({
        destinationImageDirectory,
        fixturePath,
        renameFile: renameWithInjectedFailure,
        serializedFixture: "new fixture\n",
        sourceImageDirectory: sourceDirectory,
        sourceImageFileNames: new Set(["portrait.png"]),
      }),
    ).rejects.toThrow("injected fixture swap failure");

    await expect(readFile(fixturePath, "utf8")).resolves.toBe("old fixture\n");
    await expect(readdir(destinationImageDirectory)).resolves.toEqual([
      ".gitkeep",
      "old.txt",
    ]);
    await expect(readdir(join(repository, "public"))).resolves.toEqual([
      "player-faces",
    ]);
    await expect(readdir(join(repository, "src/data"))).resolves.toEqual([
      "players.json",
    ]);
  });

  it.runIf(privateHandoffsAvailable)(
    "preflights every source portrait before mutating tracked outputs",
    async () => {
      const repository = await createTemporaryDirectory(
        "pl-player-write-preflight-",
      );
      const currentTarget = join(
        repository,
        "premier-league-players-2026-08-13",
      );
      const previousTarget = join(
        repository,
        "premier-league-players-2026-08-08",
      );
      await Promise.all([
        mkdir(join(currentTarget, "scripts/data"), { recursive: true }),
        mkdir(join(previousTarget, "scripts/data"), { recursive: true }),
        mkdir(join(repository, "src/data"), { recursive: true }),
        mkdir(join(repository, "public/player-faces"), { recursive: true }),
      ]);
      await Promise.all([
        copyFile(
          join(currentHandoffRoot, "scripts/data/players_final.json"),
          join(currentTarget, "scripts/data/players_final.json"),
        ),
        copyFile(
          join(previousHandoffRoot, "scripts/data/players_final.json"),
          join(previousTarget, "scripts/data/players_final.json"),
        ),
        cp(join(currentHandoffRoot, "images"), join(currentTarget, "images"), {
          recursive: true,
        }),
        cp(
          join(previousHandoffRoot, "images"),
          join(previousTarget, "images"),
          { recursive: true },
        ),
      ]);
      const currentSource = JSON.parse(
        await readFile(
          join(currentTarget, "scripts/data/players_final.json"),
          "utf8",
        ),
      ) as Array<{ image_filename: string }>;
      const corruptFileName = currentSource[0]?.image_filename;
      expect(corruptFileName).toBeTruthy();
      await writeFile(
        join(currentTarget, "images", corruptFileName!),
        Buffer.from("89504e470d0a1a0a", "hex"),
      );

      const fixturePath = join(repository, "src/data/players-2026-27.json");
      const sentinelPath = join(repository, "public/player-faces/sentinel.txt");
      await Promise.all([
        writeFile(fixturePath, "fixture sentinel\n"),
        writeFile(sentinelPath, "portrait sentinel\n"),
      ]);

      await expect(
        runPlayerCatalogueNormalizer("write", repository),
      ).rejects.toThrow("cannot be decoded");
      await expect(readFile(fixturePath, "utf8")).resolves.toBe(
        "fixture sentinel\n",
      );
      await expect(
        readdir(join(repository, "public/player-faces")),
      ).resolves.toEqual(["sentinel.txt"]);
    },
  );

  it("rejects corrupt, incorrectly sized, and duplicate portrait pixels", async () => {
    const corruptDirectory =
      await createTemporaryDirectory("pl-player-corrupt-");
    await writeFile(
      join(corruptDirectory, "corrupt.png"),
      Buffer.from("89504e470d0a1a0a", "hex"),
    );
    await expect(
      verifyPlayerPortraits(corruptDirectory, new Set(["corrupt.png"])),
    ).rejects.toThrow("cannot be decoded");

    const wrongSizeDirectory =
      await createTemporaryDirectory("pl-player-size-");
    await sharp({
      create: {
        background: { alpha: 1, b: 0, g: 0, r: 0 },
        channels: 4,
        height: 1,
        width: 1,
      },
    })
      .png()
      .toFile(join(wrongSizeDirectory, "wrong_size.png"));
    await expect(
      verifyPlayerPortraits(wrongSizeDirectory, new Set(["wrong_size.png"])),
    ).rejects.toThrow("must be a 192x192 PNG");

    const placeholderDirectory = await createTemporaryDirectory(
      "pl-player-placeholder-",
    );
    await sharp({
      create: {
        background: { alpha: 1, b: 255, g: 255, r: 255 },
        channels: 4,
        height: PLAYER_PORTRAIT_EXPECTATIONS.height,
        width: PLAYER_PORTRAIT_EXPECTATIONS.width,
      },
    })
      .png()
      .toFile(join(placeholderDirectory, "placeholder.png"));
    await expect(
      verifyPlayerPortraits(placeholderDirectory, new Set(["placeholder.png"])),
    ).rejects.toThrow("placeholder rejection floor");

    const duplicateDirectory = await createTemporaryDirectory(
      "pl-player-duplicate-",
    );
    const sourcePortrait = join(
      process.cwd(),
      "public/player-faces/fc_arsenal_saka_bukayo.png",
    );
    await Promise.all([
      copyFile(sourcePortrait, join(duplicateDirectory, "one.png")),
      copyFile(sourcePortrait, join(duplicateDirectory, "two.png")),
    ]);
    await expect(
      verifyPlayerPortraits(
        duplicateDirectory,
        new Set(["one.png", "two.png"]),
      ),
    ).rejects.toThrow("duplicates the SHA-256 digest of one.png");

    const reencodedDuplicateDirectory = await createTemporaryDirectory(
      "pl-player-reencoded-duplicate-",
    );
    await Promise.all([
      copyFile(sourcePortrait, join(reencodedDuplicateDirectory, "one.png")),
      sharp(sourcePortrait)
        .png({ compressionLevel: 0 })
        .toFile(join(reencodedDuplicateDirectory, "two.png")),
    ]);
    await expect(
      verifyPlayerPortraits(
        reencodedDuplicateDirectory,
        new Set(["one.png", "two.png"]),
      ),
    ).rejects.toThrow("duplicates decoded pixels from one.png");
  });
});
