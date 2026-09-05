import Link from "next/link";

import { BrandMark } from "./brand-mark";
import { SiteNavigation } from "./site-navigation";

export function SiteHeader() {
  return (
    <header className="site-header">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="page-shell">
        <div className="flex min-h-18 items-center justify-between gap-3">
          <Link
            href="/"
            className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg"
          >
            <BrandMark className="size-9 shrink-0" />
            <span className="min-w-0">
              <span className="block text-lg font-bold tracking-tight">
                Dranx{" "}
                <span className="hidden sm:inline">Prediction League</span>
              </span>
              <span className="text-muted block text-xs sm:hidden">
                Prediction League
              </span>
            </span>
          </Link>
          <span className="text-muted shrink-0 text-xs font-medium">
            2026 / 27
          </span>
        </div>
        <SiteNavigation />
      </div>
    </header>
  );
}
