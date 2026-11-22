import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** A keyboard shortcut hint. `inverse` sits on a dark tooltip. */
export function Kbd({
  children,
  inverse = false,
  className,
}: {
  children: ReactNode;
  inverse?: boolean;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded px-1 font-sans text-[11px] font-medium leading-none",
        inverse
          ? "bg-background/15 text-background/80"
          : "border border-border bg-surface-2 text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
