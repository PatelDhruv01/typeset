"use client";

import { TriangleAlert } from "lucide-react";

import type { PreviewStatus } from "@/components/paginated-preview";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 230));
}

/** Characters no bundled font can draw - named, rather than left as boxes. */
function MissingGlyphs({ characters }: { characters: string[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-6 items-center gap-1.5 rounded-md bg-warning-soft px-2 font-medium text-warning transition-colors hover:brightness-95"
        >
          <TriangleAlert className="size-3.5" />
          {characters.length === 1
            ? "1 character can't be printed"
            : `${characters.length} characters can't be printed`}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-80 p-4">
        <p className="text-[13px] font-medium">These won&apos;t appear in the PDF</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          None of the bundled fonts can draw them, so they would print as empty boxes.
          Chinese, Japanese and Korean text is not supported yet.
        </p>
        <p className="mt-3 break-all rounded-lg bg-surface-2 p-2.5 font-mono text-sm">
          {characters.slice(0, 60).join(" ")}
          {characters.length > 60 ? " …" : ""}
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function StatusBar({
  words,
  headings,
  missing,
  status,
  paginate,
}: {
  words: number;
  headings: number;
  missing: string[];
  status: PreviewStatus;
  paginate: boolean;
}) {
  return (
    <footer className="flex h-8 shrink-0 items-center gap-4 border-t border-border bg-surface px-4 text-xs text-muted-foreground">
      <span className="tabular-nums">
        {words.toLocaleString()} {words === 1 ? "word" : "words"}
      </span>
      {words > 0 && <span className="hidden sm:inline">{readingMinutes(words)} min read</span>}
      {headings > 0 && (
        <span className="hidden tabular-nums md:inline">
          {headings} {headings === 1 ? "heading" : "headings"}
        </span>
      )}
      {missing.length > 0 && <MissingGlyphs characters={missing} />}

      {/* Progress is shown on the preview itself; this only reports the result. */}
      <span className="ml-auto flex items-center gap-1.5 tabular-nums">
        {status.state === "ready" && paginate && (
          <>
            {status.pages} {status.pages === 1 ? "page" : "pages"}
            <span className="text-subtle-foreground">· laid out in {(status.ms / 1000).toFixed(1)}s</span>
          </>
        )}
      </span>
    </footer>
  );
}
