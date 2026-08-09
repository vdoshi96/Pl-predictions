"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button aria-busy={pending} disabled={pending} size="lg" type="submit">
      {pending ? "Signing in…" : "Sign in securely"}
    </Button>
  );
}
