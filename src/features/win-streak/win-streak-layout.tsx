import type { ReactNode } from "react";

export function WinStreakLayout({
  leaderboard,
  panel,
  viewerPresent,
}: {
  leaderboard: ReactNode;
  panel: ReactNode;
  viewerPresent: boolean;
}) {
  const panelSlot = (
    <div
      className="min-w-0 lg:sticky lg:top-5 lg:col-start-1 lg:row-start-1"
      data-testid="win-streak-panel-slot"
    >
      {panel}
    </div>
  );
  const leaderboardSlot = (
    <div
      className="min-w-0 lg:col-start-2 lg:row-start-1"
      data-testid="win-streak-leaderboard-slot"
    >
      {leaderboard}
    </div>
  );

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(20rem,0.82fr)_minmax(0,1.18fr)] lg:items-start lg:gap-7">
      {viewerPresent ? (
        <>
          {panelSlot}
          {leaderboardSlot}
        </>
      ) : (
        <>
          {leaderboardSlot}
          {panelSlot}
        </>
      )}
    </div>
  );
}
