"use client";

import type { ComponentProps } from "react";
import { Popover as P } from "radix-ui";

import { cn } from "@/lib/cn";

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverClose = P.Close;
export const PopoverAnchor = P.Anchor;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 8,
  ...props
}: ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          "z-50 max-h-[var(--radix-popover-content-available-height)] overflow-hidden rounded-xl border border-border bg-surface text-foreground shadow-lg outline-none animate-pop-in",
          className,
        )}
        {...props}
      />
    </P.Portal>
  );
}
