import type { HTMLAttributes } from "react";

import { cn } from "./cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.45)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("min-w-0 p-4 pb-0 sm:p-6 sm:pb-0", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 p-4 sm:p-6", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("min-w-0 border-t border-slate-100 p-4 sm:p-6", className)}
      {...props}
    />
  );
}
