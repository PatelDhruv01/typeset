"use client";

import { useRef } from "react";

import { cn } from "@/lib/cn";

/**
 * The draggable border between editor and preview. Pointer capture keeps the
 * drag alive when the pointer crosses the preview iframe, which would
 * otherwise swallow the move events. Arrow keys resize too; double-click
 * restores the default width.
 */
export function Splitter({
  value,
  min,
  max,
  onChange,
  onReset,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onReset: () => void;
}) {
  const drag = useRef<{ startX: number; startValue: number } | null>(null);
  const clamp = (next: number) => Math.round(Math.min(max, Math.max(min, next)));

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize editor"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { startX: event.clientX, startValue: value };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        onChange(clamp(drag.current.startValue + event.clientX - drag.current.startX));
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        drag.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") onChange(clamp(value - 24));
        if (event.key === "ArrowRight") onChange(clamp(value + 24));
      }}
      className={cn(
        "group relative z-10 -mx-[3px] w-[7px] shrink-0 cursor-col-resize touch-none outline-none",
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-[3px] w-px bg-border transition-colors group-hover:bg-primary/60 group-focus-visible:bg-primary group-active:bg-primary"
      />
    </div>
  );
}
