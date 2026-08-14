export type PlayerCataloguePlayer = Readonly<{
  assetPath: string | null;
  displayName: string;
  firstName: string | null;
  id: string;
  lastName: string | null;
}>;

export type PlayerCatalogueResponse = Readonly<{
  players: readonly PlayerCataloguePlayer[];
  seasonSlug: string;
}>;
