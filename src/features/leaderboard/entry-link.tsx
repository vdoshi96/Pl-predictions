import Link from "next/link";

import { cn } from "@/components/ui/cn";

type LeaderboardEntryLinkProps = {
  entryId: string;
  participantName: string;
  className?: string;
};

export function LeaderboardEntryLink({
  entryId,
  participantName,
  className,
}: LeaderboardEntryLinkProps) {
  return (
    <Link
      className={cn(
        "inline-flex min-h-11 min-w-0 items-center font-black [overflow-wrap:break-word] text-slate-950 underline decoration-slate-300 decoration-2 underline-offset-4 hover:decoration-slate-700",
        className,
      )}
      href={`/entries/${entryId}`}
    >
      {participantName}
    </Link>
  );
}
