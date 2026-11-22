"use client";

import type { ComponentProps, ReactNode } from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";

import { cn } from "@/lib/cn";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;
export const DialogTitle = D.Title;
export const DialogDescription = D.Description;

const OVERLAY = "fixed inset-0 z-50 bg-[rgb(15_14_12/0.42)] backdrop-blur-[2px] animate-fade-in";

/** A centred modal: shortcuts, confirmations. */
export function DialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof D.Content>) {
  return (
    <D.Portal>
      <D.Overlay className={OVERLAY} />
      <D.Content
        className={cn(
          "fixed inset-x-0 top-[10vh] z-50 mx-auto w-[min(560px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-border bg-surface text-foreground shadow-lg outline-none animate-pop-in",
          className,
        )}
        {...props}
      >
        {children}
      </D.Content>
    </D.Portal>
  );
}

/**
 * A panel that slides in from an edge: settings on tablets (right) and phones
 * (bottom). Radix supplies the focus trap, Escape, and scroll locking.
 */
export function SheetContent({
  side = "right",
  title,
  description,
  actions,
  className,
  children,
  ...props
}: ComponentProps<typeof D.Content> & {
  side?: "right" | "bottom";
  title: ReactNode;
  /** Read by screen readers; not shown. */
  description: string;
  /** Extra controls in the sheet's header, before the close button. */
  actions?: ReactNode;
}) {
  return (
    <D.Portal>
      <D.Overlay className={OVERLAY} />
      <D.Content
        className={cn(
          "fixed z-50 flex flex-col bg-surface text-foreground shadow-lg outline-none",
          side === "right"
            ? "inset-y-0 right-0 w-[min(420px,100vw)] border-l border-border animate-sheet-in-right"
            : "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[20px] border-t border-border pb-safe animate-sheet-in-bottom",
          className,
        )}
        {...props}
      >
        {side === "bottom" && (
          <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border-strong" />
        )}
        <div className="flex shrink-0 items-center gap-2 px-4 py-3">
          <D.Title className="min-w-0 flex-1 truncate text-[15px] font-semibold">{title}</D.Title>
          <D.Description className="sr-only">{description}</D.Description>
          {actions}
          <D.Close
            aria-label="Close"
            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <X className="size-[18px]" />
          </D.Close>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </D.Content>
    </D.Portal>
  );
}
