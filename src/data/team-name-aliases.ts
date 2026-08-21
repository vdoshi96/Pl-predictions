import { normalizeForMatch } from "@/shared/text-normalization";

export type TeamNameSource = Readonly<{
  displayName: string;
  shortName: string;
  slug: string;
  sortName: string;
}>;

const CURATED_ALIASES: Readonly<Record<string, string>> = {
  spurs: "tottenham-hotspur",
  "man utd": "manchester-united",
  villa: "aston-villa",
  palace: "crystal-palace",
  bournemouth: "afc-bournemouth",
  brighton: "brighton-and-hove-albion",
  coventry: "coventry-city",
  hull: "hull-city",
  ipswich: "ipswich-town",
  leeds: "leeds-united",
  newcastle: "newcastle-united",
};

class TeamNameIndex extends Map<string, string> {
  override get(key: string): string | undefined {
    return super.get(normalizeForMatch(key));
  }

  override has(key: string): boolean {
    return super.has(normalizeForMatch(key));
  }

  override set(key: string, value: string): this {
    return super.set(normalizeForMatch(key), value);
  }
}

export function buildTeamNameIndex(
  teams: readonly TeamNameSource[],
): ReadonlyMap<string, string> {
  const index = new TeamNameIndex();
  const put = (name: string, slug: string) => {
    const key = normalizeForMatch(name);
    if (!key || index.has(key)) return;
    index.set(key, slug);
  };
  for (const team of teams) put(team.displayName, team.slug);
  for (const team of teams) {
    put(team.shortName, team.slug);
    put(team.sortName, team.slug);
  }
  for (const [alias, slug] of Object.entries(CURATED_ALIASES)) {
    if (teams.some((team) => team.slug === slug)) put(alias, slug);
  }
  return index;
}
