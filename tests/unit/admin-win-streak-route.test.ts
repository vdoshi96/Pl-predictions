import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveSeasonContext: vi.fn(),
  getAdminSession: vi.fn(),
  getDb: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`redirect:${destination}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/db/client", () => ({ getDb: mocks.getDb }));
vi.mock("@/features/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/admin")>()),
  getAdminSession: mocks.getAdminSession,
}));
vi.mock("@/features/seasons/queries", () => ({
  getActiveSeasonContext: mocks.getActiveSeasonContext,
}));

import AdminWinStreakPage from "@/app/admin/win-streak/page";

describe("Win Streak administrator route", () => {
  it("redirects an unauthenticated request before reading game data", async () => {
    mocks.getAdminSession.mockResolvedValue(null);

    await expect(AdminWinStreakPage()).rejects.toThrow("redirect:/admin/login");
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.getActiveSeasonContext).not.toHaveBeenCalled();
  });
});
