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
        "text-foreground decoration-muted hover:decoration-muted inline-flex min-h-11 min-w-0 items-center font-black [overflow-wrap:break-word] underline decoration-2 underline-offset-4",
        className,
      )}
      href={`/entries/${entryId}`}
    >
      {participantName}
    </Link>
  );
}
