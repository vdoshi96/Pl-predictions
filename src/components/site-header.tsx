import Link from "next/link";

import { BrandMark } from "./brand-mark";

const navigation = [
  { href: "/", label: "Predict" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/admin", label: "Admin" },
] as const;

export function SiteHeader() {
  return (
    <header className="bg-brand border-b border-white/15 text-white shadow-[0_10px_35px_-25px_rgba(55,0,60,0.9)]">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:flex-nowrap sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group focus-visible:ring-accent-blue focus-visible:ring-offset-brand flex min-h-12 min-w-0 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <BrandMark className="size-11 transition-transform group-hover:-rotate-2 motion-reduce:transition-none" />
          <span className="min-w-0">
            <span className="text-accent block truncate text-[0.68rem] font-black tracking-[0.16em] uppercase sm:text-xs">
              2026/27 Premier League
            </span>
            <span className="block truncate text-base leading-5 font-black tracking-tight sm:text-lg">
              Dranx Prediction League
            </span>
          </span>
        </Link>

        <nav
          aria-label="Primary navigation"
          className="min-w-0 basis-full sm:basis-auto"
        >
          <ul className="grid grid-cols-3 gap-1 sm:flex sm:items-center sm:justify-end">
            {navigation.map((item) => (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  className="focus-visible:ring-accent-blue inline-flex min-h-12 w-full min-w-0 items-center justify-center rounded-xl px-1 text-sm font-bold text-white/80 transition-colors outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 motion-reduce:transition-none sm:w-auto sm:px-3"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
