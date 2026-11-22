"use client";

import type { ReactNode } from "react";
import { ToggleGroup } from "radix-ui";

import { cn } from "@/lib/cn";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  /** Accessible name when the label is an icon only. */
  ariaLabel?: string;
};

/**
 * One of a few mutually exclusive views: Write / Preview, Pages / Continuous.
 * Arrow keys move between options; one is always selected.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "sm",
  stretch = false,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  label: string;
  size?: "sm" | "md";
  /** Fill the available width, options sharing it equally. */
  stretch?: boolean;
  className?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as T);
      }}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5",
        stretch && "flex w-full",
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          aria-label={option.ariaLabel}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 font-medium text-muted-foreground transition-[color,background-color,box-shadow] duration-150",
            "hover:text-foreground data-[state=on]:bg-surface data-[state=on]:text-foreground data-[state=on]:shadow-sm dark:data-[state=on]:bg-surface-hover",
            "[&_svg]:size-4 [&_svg]:shrink-0",
            size === "sm" ? "h-7 text-[13px]" : "h-8 text-sm",
            stretch && "flex-1",
          )}
        >
          {option.icon}
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
