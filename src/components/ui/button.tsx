import type { ButtonHTMLAttributes } from "react";

import { cn } from "./cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-ink shadow-sm hover:bg-accent-yellow active:bg-accent-pressed",
  secondary:
    "border border-border bg-surface text-brand-ink shadow-sm hover:border-accent-lilac hover:bg-brand-soft active:bg-brand-pressed",
  ghost:
    "text-muted hover:bg-brand-soft hover:text-brand-ink active:bg-brand-pressed",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-500 active:bg-red-700",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-base",
  icon: "size-12 shrink-0 p-0",
};

export function Button({
  className,
  type = "button",
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "focus-visible:ring-accent-blue focus-visible:ring-offset-background inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-150 outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
