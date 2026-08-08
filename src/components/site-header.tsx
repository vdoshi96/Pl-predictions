import Link from "next/link";

const navigation = [
  { href: "/", label: "Predict" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/admin", label: "Admin" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-b border-slate-800 bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:flex-nowrap sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex min-h-12 min-w-0 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-400 text-xs font-black tracking-tight text-slate-950 transition-transform group-hover:-rotate-2 motion-reduce:transition-none"
          >
            26·27
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold tracking-[0.16em] text-emerald-300 uppercase">
              Friends League
            </span>
            <span className="block truncate text-base leading-5 font-semibold">
              PL Predictions
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
                  className="inline-flex min-h-12 w-full min-w-0 items-center justify-center rounded-xl px-1 text-sm font-semibold text-slate-200 transition-colors outline-none hover:bg-slate-800 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-400 motion-reduce:transition-none sm:w-auto sm:px-3"
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
