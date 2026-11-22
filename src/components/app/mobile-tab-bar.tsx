"use client";

import type { ReactNode } from "react";
import { Eye, Palette, PenLine } from "lucide-react";

import { cn } from "@/lib/cn";

export type MobileView = "write" | "preview";

function Tab({
  active,
  label,
  icon,
  badge,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors [&_svg]:size-[22px]",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-0 h-0.5 w-10 rounded-full bg-primary transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
      />
      <span className="relative">
        {icon}
        {badge && (
          <span className="absolute -right-3 -top-1.5 min-w-4 rounded-full bg-foreground px-1 text-center text-[10px] leading-4 text-background">
            {badge}
          </span>
        )}
      </span>
      {label}
    </button>
  );
}

/** Phones: one pane at a time, switched from the bottom where thumbs reach. */
export function MobileTabBar({
  view,
  onViewChange,
  onStyle,
  styleOpen,
  pages,
}: {
  view: MobileView;
  onViewChange: (view: MobileView) => void;
  onStyle: () => void;
  styleOpen: boolean;
  pages: number;
}) {
  return (
    <nav
      aria-label="Views"
      className="flex shrink-0 border-t border-border bg-surface pb-safe"
    >
      <div className="flex h-16 w-full">
        <Tab
          active={view === "write" && !styleOpen}
          label="Write"
          icon={<PenLine />}
          onClick={() => onViewChange("write")}
        />
        <Tab
          active={view === "preview" && !styleOpen}
          label="Preview"
          icon={<Eye />}
          badge={pages > 0 ? String(pages) : undefined}
          onClick={() => onViewChange("preview")}
        />
        <Tab active={styleOpen} label="Style" icon={<Palette />} onClick={onStyle} />
      </div>
    </nav>
  );
}
