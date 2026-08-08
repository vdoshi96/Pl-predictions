"use client";

import type { ButtonHTMLAttributes } from "react";

import { Button } from "./ui/button";

type ConfirmSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  confirmation: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
};

export function ConfirmSubmitButton({
  confirmation,
  onClick,
  ...props
}: ConfirmSubmitButtonProps) {
  return (
    <Button
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !window.confirm(confirmation)) {
          event.preventDefault();
        }
      }}
      type="submit"
    />
  );
}
