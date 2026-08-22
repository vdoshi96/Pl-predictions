"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface AlphabeticalOrderDialogProps {
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function AlphabeticalOrderDialog({
  onConfirm,
  onOpenChange,
  open,
}: AlphabeticalOrderDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-brand-strong/75 fixed inset-0 z-50 backdrop-blur-[2px] data-[state=closed]:animate-none motion-reduce:animate-none" />
        <Dialog.Content className="border-border bg-surface fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-5 shadow-2xl outline-none sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <span className="bg-warning-soft text-warning grid size-11 shrink-0 place-items-center rounded-xl">
              <AlertTriangle aria-hidden="true" className="size-5" />
            </span>
            <Dialog.Close asChild>
              <Button
                aria-label="Close alphabetical table warning"
                className="-mt-2 -mr-2 size-11"
                size="icon"
                variant="ghost"
              >
                <X aria-hidden="true" className="size-5" />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Title className="text-brand-ink-strong mt-4 text-xl font-black tracking-tight">
            This table is still alphabetical
          </Dialog.Title>
          <Dialog.Description className="text-muted mt-2 text-sm leading-6">
            The A–Z order is only a blank slate, not last season’s table or a
            suggested prediction. Continue only if this exact order is really
            what you want.
          </Dialog.Description>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Dialog.Close asChild>
              <Button size="lg" variant="secondary">
                Keep editing
              </Button>
            </Dialog.Close>
            <Button size="lg" onClick={onConfirm}>
              Yes, use A–Z
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
