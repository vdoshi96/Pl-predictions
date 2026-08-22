const AVATAR_COLORS = [
  "#953bff",
  "#0e7490",
  "#b45309",
  "#166534",
  "#7c2d92",
  "#9d174d",
  "#374151",
  "#1d4ed8",
  "#0f766e",
] as const;

const graphemeSegmenter = new Intl.Segmenter("en", {
  granularity: "grapheme",
});

function firstGrapheme(value: string): string {
  return (
    graphemeSegmenter.segment(value)[Symbol.iterator]().next().value?.segment ??
    "?"
  );
}

function normalizedAvatarName(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

function hashName(name: string): number {
  let hash = 2166136261;
  for (const character of name.toLocaleLowerCase("en-GB")) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getEntryAvatar(name: string): {
  backgroundColor: (typeof AVATAR_COLORS)[number];
  initials: string;
} {
  const normalizedName = normalizedAvatarName(name);
  const words = normalizedName ? normalizedName.split(" ") : [];
  const initials = words
    .slice(0, 2)
    .map(firstGrapheme)
    .join("")
    .toLocaleUpperCase("en-GB");

  return {
    backgroundColor:
      AVATAR_COLORS[hashName(normalizedName) % AVATAR_COLORS.length] ??
      AVATAR_COLORS[0],
    initials: initials || "?",
  };
}
