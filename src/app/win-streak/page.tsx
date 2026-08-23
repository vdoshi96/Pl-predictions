import type { Metadata } from "next";

import { WinStreakWorkshop } from "@/features/win-streak/win-streak-workshop";

export const metadata: Metadata = { title: "Win Streak workshop" };

export default function WinStreakPage() {
  return <WinStreakWorkshop />;
}
