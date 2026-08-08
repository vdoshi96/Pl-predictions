"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "./ui/cn";

type TeamMarkSize = "sm" | "md" | "lg";

export interface TeamMarkProps {
  name: string;
  src?: string | null;
  initials?: string | null;
  size?: TeamMarkSize;
  className?: string;
}

const sizeClasses: Record<TeamMarkSize, string> = {
  sm: "size-8 text-[0.58rem]",
  md: "size-10 text-[0.68rem]",
  lg: "size-12 text-xs",
};

const pixelSizes: Record<TeamMarkSize, number> = {
  sm: 32,
  md: 40,
  lg: 48,
};

function deriveInitials(name: string) {
  const words = name
    .replace(/&/g, " ")
    .split(/\s+/)
    .filter((word) => word && word.toLowerCase() !== "afc");

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }

  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function MonogramFallback({
  accessibleName,
  initials,
}: {
  accessibleName: string;
  initials: string;
}) {
  return (
    <span
      role="img"
      aria-label={accessibleName}
      className="bg-brand flex size-full items-center justify-center overflow-hidden rounded-[0.7rem] font-black tracking-tight text-white"
    >
      {initials}
    </span>
  );
}

export function TeamMark({
  name,
  src,
  initials,
  size = "md",
  className,
}: TeamMarkProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const initialsCandidate = initials?.trim();
  const resolvedInitials =
    initialsCandidate && /^[a-z0-9]{1,4}$/i.test(initialsCandidate)
      ? initialsCandidate.toUpperCase()
      : deriveInitials(initialsCandidate || name);
  const showImage = Boolean(src && failedSource !== src);
  const accessibleName = `${name} club mark`;

  return (
    <span
      className={cn(
        "ring-border relative inline-flex shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-offset-1 ring-offset-white",
        sizeClasses[size],
        className,
      )}
    >
      {showImage && src ? (
        <Image
          src={src}
          alt={accessibleName}
          width={pixelSizes[size]}
          height={pixelSizes[size]}
          className="size-full object-contain p-0.5"
          onError={() => setFailedSource(src)}
        />
      ) : (
        <MonogramFallback
          accessibleName={`${name} initials`}
          initials={resolvedInitials}
        />
      )}
    </span>
  );
}
