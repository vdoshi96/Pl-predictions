import { NextResponse } from "next/server";

import type { PlayerCatalogueResponse } from "@/features/predictions/player-catalogue";
import {
  getActiveSeasonContext,
  getActiveSeasonPlayers,
} from "@/features/seasons/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const { season } = await getActiveSeasonContext();
  const players = await getActiveSeasonPlayers(season.id);
  const response: PlayerCatalogueResponse = {
    players,
    seasonSlug: season.slug,
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
