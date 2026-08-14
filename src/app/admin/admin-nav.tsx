import Link from "next/link";

import { Button } from "@/components/ui/button";

import { logoutAction } from "./actions";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/submissions", label: "Submissions" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/standings", label: "Standings" },
  { href: "/admin/results", label: "Results" },
] as const;

type AdminRoute = (typeof links)[number]["href"];

export function AdminNav({ current }: { current: AdminRoute }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <nav aria-label="Admin navigation" className="min-w-0">
        <ul className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap">
          {links.map((link) => {
            const active = link.href === current;

            return (
              <li key={link.href}>
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl px-3 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:w-auto ${active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"}`}
                  href={link.href}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <form action={logoutAction} className="w-full sm:w-auto">
        <Button className="w-full sm:w-auto" size="md" variant="secondary">
          Sign out
        </Button>
      </form>
    </div>
  );
}
