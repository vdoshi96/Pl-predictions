"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "Season table" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/spotlight", label: "Spotlight" },
  { href: "/win-streak", label: "Win Streak" },
  { href: "/rules", label: "Rules" },
] as const;

export function SiteNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary navigation" className="site-nav">
      {navigation.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
