"use client";

import { BookOpen, Flame, ListOrdered, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", icon: ListOrdered, label: "Table" },
  { href: "/leaderboard", icon: Trophy, label: "Leaderboard" },
  { href: "/spotlight", icon: Sparkles, label: "Spotlight" },
  { href: "/win-streak", icon: Flame, label: "Streak" },
  { href: "/rules", icon: BookOpen, label: "Rules" },
] as const;

export function isCurrentSection(pathname: string, href: string) {
  if (href === "/leaderboard") {
    return pathname === "/leaderboard" || pathname.startsWith("/entries/");
  }
  return pathname === href;
}

export function MobileTabBar() {
  const pathname = usePathname() ?? "/";
  if (pathname.startsWith("/admin")) return null;

  return (
    <nav aria-label="Primary navigation" className="mobile-tab-bar">
      {tabs.map(({ href, icon: Icon, label }) => (
        <Link
          aria-current={isCurrentSection(pathname, href) ? "page" : undefined}
          href={href}
          key={href}
        >
          <Icon aria-hidden="true" className="size-5" strokeWidth={1.9} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
