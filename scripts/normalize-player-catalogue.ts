import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PLAYER_CATALOGUE_EXPECTATIONS = {
  imageCount: 580,
  missingImageCount: 7,
  playerCount: 587,
  requireAllSourceTeams: true,
} as const;

export const SOURCE_TEAM_SLUG_MAP = {
  "afc-bournemouth": "afc-bournemouth",
  "afc-sunderland": "sunderland",
  "aston-villa": "aston-villa",
  "brighton-amp-hove-albion": "brighton-and-hove-albion",
  "coventry-city": "coventry-city",
  "crystal-palace": "crystal-palace",
  "fc-arsenal": "arsenal",
  "fc-brentford": "brentford",
  "fc-chelsea": "chelsea",
  "fc-everton": "everton",
  "fc-fulham": "fulham",
  "fc-liverpool": "liverpool",
  "hull-city": "hull-city",
  "ipswich-town": "ipswich-town",
  "leeds-united": "leeds-united",
  "manchester-city": "manchester-city",
  "manchester-united": "manchester-united",
  "newcastle-united": "newcastle-united",
  "nottingham-forest": "nottingham-forest",
  "tottenham-hotspur": "tottenham-hotspur",
} as const;

export type NormalizedPlayerSeed = {
  assetPath: `/player-faces/${string}.png` | null;
  displayName: string;
  externalId: number;
  firstName: string;
  lastName: string | null;
  slug: string;
  sortName: string;
  teamSlug: (typeof SOURCE_TEAM_SLUG_MAP)[keyof typeof SOURCE_TEAM_SLUG_MAP];
};

type CatalogueExpectations = {
  imageCount: number;
  missingImageCount: number;
  playerCount: number;
  requireAllSourceTeams: boolean;
};

function fail(message: string): never {
  throw new Error(`Player catalogue validation failed: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(
  row: Record<string, unknown>,
  field: string,
  rowNumber: number,
): string {
  const value = row[field];
  if (typeof value !== "string") {
    fail(`row ${rowNumber} has a non-string ${field}.`);
  }
  return value;
}

function normalizeDisplayName(value: string, rowNumber: number): string {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (normalized.length < 2 || normalized.length > 120) {
    fail(`row ${rowNumber} has an invalid player_name length.`);
  }
  return normalized;
}

function normalizedNameKey(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-GB");
}

function parseExternalId(value: unknown, rowNumber: number): number {
  const serialized = typeof value === "number" ? String(value) : value;
  if (typeof serialized !== "string" || !/^[1-9]\d*$/u.test(serialized)) {
    fail(`row ${rowNumber} has an invalid tm_player_id.`);
  }
  const externalId = Number(serialized);
  if (!Number.isSafeInteger(externalId) || externalId <= 0) {
    fail(`row ${rowNumber} has an unsafe tm_player_id.`);
  }
  return externalId;
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/ß/gu, "ss")
    .replace(/[øØ]/gu, "o")
    .replace(/[đĐðÐ]/gu, "d")
    .replace(/[þÞ]/gu, "th")
    .replace(/[łŁ]/gu, "l")
    .replace(/[æÆ]/gu, "ae")
    .replace(/[œŒ]/gu, "oe")
    .toLocaleLowerCase("en-GB")
    .replace(/[’']/gu, "")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function compareText(left: string, right: string): number {
  const normalizedLeft = normalizedNameKey(left);
  const normalizedRight = normalizedNameKey(right);
  return normalizedLeft < normalizedRight
    ? -1
    : normalizedLeft > normalizedRight
      ? 1
      : 0;
}

export function normalizePlayerCatalogue(
  source: unknown,
  imageFileNames: ReadonlySet<string>,
  expectations: CatalogueExpectations = PLAYER_CATALOGUE_EXPECTATIONS,
): readonly NormalizedPlayerSeed[] {
  if (!Array.isArray(source)) {
    fail("players_final.json must contain an array.");
  }
  if (source.length !== expectations.playerCount) {
    fail(
      `expected ${expectations.playerCount} players, received ${source.length}.`,
    );
  }
  if (imageFileNames.size !== expectations.imageCount) {
    fail(
      `expected ${expectations.imageCount} source PNGs, received ${imageFileNames.size}.`,
    );
  }

  const externalIds = new Set<number>();
  const nameKeys = new Set<string>();
  const playerSlugs = new Set<string>();
  const referencedImages = new Set<string>();
  const seenSourceTeams = new Set<string>();
  let missingImageCount = 0;

  const players = source.map((rawRow, index): NormalizedPlayerSeed => {
    const rowNumber = index + 1;
    if (!isRecord(rawRow)) {
      fail(`row ${rowNumber} is not an object.`);
    }

    const displayName = normalizeDisplayName(
      readString(rawRow, "player_name", rowNumber),
      rowNumber,
    );
    const nameKey = normalizedNameKey(displayName);
    if (nameKeys.has(nameKey)) {
      fail(`row ${rowNumber} duplicates player name ${displayName}.`);
    }
    nameKeys.add(nameKey);

    const externalId = parseExternalId(rawRow.tm_player_id, rowNumber);
    if (externalIds.has(externalId)) {
      fail(`row ${rowNumber} duplicates tm_player_id ${externalId}.`);
    }
    externalIds.add(externalId);

    const sourceTeamSlug = readString(rawRow, "club_slug", rowNumber).trim();
    if (!(sourceTeamSlug in SOURCE_TEAM_SLUG_MAP)) {
      fail(`row ${rowNumber} uses unknown club_slug ${sourceTeamSlug}.`);
    }
    seenSourceTeams.add(sourceTeamSlug);
    const teamSlug =
      SOURCE_TEAM_SLUG_MAP[sourceTeamSlug as keyof typeof SOURCE_TEAM_SLUG_MAP];

    const words = displayName.split(" ");
    const firstName = words[0];
    if (!firstName) {
      fail(`row ${rowNumber} has no searchable first name.`);
    }
    const lastName = words.length > 1 ? words.slice(1).join(" ") : null;
    if (firstName.length > 80 || (lastName?.length ?? 0) > 80) {
      fail(`row ${rowNumber} exceeds the first-name or last-name limit.`);
    }
    const sortName = lastName ? `${lastName}, ${firstName}` : firstName;
    if (sortName.length > 120) {
      fail(`row ${rowNumber} exceeds the sort-name limit.`);
    }

    const slug = `${slugify(displayName) || "player"}-${externalId}`;
    if (slug.length > 96 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) {
      fail(`row ${rowNumber} cannot produce a valid player slug.`);
    }
    if (playerSlugs.has(slug)) {
      fail(`row ${rowNumber} duplicates generated slug ${slug}.`);
    }
    playerSlugs.add(slug);

    const imageFound = readString(rawRow, "image_found", rowNumber).trim();
    const imageFilename = readString(
      rawRow,
      "image_filename",
      rowNumber,
    ).trim();
    let assetPath: NormalizedPlayerSeed["assetPath"] = null;

    if (imageFound === "Yes") {
      if (
        imageFilename.length === 0 ||
        basename(imageFilename) !== imageFilename ||
        !/^[a-z0-9_]+\.png$/u.test(imageFilename)
      ) {
        fail(`row ${rowNumber} has an unsafe image_filename.`);
      }
      if (!imageFileNames.has(imageFilename)) {
        fail(`row ${rowNumber} references missing PNG ${imageFilename}.`);
      }
      if (referencedImages.has(imageFilename)) {
        fail(`row ${rowNumber} duplicates PNG ${imageFilename}.`);
      }
      referencedImages.add(imageFilename);
      assetPath =
        `/player-faces/${imageFilename}` as NormalizedPlayerSeed["assetPath"];
    } else if (imageFound === "No") {
      if (imageFilename.length > 0) {
        fail(`row ${rowNumber} marks a missing image but names a file.`);
      }
      missingImageCount += 1;
    } else {
      fail(`row ${rowNumber} has invalid image_found value ${imageFound}.`);
    }

    return {
      assetPath,
      displayName,
      externalId,
      firstName,
      lastName,
      slug,
      sortName,
      teamSlug,
    };
  });

  if (missingImageCount !== expectations.missingImageCount) {
    fail(
      `expected ${expectations.missingImageCount} missing portraits, received ${missingImageCount}.`,
    );
  }
  if (referencedImages.size !== expectations.imageCount) {
    fail(
      `expected ${expectations.imageCount} referenced portraits, received ${referencedImages.size}.`,
    );
  }
  for (const imageFileName of imageFileNames) {
    if (!referencedImages.has(imageFileName)) {
      fail(`source PNG ${imageFileName} is not referenced by the catalogue.`);
    }
  }

  if (expectations.requireAllSourceTeams) {
    const expectedSourceTeams = Object.keys(SOURCE_TEAM_SLUG_MAP);
    if (
      seenSourceTeams.size !== expectedSourceTeams.length ||
      expectedSourceTeams.some((slug) => !seenSourceTeams.has(slug))
    ) {
      fail("the catalogue does not cover all 20 mapped source clubs.");
    }
  }

  return players.toSorted(
    (left, right) =>
      compareText(left.teamSlug, right.teamSlug) ||
      compareText(left.sortName, right.sortName) ||
      left.externalId - right.externalId,
  );
}

function serializeFixture(players: readonly NormalizedPlayerSeed[]): string {
  return `${JSON.stringify(players, null, 2)}\n`;
}

export function validateNormalizedPlayerFixture(
  source: unknown,
  publishedImageFileNames: ReadonlySet<string>,
): readonly NormalizedPlayerSeed[] {
  if (!Array.isArray(source)) {
    fail("the tracked player fixture must contain an array.");
  }
  if (source.length !== PLAYER_CATALOGUE_EXPECTATIONS.playerCount) {
    fail(
      `expected ${PLAYER_CATALOGUE_EXPECTATIONS.playerCount} tracked players, received ${source.length}.`,
    );
  }
  if (
    publishedImageFileNames.size !== PLAYER_CATALOGUE_EXPECTATIONS.imageCount
  ) {
    fail(
      `expected ${PLAYER_CATALOGUE_EXPECTATIONS.imageCount} published PNGs, received ${publishedImageFileNames.size}.`,
    );
  }

  const externalIds = new Set<number>();
  const nameKeys = new Set<string>();
  const playerSlugs = new Set<string>();
  const referencedImages = new Set<string>();
  const canonicalTeamSlugs = new Set<string>(
    Object.values(SOURCE_TEAM_SLUG_MAP),
  );
  const seenTeamSlugs = new Set<string>();
  let missingImageCount = 0;

  const players = source.map((rawRow, index): NormalizedPlayerSeed => {
    const rowNumber = index + 1;
    if (!isRecord(rawRow)) {
      fail(`tracked row ${rowNumber} is not an object.`);
    }

    const displayName = normalizeDisplayName(
      readString(rawRow, "displayName", rowNumber),
      rowNumber,
    );
    const nameKey = normalizedNameKey(displayName);
    if (nameKeys.has(nameKey)) {
      fail(`tracked row ${rowNumber} duplicates player name ${displayName}.`);
    }
    nameKeys.add(nameKey);

    const externalId = parseExternalId(rawRow.externalId, rowNumber);
    if (externalIds.has(externalId)) {
      fail(`tracked row ${rowNumber} duplicates externalId ${externalId}.`);
    }
    externalIds.add(externalId);

    const firstName = readString(rawRow, "firstName", rowNumber);
    const lastNameValue = rawRow.lastName;
    const lastName = lastNameValue === null ? null : lastNameValue;
    if (
      firstName.length === 0 ||
      firstName.length > 80 ||
      (lastName !== null &&
        (typeof lastName !== "string" ||
          lastName.length === 0 ||
          lastName.length > 80))
    ) {
      fail(`tracked row ${rowNumber} has invalid searchable name parts.`);
    }

    const slug = readString(rawRow, "slug", rowNumber);
    if (
      slug.length > 96 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug) ||
      playerSlugs.has(slug)
    ) {
      fail(`tracked row ${rowNumber} has an invalid or duplicate slug.`);
    }
    playerSlugs.add(slug);

    const sortName = readString(rawRow, "sortName", rowNumber);
    if (sortName.length === 0 || sortName.length > 120) {
      fail(`tracked row ${rowNumber} has an invalid sortName.`);
    }

    const teamSlug = readString(rawRow, "teamSlug", rowNumber);
    if (!canonicalTeamSlugs.has(teamSlug)) {
      fail(`tracked row ${rowNumber} has unknown teamSlug ${teamSlug}.`);
    }
    seenTeamSlugs.add(teamSlug);

    const assetPathValue = rawRow.assetPath;
    let assetPath: NormalizedPlayerSeed["assetPath"] = null;
    if (assetPathValue === null) {
      missingImageCount += 1;
    } else if (typeof assetPathValue === "string") {
      const match = /^\/player-faces\/([a-z0-9_]+\.png)$/u.exec(assetPathValue);
      const imageFileName = match?.[1];
      if (
        !imageFileName ||
        !publishedImageFileNames.has(imageFileName) ||
        referencedImages.has(imageFileName)
      ) {
        fail(`tracked row ${rowNumber} has an invalid portrait reference.`);
      }
      referencedImages.add(imageFileName);
      assetPath = assetPathValue as NormalizedPlayerSeed["assetPath"];
    } else {
      fail(`tracked row ${rowNumber} has an invalid assetPath.`);
    }

    return {
      assetPath,
      displayName,
      externalId,
      firstName,
      lastName,
      slug,
      sortName,
      teamSlug: teamSlug as NormalizedPlayerSeed["teamSlug"],
    };
  });

  if (
    missingImageCount !== PLAYER_CATALOGUE_EXPECTATIONS.missingImageCount ||
    referencedImages.size !== PLAYER_CATALOGUE_EXPECTATIONS.imageCount
  ) {
    fail(
      "the tracked fixture does not preserve the 580 portrait / 7 fallback split.",
    );
  }
  if (
    seenTeamSlugs.size !== canonicalTeamSlugs.size ||
    [...canonicalTeamSlugs].some((slug) => !seenTeamSlugs.has(slug))
  ) {
    fail("the tracked fixture does not cover all 20 canonical clubs.");
  }
  for (const imageFileName of publishedImageFileNames) {
    if (!referencedImages.has(imageFileName)) {
      fail(`published PNG ${imageFileName} is not referenced by the fixture.`);
    }
  }

  const sortedPlayers = players.toSorted(
    (left, right) =>
      compareText(left.teamSlug, right.teamSlug) ||
      compareText(left.sortName, right.sortName) ||
      left.externalId - right.externalId,
  );
  if (
    players.some(
      (player, index) => player.externalId !== sortedPlayers[index]?.externalId,
    )
  ) {
    fail("the tracked fixture is not in deterministic order.");
  }

  return players;
}

async function listPngFileNames(directory: string): Promise<Set<string>> {
  const entries = await readdir(directory, { withFileTypes: true });
  return new Set(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".png"))
      .map((entry) => entry.name),
  );
}

async function verifyPublishedAssets(
  destinationDirectory: string,
  expectedFileNames: ReadonlySet<string>,
  sourceDirectory?: string,
): Promise<void> {
  const publishedFileNames = await listPngFileNames(destinationDirectory);
  if (
    publishedFileNames.size !== expectedFileNames.size ||
    [...expectedFileNames].some((name) => !publishedFileNames.has(name))
  ) {
    fail("public/player-faces does not contain exactly the referenced PNGs.");
  }

  for (const fileName of expectedFileNames) {
    const publishedBytes = await readFile(join(destinationDirectory, fileName));
    const pngSignature = publishedBytes.subarray(0, 8).toString("hex");
    if (pngSignature !== "89504e470d0a1a0a") {
      fail(`published portrait ${fileName} is not a valid PNG.`);
    }
    if (
      sourceDirectory &&
      !(await readFile(join(sourceDirectory, fileName))).equals(publishedBytes)
    ) {
      fail(`published portrait ${fileName} differs from its source.`);
    }
  }
}

export async function runPlayerCatalogueNormalizer(
  mode: "check" | "write",
): Promise<readonly NormalizedPlayerSeed[]> {
  const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const sourceDirectory = join(
    repositoryRoot,
    "premier-league-players-2026-08-08",
  );
  const sourceImageDirectory = join(sourceDirectory, "images");
  const sourceJsonPath = join(
    sourceDirectory,
    "scripts",
    "data",
    "players_final.json",
  );
  const fixturePath = join(
    repositoryRoot,
    "src",
    "data",
    "players-2026-27.json",
  );
  const destinationImageDirectory = join(
    repositoryRoot,
    "public",
    "player-faces",
  );

  if (mode === "check") {
    const [trackedFixture, publishedImageFileNames] = await Promise.all([
      readFile(fixturePath, "utf8"),
      listPngFileNames(destinationImageDirectory),
    ]);
    const players = validateNormalizedPlayerFixture(
      JSON.parse(trackedFixture) as unknown,
      publishedImageFileNames,
    );
    if (trackedFixture !== serializeFixture(players)) {
      fail("src/data/players-2026-27.json is not compact and deterministic.");
    }
    await verifyPublishedAssets(
      destinationImageDirectory,
      publishedImageFileNames,
    );
    return players;
  }

  const [sourceJson, sourceImageFileNames] = await Promise.all([
    readFile(sourceJsonPath, "utf8"),
    listPngFileNames(sourceImageDirectory),
  ]);
  const players = normalizePlayerCatalogue(
    JSON.parse(sourceJson) as unknown,
    sourceImageFileNames,
  );
  const serializedFixture = serializeFixture(players);

  await mkdir(destinationImageDirectory, { recursive: true });
  const existingPngFileNames = await listPngFileNames(
    destinationImageDirectory,
  );
  const unexpectedPublishedImages = [...existingPngFileNames].filter(
    (fileName) => !sourceImageFileNames.has(fileName),
  );
  if (unexpectedPublishedImages.length > 0) {
    fail(
      `public/player-faces contains unreferenced PNGs: ${unexpectedPublishedImages.join(", ")}.`,
    );
  }

  await writeFile(fixturePath, serializedFixture, "utf8");
  for (const fileName of sourceImageFileNames) {
    await copyFile(
      join(sourceImageDirectory, fileName),
      join(destinationImageDirectory, fileName),
    );
  }
  await verifyPublishedAssets(
    destinationImageDirectory,
    sourceImageFileNames,
    sourceImageDirectory,
  );
  return players;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== "--check") || args.length > 1) {
    throw new Error("Usage: players:generate [--check]");
  }
  const mode = args.includes("--check") ? "check" : "write";
  const players = await runPlayerCatalogueNormalizer(mode);
  const portraitCount = players.filter(
    (player) => player.assetPath !== null,
  ).length;
  process.stdout.write(
    `${mode === "check" ? "Verified" : "Generated"} ${players.length} players, ${portraitCount} portraits, and ${players.length - portraitCount} silhouette fallbacks.\n`,
  );
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(resolve(entryPoint)).href) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown catalogue error";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
