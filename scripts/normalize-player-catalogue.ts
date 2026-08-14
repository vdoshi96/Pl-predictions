import { createHash } from "node:crypto";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp, { type Metadata } from "sharp";

export const PLAYER_CATALOGUE_EXPECTATIONS = {
  imageCount: 582,
  missingImageCount: 0,
  playerCount: 582,
  requireAllSourceTeams: true,
} as const;

export const PLAYER_PORTRAIT_EXPECTATIONS = {
  format: "png",
  height: 192,
  minimumByteCount: 3_000,
  width: 192,
} as const;

export const PLAYER_CATALOGUE_RELEASE_EXPECTATIONS = {
  fixtureSha256:
    "2f0c3b083f43504c29242212c0a0e462c85818f5d8057de9309ea1031315cde9",
  portraitFingerprintSha256:
    "b29f5b1496a73b924d39d1cd6e67c8e5b1b80c7dc649104c25a740b3e2a85785",
} as const;

const PREVIOUS_PLAYER_CATALOGUE_EXPECTATIONS = {
  imageCount: 580,
  missingImageCount: 7,
  playerCount: 587,
  requireAllSourceTeams: true,
} as const;

export const PLAYER_CATALOGUE_DELTA_EXPECTATIONS = {
  addedCount: 12,
  identitySha256: {
    added: "1c9d2cb6a190928f112fc5f9794c4fd1424825ae4284642c8188593864aa839f",
    moved: "7f6df782befb01279cc5a041ff5fef97e2dd3fa9f5448eff9a46bbf97a30c496",
    removed: "a6e94f3b6522a3687091399c74dc0cfbeb94b7d95e6d0c6a441859205c45c37e",
    replaced:
      "432edbdc0c99c8b7f9f758c3517444fac5fa502f574ec3324b2e66377a4b8ad5",
    restored:
      "084f3803ff2dceffb5223af3a077e835f27f68293cf5b729ffa4f4299033cc92",
  },
  movedCount: 4,
  previousPlayerCount: 587,
  removedCount: 17,
  replacedPortraitCount: 10,
  restoredPortraitCount: 7,
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

type DeltaPlayerRow = {
  clubSlug: string;
  externalId: number;
  fotmobId: number | null;
  imageFilename: string;
  imageFound: "No" | "Yes";
  imageSource: string;
  playerName: string;
  position: string;
};

export type PlayerCatalogueDeltaSummary = {
  addedCount: number;
  currentPlayerCount: number;
  movedCount: number;
  nameChangedCount: number;
  positionChangedCount: number;
  previousPlayerCount: number;
  removedCount: number;
  replacedPortraitCount: number;
  restoredPortraitCount: number;
};

export type PlayerPortraitVerification = {
  format: typeof PLAYER_PORTRAIT_EXPECTATIONS.format;
  height: typeof PLAYER_PORTRAIT_EXPECTATIONS.height;
  imageCount: number;
  minimumByteCount: number;
  pixelSha256ByFileName: ReadonlyMap<string, string>;
  sha256ByFileName: ReadonlyMap<string, string>;
  uniquePixelSha256Count: number;
  uniqueSha256Count: number;
  width: typeof PLAYER_PORTRAIT_EXPECTATIONS.width;
};

export type PlayerCatalogueRunResult = {
  delta: PlayerCatalogueDeltaSummary | null;
  players: readonly NormalizedPlayerSeed[];
  portraits: PlayerPortraitVerification;
  sourceHandoffReconciled: boolean;
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

    const words = displayName.split(" ");
    const expectedFirstName = words[0];
    if (!expectedFirstName) {
      fail(`tracked row ${rowNumber} has no searchable first name.`);
    }
    const expectedLastName = words.length > 1 ? words.slice(1).join(" ") : null;
    const expectedSortName = expectedLastName
      ? `${expectedLastName}, ${expectedFirstName}`
      : expectedFirstName;
    const expectedSlug = `${slugify(displayName) || "player"}-${externalId}`;
    if (
      firstName !== expectedFirstName ||
      lastName !== expectedLastName ||
      sortName !== expectedSortName ||
      slug !== expectedSlug
    ) {
      fail(
        `tracked row ${rowNumber} does not match its derived searchable fields.`,
      );
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
      `the tracked fixture does not preserve the ${PLAYER_CATALOGUE_EXPECTATIONS.imageCount} portrait / ${PLAYER_CATALOGUE_EXPECTATIONS.missingImageCount} fallback split.`,
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
  const unexpectedEntries = entries.filter(
    (entry) =>
      !entry.isFile() ||
      (!entry.name.endsWith(".png") && entry.name !== ".gitkeep"),
  );
  if (unexpectedEntries.length > 0) {
    fail(
      `${directory} contains unexpected portrait entries: ${unexpectedEntries
        .map((entry) => entry.name)
        .toSorted()
        .join(", ")}.`,
    );
  }
  return new Set(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".png"))
      .map((entry) => entry.name),
  );
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function parseDeltaRows(source: unknown, label: string): DeltaPlayerRow[] {
  if (!Array.isArray(source)) {
    fail(`${label} must contain an array of player records.`);
  }
  return source.map((rawRow, index) => {
    const rowNumber = index + 1;
    if (!isRecord(rawRow)) {
      fail(`${label} row ${rowNumber} is not an object.`);
    }
    const externalId = parseExternalId(rawRow.tm_player_id, rowNumber);
    const playerName = normalizeDisplayName(
      readString(rawRow, "player_name", rowNumber),
      rowNumber,
    );
    const clubSlug = readString(rawRow, "club_slug", rowNumber).trim();
    if (!(clubSlug in SOURCE_TEAM_SLUG_MAP)) {
      fail(`${label} row ${rowNumber} uses unknown club_slug ${clubSlug}.`);
    }
    const position = readString(rawRow, "position", rowNumber).trim();
    if (!position) {
      fail(`${label} row ${rowNumber} has an empty position.`);
    }
    const imageFound = readString(rawRow, "image_found", rowNumber).trim();
    if (imageFound !== "Yes" && imageFound !== "No") {
      fail(`${label} row ${rowNumber} has invalid image_found ${imageFound}.`);
    }
    const imageFilename = readString(
      rawRow,
      "image_filename",
      rowNumber,
    ).trim();
    if (
      imageFound === "Yes" &&
      (basename(imageFilename) !== imageFilename ||
        !/^[a-z0-9_]+\.png$/u.test(imageFilename))
    ) {
      fail(`${label} row ${rowNumber} has an unsafe image_filename.`);
    }
    if (imageFound === "No" && imageFilename) {
      fail(`${label} row ${rowNumber} names a missing portrait file.`);
    }
    const imageSource = readString(rawRow, "image_source", rowNumber).trim();
    if (
      imageSource !== "fotmob" &&
      imageSource !== "creative_commons" &&
      imageSource !== "none"
    ) {
      fail(
        `${label} row ${rowNumber} has invalid image_source ${imageSource}.`,
      );
    }
    if (
      (imageSource === "none" && imageFound !== "No") ||
      (imageSource !== "none" && imageFound !== "Yes")
    ) {
      fail(
        `${label} row ${rowNumber} has inconsistent image_found and image_source provenance.`,
      );
    }
    const rawFotmobId = rawRow.fotmob_id;
    let fotmobId: number | null = null;
    if (imageSource === "fotmob") {
      if (
        typeof rawFotmobId !== "number" ||
        !Number.isSafeInteger(rawFotmobId) ||
        rawFotmobId <= 0
      ) {
        fail(`${label} row ${rowNumber} has an invalid fotmob_id.`);
      }
      fotmobId = rawFotmobId;
    } else if (rawFotmobId !== "") {
      fail(
        `${label} row ${rowNumber} must use an empty fotmob_id for ${imageSource} provenance.`,
      );
    }
    return {
      clubSlug,
      externalId,
      fotmobId,
      imageFilename,
      imageFound,
      imageSource,
      playerName,
      position,
    };
  });
}

function indexDeltaRowsByExternalId(
  rows: readonly DeltaPlayerRow[],
  label: string,
): Map<number, DeltaPlayerRow> {
  const indexed = new Map<number, DeltaPlayerRow>();
  for (const row of rows) {
    if (indexed.has(row.externalId)) {
      fail(`${label} duplicates tm_player_id ${row.externalId}.`);
    }
    indexed.set(row.externalId, row);
  }
  return indexed;
}

function verifyDeltaProvenance(
  previousRows: readonly DeltaPlayerRow[],
  currentRows: readonly DeltaPlayerRow[],
): void {
  const countSources = (rows: readonly DeltaPlayerRow[]) => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.imageSource, (counts.get(row.imageSource) ?? 0) + 1);
    }
    return counts;
  };
  const currentSourceCounts = countSources(currentRows);
  if (
    currentSourceCounts.get("fotmob") !== 582 ||
    currentSourceCounts.size !== 1
  ) {
    fail("the current handoff must contain exactly 582 fotmob portrait rows.");
  }

  const previousSourceCounts = countSources(previousRows);
  if (
    previousSourceCounts.get("fotmob") !== 570 ||
    previousSourceCounts.get("creative_commons") !== 10 ||
    previousSourceCounts.get("none") !== 7 ||
    previousSourceCounts.size !== 3
  ) {
    fail(
      "the previous handoff must preserve the reviewed 570/10/7 portrait provenance mix.",
    );
  }

  for (const [rows, expectedCount, label] of [
    [currentRows, 582, "current"] as const,
    [previousRows, 570, "previous"] as const,
  ]) {
    const fotmobIds = rows.flatMap((row) =>
      row.fotmobId === null ? [] : [row.fotmobId],
    );
    if (
      fotmobIds.length !== expectedCount ||
      new Set(fotmobIds).size !== expectedCount
    ) {
      fail(
        `the ${label} handoff must contain ${expectedCount} unique positive fotmob_id values.`,
      );
    }
  }
}

function fileSha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

type ReviewedDeltaIdentityCategory =
  keyof typeof PLAYER_CATALOGUE_DELTA_EXPECTATIONS.identitySha256;

export function verifyReviewedPlayerDeltaIdentity(
  category: ReviewedDeltaIdentityCategory,
  identityLines: readonly string[],
): void {
  const expectedCounts: Record<ReviewedDeltaIdentityCategory, number> = {
    added: PLAYER_CATALOGUE_DELTA_EXPECTATIONS.addedCount,
    moved: PLAYER_CATALOGUE_DELTA_EXPECTATIONS.movedCount,
    removed: PLAYER_CATALOGUE_DELTA_EXPECTATIONS.removedCount,
    replaced: PLAYER_CATALOGUE_DELTA_EXPECTATIONS.replacedPortraitCount,
    restored: PLAYER_CATALOGUE_DELTA_EXPECTATIONS.restoredPortraitCount,
  };
  const serialized = `${identityLines.toSorted().join("\n")}\n`;
  if (
    identityLines.length !== expectedCounts[category] ||
    fileSha256(Buffer.from(serialized, "utf8")) !==
      PLAYER_CATALOGUE_DELTA_EXPECTATIONS.identitySha256[category]
  ) {
    fail(`the ${category} player identity set is not the reviewed transition.`);
  }
}

async function portraitPixelSha256(
  directory: string,
  row: DeltaPlayerRow,
): Promise<string> {
  if (!row.imageFilename) {
    fail(`player ${row.externalId} has no portrait for delta verification.`);
  }
  try {
    const { data, info } = await sharp(join(directory, row.imageFilename), {
      failOn: "error",
    })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return fileSha256(
      Buffer.concat([
        Buffer.from(`${info.width}x${info.height}x${info.channels}\0`, "utf8"),
        data,
      ]),
    );
  } catch {
    fail(`player ${row.externalId} portrait cannot be decoded.`);
  }
}

export async function verifyPlayerCatalogueDelta(
  previousSource: unknown,
  currentSource: unknown,
  previousImageDirectory: string,
  currentImageDirectory: string,
): Promise<PlayerCatalogueDeltaSummary> {
  const previousRows = parseDeltaRows(previousSource, "the previous handoff");
  const currentRows = parseDeltaRows(currentSource, "the current handoff");
  const previousById = indexDeltaRowsByExternalId(
    previousRows,
    "the previous handoff",
  );
  const currentById = indexDeltaRowsByExternalId(
    currentRows,
    "the current handoff",
  );
  verifyDeltaProvenance(previousRows, currentRows);

  const added = currentRows.filter((row) => !previousById.has(row.externalId));
  const removed = previousRows.filter(
    (row) => !currentById.has(row.externalId),
  );
  const common = currentRows.flatMap((row) => {
    const previous = previousById.get(row.externalId);
    return previous ? [{ current: row, previous }] : [];
  });
  const moved = common.filter(
    ({ current, previous }) => current.clubSlug !== previous.clubSlug,
  );
  const positionChanged = common.filter(
    ({ current, previous }) => current.position !== previous.position,
  );
  const nameChanged = common.filter(
    ({ current, previous }) =>
      normalizedNameKey(current.playerName) !==
      normalizedNameKey(previous.playerName),
  );
  const restoredPortraits = common.filter(
    ({ current, previous }) =>
      previous.imageFound === "No" && current.imageFound === "Yes",
  );
  const replacedPortraits = common.filter(
    ({ current, previous }) =>
      previous.imageSource === "creative_commons" &&
      current.imageSource === "fotmob",
  );

  verifyReviewedPlayerDeltaIdentity(
    "added",
    added.map(
      (row) =>
        `${row.externalId}\t${row.playerName}\t${row.clubSlug}\t${row.imageFilename}`,
    ),
  );
  verifyReviewedPlayerDeltaIdentity(
    "removed",
    removed.map(
      (row) =>
        `${row.externalId}\t${row.playerName}\t${row.clubSlug}\t${row.imageFilename}`,
    ),
  );
  verifyReviewedPlayerDeltaIdentity(
    "moved",
    moved.map(
      ({ current, previous }) =>
        `${current.externalId}\t${current.playerName}\t${previous.clubSlug}->${current.clubSlug}\t${previous.imageFilename}->${current.imageFilename}`,
    ),
  );
  verifyReviewedPlayerDeltaIdentity(
    "restored",
    restoredPortraits.map(
      ({ current, previous }) =>
        `${current.externalId}\t${current.playerName}\t${current.clubSlug}\t${previous.imageFound}->${current.imageFound}\t${previous.imageFilename}->${current.imageFilename}`,
    ),
  );
  verifyReviewedPlayerDeltaIdentity(
    "replaced",
    replacedPortraits.map(
      ({ current, previous }) =>
        `${current.externalId}\t${current.playerName}\t${current.clubSlug}\t${previous.imageSource}->${current.imageSource}\t${previous.imageFilename}->${current.imageFilename}`,
    ),
  );

  for (const { current, previous } of moved) {
    const previousDigest = await portraitPixelSha256(
      previousImageDirectory,
      previous,
    );
    const currentDigest = await portraitPixelSha256(
      currentImageDirectory,
      current,
    );
    if (previousDigest !== currentDigest) {
      fail(
        `moved player ${current.externalId} does not preserve portrait pixels.`,
      );
    }
  }
  for (const { current, previous } of replacedPortraits) {
    const previousDigest = await portraitPixelSha256(
      previousImageDirectory,
      previous,
    );
    const currentDigest = await portraitPixelSha256(
      currentImageDirectory,
      current,
    );
    if (previousDigest === currentDigest) {
      fail(`replacement portrait ${current.externalId} did not change pixels.`);
    }
  }

  const summary: PlayerCatalogueDeltaSummary = {
    addedCount: added.length,
    currentPlayerCount: currentRows.length,
    movedCount: moved.length,
    nameChangedCount: nameChanged.length,
    positionChangedCount: positionChanged.length,
    previousPlayerCount: previousRows.length,
    removedCount: removed.length,
    replacedPortraitCount: replacedPortraits.length,
    restoredPortraitCount: restoredPortraits.length,
  };
  const expected = PLAYER_CATALOGUE_DELTA_EXPECTATIONS;
  if (
    summary.previousPlayerCount !== expected.previousPlayerCount ||
    summary.currentPlayerCount !== PLAYER_CATALOGUE_EXPECTATIONS.playerCount ||
    summary.addedCount !== expected.addedCount ||
    summary.removedCount !== expected.removedCount ||
    summary.movedCount !== expected.movedCount ||
    summary.restoredPortraitCount !== expected.restoredPortraitCount ||
    summary.replacedPortraitCount !== expected.replacedPortraitCount ||
    summary.positionChangedCount !== 0 ||
    summary.nameChangedCount !== 0
  ) {
    fail(`the handoff delta is not the reviewed 2026-08-13 transition.`);
  }

  return summary;
}

export async function verifyPlayerPortraits(
  destinationDirectory: string,
  expectedFileNames: ReadonlySet<string>,
  sourceDirectory?: string,
): Promise<PlayerPortraitVerification> {
  const publishedFileNames = await listPngFileNames(destinationDirectory);
  if (
    publishedFileNames.size !== expectedFileNames.size ||
    [...expectedFileNames].some((name) => !publishedFileNames.has(name))
  ) {
    fail("public/player-faces does not contain exactly the referenced PNGs.");
  }

  const digestOwner = new Map<string, string>();
  const pixelDigestOwner = new Map<string, string>();
  const pixelSha256ByFileName = new Map<string, string>();
  const sha256ByFileName = new Map<string, string>();
  let minimumByteCount = Number.POSITIVE_INFINITY;
  for (const fileName of [...expectedFileNames].toSorted()) {
    const publishedBytes = await readFile(join(destinationDirectory, fileName));
    const pngSignature = publishedBytes.subarray(0, 8).toString("hex");
    if (pngSignature !== "89504e470d0a1a0a") {
      fail(`published portrait ${fileName} is not a valid PNG.`);
    }
    let metadata: Metadata;
    let pixelDigest: string;
    try {
      const image = sharp(publishedBytes, { failOn: "error" });
      metadata = await image.metadata();
      const { data, info } = await image
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      pixelDigest = fileSha256(
        Buffer.concat([
          Buffer.from(
            `${info.width}x${info.height}x${info.channels}\0`,
            "utf8",
          ),
          data,
        ]),
      );
    } catch {
      fail(`published portrait ${fileName} cannot be decoded.`);
    }
    if (
      metadata.format !== PLAYER_PORTRAIT_EXPECTATIONS.format ||
      metadata.width !== PLAYER_PORTRAIT_EXPECTATIONS.width ||
      metadata.height !== PLAYER_PORTRAIT_EXPECTATIONS.height
    ) {
      fail(
        `published portrait ${fileName} must be a ${PLAYER_PORTRAIT_EXPECTATIONS.width}x${PLAYER_PORTRAIT_EXPECTATIONS.height} PNG.`,
      );
    }
    if (publishedBytes.length < PLAYER_PORTRAIT_EXPECTATIONS.minimumByteCount) {
      fail(
        `published portrait ${fileName} is below the ${PLAYER_PORTRAIT_EXPECTATIONS.minimumByteCount}-byte placeholder rejection floor.`,
      );
    }
    minimumByteCount = Math.min(minimumByteCount, publishedBytes.length);
    const digest = fileSha256(publishedBytes);
    const duplicateOwner = digestOwner.get(digest);
    if (duplicateOwner) {
      fail(
        `published portrait ${fileName} duplicates the SHA-256 digest of ${duplicateOwner}.`,
      );
    }
    digestOwner.set(digest, fileName);
    sha256ByFileName.set(fileName, digest);
    const duplicatePixelOwner = pixelDigestOwner.get(pixelDigest);
    if (duplicatePixelOwner) {
      fail(
        `published portrait ${fileName} duplicates decoded pixels from ${duplicatePixelOwner}.`,
      );
    }
    pixelDigestOwner.set(pixelDigest, fileName);
    pixelSha256ByFileName.set(fileName, pixelDigest);
    if (
      sourceDirectory &&
      !(await readFile(join(sourceDirectory, fileName))).equals(publishedBytes)
    ) {
      fail(`published portrait ${fileName} differs from its source.`);
    }
  }

  return {
    format: PLAYER_PORTRAIT_EXPECTATIONS.format,
    height: PLAYER_PORTRAIT_EXPECTATIONS.height,
    imageCount: sha256ByFileName.size,
    minimumByteCount,
    pixelSha256ByFileName,
    sha256ByFileName,
    uniquePixelSha256Count: pixelDigestOwner.size,
    uniqueSha256Count: digestOwner.size,
    width: PLAYER_PORTRAIT_EXPECTATIONS.width,
  };
}

export function playerPortraitFingerprintSha256(
  portraits: PlayerPortraitVerification,
): string {
  const fingerprintLines = [...portraits.sha256ByFileName.entries()]
    .toSorted(([left], [right]) => compareText(left, right))
    .map(([fileName, digest]) => {
      const pixelDigest = portraits.pixelSha256ByFileName.get(fileName);
      if (!pixelDigest) {
        fail(`portrait ${fileName} is missing its decoded-pixel digest.`);
      }
      return `${fileName}\t${digest}\t${pixelDigest}\n`;
    });
  return fileSha256(Buffer.from(fingerprintLines.join(""), "utf8"));
}

export function verifyReviewedPlayerRelease(
  serializedFixture: string,
  portraits: PlayerPortraitVerification,
): void {
  if (
    fileSha256(Buffer.from(serializedFixture, "utf8")) !==
    PLAYER_CATALOGUE_RELEASE_EXPECTATIONS.fixtureSha256
  ) {
    fail("the tracked fixture is not the reviewed 2026-08-13 release.");
  }
  if (
    playerPortraitFingerprintSha256(portraits) !==
    PLAYER_CATALOGUE_RELEASE_EXPECTATIONS.portraitFingerprintSha256
  ) {
    fail("the published portraits are not the reviewed 2026-08-13 release.");
  }
}

export async function publishValidatedCatalogue({
  destinationImageDirectory,
  fixturePath,
  renameFile = rename,
  serializedFixture,
  sourceImageDirectory,
  sourceImageFileNames,
}: {
  destinationImageDirectory: string;
  fixturePath: string;
  renameFile?: typeof rename;
  serializedFixture: string;
  sourceImageDirectory: string;
  sourceImageFileNames: ReadonlySet<string>;
}): Promise<PlayerPortraitVerification> {
  const portraitParent = dirname(destinationImageDirectory);
  const fixtureParent = dirname(fixturePath);
  await Promise.all([
    mkdir(portraitParent, { recursive: true }),
    mkdir(fixtureParent, { recursive: true }),
  ]);

  const [
    portraitStageRoot,
    fixtureStageRoot,
    portraitBackupRoot,
    fixtureBackupRoot,
  ] = await Promise.all([
    mkdtemp(join(portraitParent, ".player-faces-stage-")),
    mkdtemp(join(fixtureParent, ".players-fixture-stage-")),
    mkdtemp(join(portraitParent, ".player-faces-backup-")),
    mkdtemp(join(fixtureParent, ".players-fixture-backup-")),
  ]);
  const stagedPortraitDirectory = join(portraitStageRoot, "player-faces");
  const stagedFixturePath = join(fixtureStageRoot, basename(fixturePath));
  const backupPortraitDirectory = join(portraitBackupRoot, "player-faces");
  const backupFixturePath = join(fixtureBackupRoot, basename(fixturePath));

  let destinationBackedUp = false;
  let destinationPublished = false;
  let fixtureBackedUp = false;
  let fixturePublished = false;
  let backupsSafeToRemove = false;
  let stagedPortraits: PlayerPortraitVerification | undefined;
  try {
    await mkdir(stagedPortraitDirectory);
    const gitkeepPath = join(destinationImageDirectory, ".gitkeep");
    if (await pathExists(gitkeepPath)) {
      await copyFile(gitkeepPath, join(stagedPortraitDirectory, ".gitkeep"));
    }
    for (const fileName of sourceImageFileNames) {
      await copyFile(
        join(sourceImageDirectory, fileName),
        join(stagedPortraitDirectory, fileName),
      );
    }
    await writeFile(stagedFixturePath, serializedFixture, "utf8");
    stagedPortraits = await verifyPlayerPortraits(
      stagedPortraitDirectory,
      sourceImageFileNames,
      sourceImageDirectory,
    );

    if (await pathExists(destinationImageDirectory)) {
      await renameFile(destinationImageDirectory, backupPortraitDirectory);
      destinationBackedUp = true;
    }
    await renameFile(stagedPortraitDirectory, destinationImageDirectory);
    destinationPublished = true;

    if (await pathExists(fixturePath)) {
      await renameFile(fixturePath, backupFixturePath);
      fixtureBackedUp = true;
    }
    await renameFile(stagedFixturePath, fixturePath);
    fixturePublished = true;
    backupsSafeToRemove = true;
  } catch (publishError: unknown) {
    const rollbackErrors: unknown[] = [];
    try {
      if (fixturePublished) await unlink(fixturePath);
      if (fixtureBackedUp) await renameFile(backupFixturePath, fixturePath);
    } catch (error: unknown) {
      rollbackErrors.push(error);
    }
    try {
      if (destinationPublished) {
        await rm(destinationImageDirectory, { force: true, recursive: true });
      }
      if (destinationBackedUp) {
        await renameFile(backupPortraitDirectory, destinationImageDirectory);
      }
    } catch (error: unknown) {
      rollbackErrors.push(error);
    }
    backupsSafeToRemove = rollbackErrors.length === 0;
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [publishError, ...rollbackErrors],
        `Player catalogue publication failed and rollback was incomplete; inspect ${portraitBackupRoot} and ${fixtureBackupRoot}.`,
      );
    }
    throw publishError;
  } finally {
    await Promise.all([
      rm(portraitStageRoot, { force: true, recursive: true }),
      rm(fixtureStageRoot, { force: true, recursive: true }),
      ...(backupsSafeToRemove
        ? [
            rm(portraitBackupRoot, { force: true, recursive: true }),
            rm(fixtureBackupRoot, { force: true, recursive: true }),
          ]
        : []),
    ]);
  }

  if (!stagedPortraits) {
    fail("staged portrait verification did not complete.");
  }
  return stagedPortraits;
}

export async function runPlayerCatalogueNormalizer(
  mode: "check" | "write",
  repositoryDirectory = process.cwd(),
): Promise<PlayerCatalogueRunResult> {
  const repositoryRoot = resolve(repositoryDirectory);
  const sourceDirectory = join(
    repositoryRoot,
    "premier-league-players-2026-08-13",
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
  const previousSourceDirectory = join(
    repositoryRoot,
    "premier-league-players-2026-08-08",
  );
  const previousSourceImageDirectory = join(previousSourceDirectory, "images");
  const previousSourceJsonPath = join(
    previousSourceDirectory,
    "scripts",
    "data",
    "players_final.json",
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

    const [sourceJsonExists, sourceImagesExist] = await Promise.all([
      pathExists(sourceJsonPath),
      pathExists(sourceImageDirectory),
    ]);
    if (sourceJsonExists !== sourceImagesExist) {
      fail("the private 2026-08-13 source handoff is incomplete.");
    }

    let delta: PlayerCatalogueDeltaSummary | null = null;
    let portraits: PlayerPortraitVerification;
    if (sourceJsonExists) {
      const [sourceJson, sourceImageFileNames] = await Promise.all([
        readFile(sourceJsonPath, "utf8"),
        listPngFileNames(sourceImageDirectory),
      ]);
      const sourcePlayers = normalizePlayerCatalogue(
        JSON.parse(sourceJson) as unknown,
        sourceImageFileNames,
      );
      if (trackedFixture !== serializeFixture(sourcePlayers)) {
        fail(
          "the private 2026-08-13 source handoff does not exactly match the tracked fixture.",
        );
      }
      portraits = await verifyPlayerPortraits(
        destinationImageDirectory,
        sourceImageFileNames,
        sourceImageDirectory,
      );

      const [previousJsonExists, previousImagesExist] = await Promise.all([
        pathExists(previousSourceJsonPath),
        pathExists(previousSourceImageDirectory),
      ]);
      if (previousJsonExists !== previousImagesExist) {
        fail("the private 2026-08-08 source handoff is incomplete.");
      }
      if (!previousJsonExists) {
        fail(
          "the private 2026-08-08 handoff is required when the 2026-08-13 handoff is present.",
        );
      }
      const [previousJson, previousImageFileNames] = await Promise.all([
        readFile(previousSourceJsonPath, "utf8"),
        listPngFileNames(previousSourceImageDirectory),
      ]);
      normalizePlayerCatalogue(
        JSON.parse(previousJson) as unknown,
        previousImageFileNames,
        PREVIOUS_PLAYER_CATALOGUE_EXPECTATIONS,
      );
      delta = await verifyPlayerCatalogueDelta(
        JSON.parse(previousJson) as unknown,
        JSON.parse(sourceJson) as unknown,
        previousSourceImageDirectory,
        sourceImageDirectory,
      );
    } else {
      portraits = await verifyPlayerPortraits(
        destinationImageDirectory,
        publishedImageFileNames,
      );
    }
    verifyReviewedPlayerRelease(trackedFixture, portraits);
    return {
      delta,
      players,
      portraits,
      sourceHandoffReconciled: sourceJsonExists,
    };
  }

  const [
    sourceJsonExists,
    sourceImagesExist,
    previousJsonExists,
    previousImagesExist,
  ] = await Promise.all([
    pathExists(sourceJsonPath),
    pathExists(sourceImageDirectory),
    pathExists(previousSourceJsonPath),
    pathExists(previousSourceImageDirectory),
  ]);
  if (!sourceJsonExists || !sourceImagesExist) {
    fail("write mode requires the complete private 2026-08-13 handoff.");
  }
  if (!previousJsonExists || !previousImagesExist) {
    fail("write mode requires the complete private 2026-08-08 handoff.");
  }

  const [
    sourceJson,
    sourceImageFileNames,
    previousJson,
    previousImageFileNames,
  ] = await Promise.all([
    readFile(sourceJsonPath, "utf8"),
    listPngFileNames(sourceImageDirectory),
    readFile(previousSourceJsonPath, "utf8"),
    listPngFileNames(previousSourceImageDirectory),
  ]);
  const parsedSource = JSON.parse(sourceJson) as unknown;
  const parsedPreviousSource = JSON.parse(previousJson) as unknown;
  const players = normalizePlayerCatalogue(parsedSource, sourceImageFileNames);
  normalizePlayerCatalogue(
    parsedPreviousSource,
    previousImageFileNames,
    PREVIOUS_PLAYER_CATALOGUE_EXPECTATIONS,
  );
  const sourcePortraits = await verifyPlayerPortraits(
    sourceImageDirectory,
    sourceImageFileNames,
  );
  const delta = await verifyPlayerCatalogueDelta(
    parsedPreviousSource,
    parsedSource,
    previousSourceImageDirectory,
    sourceImageDirectory,
  );
  const serializedFixture = serializeFixture(players);
  verifyReviewedPlayerRelease(serializedFixture, sourcePortraits);
  const portraits = await publishValidatedCatalogue({
    destinationImageDirectory,
    fixturePath,
    serializedFixture,
    sourceImageDirectory,
    sourceImageFileNames,
  });
  return {
    delta,
    players,
    portraits,
    sourceHandoffReconciled: true,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== "--check") || args.length > 1) {
    throw new Error("Usage: players:generate [--check]");
  }
  const mode = args.includes("--check") ? "check" : "write";
  const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const result = await runPlayerCatalogueNormalizer(mode, repositoryRoot);
  const portraitCount = result.players.filter(
    (player) => player.assetPath !== null,
  ).length;
  const handoffSuffix = result.sourceHandoffReconciled
    ? result.delta
      ? ` Source parity and the ${result.delta.addedCount}/${result.delta.removedCount}/${result.delta.movedCount}/${result.delta.restoredPortraitCount}/${result.delta.replacedPortraitCount} transition also match.`
      : " Source parity also matches."
    : "";
  process.stdout.write(
    `${mode === "check" ? "Verified" : "Generated"} ${result.players.length} players, ${portraitCount} decoded ${result.portraits.width}x${result.portraits.height} portraits, ${result.portraits.uniqueSha256Count} unique file SHA-256 digests, ${result.portraits.uniquePixelSha256Count} unique decoded-pixel SHA-256 digests, and ${result.players.length - portraitCount} silhouette fallbacks. Reviewed fixture and portrait release fingerprints match.${handoffSuffix}\n`,
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
