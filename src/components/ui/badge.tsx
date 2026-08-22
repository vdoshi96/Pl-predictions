import type { HTMLAttributes } from "react";

import { cn } from "./cn";

type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-brand-soft text-brand-ink ring-border",
  accent: "bg-sky-soft text-brand-ink ring-accent-blue",
  success: "bg-mint text-mint-ink ring-accent",
  warning: "bg-warning-soft text-warning ring-warning/35",
  danger: "bg-danger-soft text-danger ring-danger/35",
};

export function Badge({
  className,
  variant = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs leading-5 font-semibold ring-1 ring-inset",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
