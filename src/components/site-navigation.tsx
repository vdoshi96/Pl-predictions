"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isCurrentSection } from "./mobile-tab-bar";

const navigation = [
  { href: "/", label: "Season table" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/spotlight", label: "Spotlight" },
  { href: "/win-streak", label: "Win Streak" },
  { href: "/rules", label: "Rules" },
] as const;

export function SiteNavigation() {
  const pathname = usePathname() ?? "/";

  if (pathname.startsWith("/admin")) {
    return (
      <nav aria-label="Primary navigation" className="site-nav">
        <Link href="/">View public site</Link>
      </nav>
    );
  }

  return (
    <div className="max-sm:hidden">
      <nav aria-label="Primary navigation" className="site-nav">
        {navigation.map(({ href, label }) => (
          <Link
            aria-current={isCurrentSection(pathname, href) ? "page" : undefined}
            href={href}
            key={href}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
