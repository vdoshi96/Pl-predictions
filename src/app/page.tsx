import type { Metadata } from "next";

import { PredictionLanding } from "@/features/predictions/prediction-landing";
import { getActiveSeasonContext } from "@/features/seasons/queries";
import { SeasonTablePage } from "@/features/standings/season-table-page";
import { getSeasonAccess } from "@/shared/policy";

export const dynamic = "force-dynamic";

function accessFor(
  context: Awaited<ReturnType<typeof getActiveSeasonContext>>,
) {
  return getSeasonAccess(
    {
      openingKickoff: context.season.openingKickoff,
      revealPredictions: context.season.revealPredictions,
      submissionsLocked: context.season.submissionsLocked,
    },
    context.databaseNow,
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const context = await getActiveSeasonContext();
  return accessFor(context).predictionsRevealed
    ? { title: "Season table" }
    : {};
}

export default async function HomePage() {
  const context = await getActiveSeasonContext();
  const access = accessFor(context);

  if (access.predictionsRevealed) return <SeasonTablePage />;

  return (
    <PredictionLanding
      access={access}
      databaseNow={context.databaseNow}
      season={context.season}
    />
  );
}
