"use client";

import { UserRound } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { cn } from "./ui/cn";

type PlayerMarkSize = "sm" | "md" | "lg";

export interface PlayerMarkProps {
  className?: string;
  decorative?: boolean;
  name: string;
  size?: PlayerMarkSize;
  src?: string | null;
}

const sizeClasses: Record<PlayerMarkSize, string> = {
  sm: "size-8",
  md: "size-10",
  lg: "size-12",
};

const pixelSizes: Record<PlayerMarkSize, number> = {
  sm: 32,
  md: 40,
  lg: 48,
};

export function PlayerMark({
  className,
  decorative = false,
  name,
  size = "md",
  src,
}: PlayerMarkProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const showImage = Boolean(src && failedSource !== src);
  const accessibility = decorative
    ? ({ "aria-hidden": true } as const)
    : ({ "aria-label": `${name} player portrait`, role: "img" } as const);

  return (
    <span
      {...accessibility}
      className={cn(
        "ring-border bg-brand-soft text-brand relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl ring-1 ring-offset-1 ring-offset-white",
        sizeClasses[size],
        className,
      )}
    >
      {showImage && src ? (
        <Image
          src={src}
          alt=""
          width={pixelSizes[size]}
          height={pixelSizes[size]}
          className="size-full object-cover"
          onError={() => setFailedSource(src)}
        />
      ) : (
        <UserRound aria-hidden="true" className="size-1/2" strokeWidth={2.25} />
      )}
    </span>
  );
}
