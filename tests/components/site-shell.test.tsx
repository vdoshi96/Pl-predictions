import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { LeagueTime } from "@/components/league-time";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { PageHeading } from "@/components/page-heading";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SnapshotStatus } from "@/components/snapshot-status";

beforeEach(() => {
  navigation.pathname = "/";
});

afterEach(cleanup);

describe("mobile tab bar", () => {
  it("lists the five public sections in order with short labels", () => {
    render(<MobileTabBar />);

    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(nav).toHaveClass("mobile-tab-bar");
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      "Table",
      "Leaderboard",
      "Spotlight",
      "Streak",
      "Rules",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "/leaderboard",
      "/spotlight",
      "/win-streak",
      "/rules",
    ]);
    expect(screen.getByRole("link", { name: "Table" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks Leaderboard current while viewing an entry", () => {
    navigation.pathname = "/entries/22bd090e-7062-4803-961a-800a36c1bfd4";
    render(<MobileTabBar />);

    expect(screen.getByRole("link", { name: "Leaderboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Table" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("renders nothing on owner pages", () => {
    navigation.pathname = "/admin/results";
    const { container } = render(<MobileTabBar />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("site header", () => {
  it("hides the text navigation below the small breakpoint", () => {
    render(<SiteHeader />);
    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    // .site-nav is unlayered global CSS, so the hide utility must sit on a
    // wrapper: an unlayered display rule would beat a Tailwind utility.
    expect(nav).toHaveClass("site-nav");
    expect(nav.parentElement).toHaveClass("max-sm:hidden");
    expect(screen.getByRole("link", { name: "Leaderboard" })).toHaveAttribute(
      "href",
      "/leaderboard",
    );
  });

  it("replaces the public sections with one way back on owner pages", () => {
    navigation.pathname = "/admin/standings";
    render(<SiteHeader />);
    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(nav).toHaveClass("site-nav");
    expect(nav.parentElement).not.toHaveClass("max-sm:hidden");
    expect(
      screen.getByRole("link", { name: "View public site" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.queryByRole("link", { name: "Leaderboard" }),
    ).not.toBeInTheDocument();
  });
});

describe("site footer", () => {
  it("keeps the disclaimer text but drops the heavy bold weight", () => {
    render(<SiteFooter />);
    const disclaimer = screen.getByText(
      /Dranx Prediction League is an independent, private prediction competition/iu,
    );
    expect(disclaimer).not.toHaveClass("font-bold");
    expect(disclaimer.parentElement?.className).toContain(
      "safe-area-inset-bottom",
    );
  });
});

describe("page heading", () => {
  it("wraps long titles between words instead of anywhere", () => {
    render(<PageHeading title="Kazorla(grown man)'s prediction" />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveClass("break-words");
    expect(heading.className).not.toContain("overflow-wrap:anywhere");
  });
});

describe("league time", () => {
  it("renders one short local line with the UTC form as a tooltip", () => {
    render(
      <LeagueTime
        prefix="Updated"
        value={new Date("2026-09-20T18:13:00.000Z")}
      />,
    );
    const time = screen.getByText("Updated Sun 20 Sep, 1:13 pm CDT");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("dateTime", "2026-09-20T18:13:00.000Z");
    expect(time).toHaveAttribute("title", "20 Sep 2026, 18:13 UTC");
  });
});

describe("snapshot status", () => {
  it("explains a provisional table on request", () => {
    render(<SnapshotStatus isFinal={false} />);
    expect(screen.getByText("Provisional", { exact: true })).toBeVisible();
    const toggle = screen.getByRole("button", {
      name: "What does Provisional mean?",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByText(/Provisional tables change as matchweeks are played/u),
    ).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(
        "Provisional tables change as matchweeks are played. The owner marks the table Final after the last matchweek.",
      ),
    ).toBeVisible();
  });

  it("shows Final without an explanation toggle", () => {
    render(<SnapshotStatus isFinal />);
    expect(screen.getByText("Final", { exact: true })).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
