"use client";

import { useState } from "react";
import { ChevronDown, FileText, Lock, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DocumentSummary } from "@/lib/app/documents";
import type { SaveState } from "@/lib/app/use-workspace";
import { cn } from "@/lib/cn";

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

export function relativeTime(timestamp: number, now = Date.now()): string {
  const seconds = Math.round((timestamp - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), "hour");
  if (abs < 7 * 86_400) return relative.format(Math.round(seconds / 86_400), "day");
  return dateFormat.format(timestamp);
}

function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <span
      aria-live="polite"
      className={cn(
        "flex shrink-0 items-center gap-1.5 text-xs",
        state === "error" ? "text-destructive" : "text-subtle-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          state === "saved" && "bg-success",
          state === "saving" && "animate-pulse bg-subtle-foreground",
          state === "error" && "bg-destructive",
        )}
      />
      {state === "saved" ? "Saved" : state === "saving" ? "Saving…" : "Not saved"}
    </span>
  );
}

export function DocumentsMenu({
  title,
  currentId,
  documents,
  saveState,
  showSaveState = true,
  onOpen,
  onCreate,
  onDelete,
  className,
}: {
  title: string;
  currentId: string;
  documents: DocumentSummary[];
  saveState: SaveState;
  showSaveState?: boolean;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="group flex h-9 min-w-0 items-center gap-1.5 rounded-lg px-2 text-left transition-colors hover:bg-surface-hover data-[state=open]:bg-surface-hover"
            aria-label={`Documents. Current: ${title}`}
          >
            <span className="truncate text-sm font-medium text-foreground">{title}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="flex w-[min(380px,calc(100vw-24px))] flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <span className="text-[13px] font-semibold">Documents</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onCreate();
                setOpen(false);
              }}
            >
              <Plus /> New
            </Button>
          </div>

          {documents.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <FileText className="mx-auto size-6 text-subtle-foreground" />
              <p className="mt-2 text-[13px] font-medium">No saved documents yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Everything you write is saved here automatically.
              </p>
            </div>
          ) : (
            <ul className="max-h-[min(420px,60dvh)] overflow-y-auto overscroll-contain p-1.5">
              {documents.map((document) => {
                const active = document.id === currentId;
                return (
                  <li key={document.id} className="group/item relative">
                    <button
                      type="button"
                      onClick={() => {
                        onOpen(document.id);
                        setOpen(false);
                      }}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex w-full min-w-0 flex-col rounded-lg py-2 pl-3 pr-10 text-left transition-colors hover:bg-surface-hover",
                        active && "bg-surface-2",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {active && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                        <span className="truncate text-[13px] font-medium text-foreground">
                          {document.title}
                        </span>
                      </span>
                      {document.excerpt && (
                        <span className="mt-0.5 truncate text-xs text-muted-foreground">
                          {document.excerpt}
                        </span>
                      )}
                      <span className="mt-1 text-[11px] text-subtle-foreground">
                        {relativeTime(document.updatedAt)} · {document.words.toLocaleString()}{" "}
                        {document.words === 1 ? "word" : "words"}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${document.title}`}
                      onClick={() => onDelete(document.id)}
                      className="absolute right-1.5 top-2 grid size-8 place-items-center rounded-md text-subtle-foreground opacity-0 transition-[opacity,color,background-color] hover:bg-destructive-soft hover:text-destructive focus-visible:opacity-100 group-hover/item:opacity-100 [@media(hover:none)]:opacity-100"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            <Lock className="size-3.5 shrink-0" />
            Saved privately in this browser. Nothing is uploaded until you download a PDF.
          </div>
        </PopoverContent>
      </Popover>

      {showSaveState && <SaveIndicator state={saveState} />}
    </div>
  );
}
