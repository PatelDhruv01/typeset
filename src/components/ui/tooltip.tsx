"use client";

import type { ReactElement, ReactNode } from "react";
import { Tooltip as T } from "radix-ui";

import { Kbd } from "@/components/ui/kbd";

export const TooltipProvider = T.Provider;

/**
 * A short label, and the shortcut if there is one, for an icon-only control.
 * The trigger still needs its own aria-label: tooltips never reach touch users
 * and are not a substitute for an accessible name.
 */
export function Tip({
  label,
  shortcut,
  side = "bottom",
  children,
}: {
  label: ReactNode;
  shortcut?: string;
  side?: "top" | "right" | "bottom" | "left";
  children: ReactElement;
}) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="z-[70] flex items-center gap-2 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-md animate-fade-in"
        >
          {label}
          {shortcut && <Kbd inverse>{shortcut}</Kbd>}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
