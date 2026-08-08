import Link from "next/link";

type LeaderboardEntryLinkProps = {
  entryId: string;
  participantName: string;
};

export function LeaderboardEntryLink({
  entryId,
  participantName,
}: LeaderboardEntryLinkProps) {
  return (
    <Link
      className="block font-black [overflow-wrap:anywhere] text-slate-950 underline decoration-slate-300 decoration-2 underline-offset-4 hover:decoration-slate-700"
      href={`/entries/${entryId}`}
    >
      {participantName}
    </Link>
  );
}
