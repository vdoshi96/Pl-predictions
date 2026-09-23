import Link from "next/link";

import type { EntryReference } from "./navigation";

export function EntryComparePicker({
  activeCompareId,
  entryId,
  others,
}: {
  activeCompareId: string | null;
  entryId: string;
  others: readonly EntryReference[];
}) {
  return (
    <details
      className="border-border bg-surface rounded-xl border"
      open={activeCompareId !== null}
    >
      <summary className="text-brand-ink flex min-h-11 cursor-pointer items-center px-3 text-sm font-black">
        Compare with…
      </summary>
      <ul className="border-border grid gap-1 border-t p-2 sm:grid-cols-3">
        {others.map((other) => (
          <li key={other.id}>
            <Link
              aria-current={other.id === activeCompareId ? "true" : undefined}
              className="hover:bg-surface-subtle aria-[current=true]:bg-brand-soft aria-[current=true]:text-brand-ink flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold break-words"
              href={`/entries/${entryId}?compare=${other.id}`}
            >
              {other.participantName}
            </Link>
          </li>
        ))}
      </ul>
      {activeCompareId ? (
        <Link
          className="text-brand-ink border-border flex min-h-11 items-center border-t px-3 text-sm font-semibold underline"
          href={`/entries/${entryId}`}
        >
          Stop comparing
        </Link>
      ) : null}
    </details>
  );
}
