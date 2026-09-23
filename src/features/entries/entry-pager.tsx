import Link from "next/link";

import type { AdjacentEntries } from "./navigation";

const linkClassName =
  "text-brand-ink inline-flex min-h-11 min-w-0 items-center gap-1 font-semibold underline underline-offset-4";

export function EntryPager({ navigation }: { navigation: AdjacentEntries }) {
  return (
    <nav
      aria-label="Entry navigation"
      className="flex items-center justify-between gap-3 text-sm"
    >
      {navigation.previous ? (
        <Link
          className={linkClassName}
          href={`/entries/${navigation.previous.id}`}
        >
          <span aria-hidden="true">‹</span>
          <span className="sr-only">Previous entry:</span>{" "}
          <span className="min-w-0 break-words">
            {navigation.previous.participantName}
          </span>
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted shrink-0 text-xs">
        {navigation.position} of {navigation.total}
      </span>
      {navigation.next ? (
        <Link
          className={`${linkClassName} justify-end text-right`}
          href={`/entries/${navigation.next.id}`}
        >
          <span className="sr-only">Next entry:</span>{" "}
          <span className="min-w-0 break-words">
            {navigation.next.participantName}
          </span>
          <span aria-hidden="true">›</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
