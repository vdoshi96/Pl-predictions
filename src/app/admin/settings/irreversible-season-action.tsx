"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { closeSeasonPermanently } from "./actions";

const INITIAL_ACTION_STATE = {
  changed: false,
  message: "",
  ok: false,
} as const;

type IrreversibleSeasonActionProps = Readonly<{
  confirmationPhrase: "LOCK" | "REVEAL";
  description: string;
  disabled: boolean;
  intent: "lock" | "reveal";
  title: string;
}>;

export function IrreversibleSeasonAction({
  confirmationPhrase,
  description,
  disabled,
  intent,
  title,
}: IrreversibleSeasonActionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [state, formAction, pending] = useActionState(
    closeSeasonPermanently,
    INITIAL_ACTION_STATE,
  );

  /* eslint-disable react-hooks/set-state-in-effect -- the server-action result is an external state transition; a successful close must dismiss and clear the confirmation dialog. */
  useEffect(() => {
    if (state.ok && state.message) {
      setOpen(false);
      setPhrase("");
      router.refresh();
    }
  }, [router, state.message, state.ok]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return;
    setOpen(nextOpen);
    if (!nextOpen) setPhrase("");
  }

  return (
    <div className="border-danger/35 bg-danger-soft/60 rounded-2xl border p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle
          aria-hidden="true"
          className="text-danger mt-0.5 size-5 shrink-0"
        />
        <div className="min-w-0 grow">
          <h2 className="text-foreground font-black">{title}</h2>
          <p className="text-muted mt-1 text-sm leading-6">{description}</p>
          <Dialog.Root open={open} onOpenChange={handleOpenChange}>
            <Dialog.Trigger asChild>
              <Button
                className="mt-3 w-full sm:w-fit"
                disabled={disabled}
                variant="danger"
              >
                {disabled ? "Season permanently closed" : title}
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="bg-brand-strong/75 fixed inset-0 z-50 backdrop-blur-[2px]" />
              <Dialog.Content
                aria-describedby={`${intent}-season-action-description`}
                className="border-danger/35 bg-surface fixed inset-x-3 top-1/2 z-50 mx-auto w-auto max-w-lg -translate-y-1/2 rounded-2xl border p-5 shadow-2xl outline-none sm:inset-x-auto sm:left-1/2 sm:w-[min(32rem,calc(100vw-2rem))] sm:-translate-x-1/2"
                onEscapeKeyDown={(event) => {
                  if (pending) event.preventDefault();
                }}
                onInteractOutside={(event) => {
                  if (pending) event.preventDefault();
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Dialog.Title className="text-foreground text-xl font-black">
                      {title}?
                    </Dialog.Title>
                    <Dialog.Description
                      className="text-muted mt-2 text-sm leading-6"
                      id={`${intent}-season-action-description`}
                    >
                      This permanently closes submissions and reveals every
                      prediction. There is no undo.
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <Button
                      aria-label={`Cancel ${title.toLowerCase()}`}
                      className="-mt-2 -mr-2"
                      disabled={pending}
                      onClick={() => handleOpenChange(false)}
                      size="icon"
                      variant="ghost"
                    >
                      <X aria-hidden="true" className="size-5" />
                    </Button>
                  </Dialog.Close>
                </div>

                <form action={formAction} className="mt-5 grid gap-4">
                  <input name="intent" type="hidden" value={intent} />
                  <div>
                    <label
                      className="text-foreground text-sm font-black"
                      htmlFor={`${intent}-confirmation-phrase`}
                    >
                      Type {confirmationPhrase} to confirm
                    </label>
                    <input
                      autoComplete="off"
                      className="border-border bg-surface text-foreground focus:border-danger/35 focus:ring-danger/25 mt-1 min-h-12 w-full rounded-xl border px-3.5 text-base font-bold outline-none focus:ring-2"
                      disabled={pending}
                      id={`${intent}-confirmation-phrase`}
                      name="confirmationPhrase"
                      onChange={(event) => setPhrase(event.target.value)}
                      spellCheck={false}
                      value={phrase}
                    />
                  </div>

                  {!state.ok && state.message ? (
                    <p className="text-danger text-sm font-bold" role="alert">
                      {state.message}
                    </p>
                  ) : null}

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Dialog.Close asChild>
                      <Button
                        disabled={pending}
                        onClick={() => handleOpenChange(false)}
                        variant="secondary"
                      >
                        Cancel
                      </Button>
                    </Dialog.Close>
                    <Button
                      aria-busy={pending}
                      disabled={pending || phrase !== confirmationPhrase}
                      type="submit"
                      variant="danger"
                    >
                      {pending
                        ? "Closing season…"
                        : `Confirm ${confirmationPhrase}`}
                    </Button>
                  </div>
                </form>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>

      {state.ok && state.message ? (
        <p className="text-muted mt-3 text-sm font-bold" role="status">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
