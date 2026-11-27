"use client";

import { useEffect, type CSSProperties } from "react";
import {
  ArrowRight,
  ClipboardPaste,
  FileText,
  FolderOpen,
  Lock,
  Palette,
  PenLine,
  Sparkles,
} from "lucide-react";

import { relativeTime } from "@/components/app/documents-menu";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import type { DocumentSummary } from "@/lib/app/documents";
import { cn } from "@/lib/cn";
import { PRESET_IDS } from "@/lib/config/presets";
import { SAMPLES } from "@/lib/samples";

/**
 * What an empty document shows instead of an editor beside a blank page.
 *
 * The preview has nothing to show until there is text, so it is not shown at
 * all: this screen has the workspace to itself, and the editor and pages
 * arrive together the moment something is pasted, opened, picked or typed.
 */

/** Sheets of paper drifting in the background; pure decoration. */
function PaperBackdrop() {
  const sheets: { className: string; style: CSSProperties }[] = [
    { className: "left-[6%] top-[14%] h-44 w-32", style: { "--r": "-9deg", animationDuration: "11s" } as CSSProperties },
    { className: "left-[13%] bottom-[12%] h-36 w-28", style: { "--r": "6deg", animationDuration: "13s", animationDelay: "-4s" } as CSSProperties },
    { className: "right-[7%] top-[20%] h-48 w-36", style: { "--r": "8deg", animationDuration: "12s", animationDelay: "-2s" } as CSSProperties },
    { className: "right-[14%] bottom-[10%] h-32 w-24", style: { "--r": "-5deg", animationDuration: "10s", animationDelay: "-6s" } as CSSProperties },
  ];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(60%_60%_at_50%_0%,var(--primary-soft),transparent)]" />
      <div className="absolute inset-0 hidden lg:block">
        {sheets.map((sheet, index) => (
          <div
            key={index}
            className={cn(
              "absolute rounded-md border border-border bg-surface p-3 opacity-70 shadow-md animate-float",
              sheet.className,
            )}
            style={sheet.style}
          >
            <div className="h-2 w-3/5 rounded-full bg-border-strong/70" />
            {[100, 88, 94, 62, 0, 100, 80].map((width, line) =>
              width === 0 ? (
                <div key={line} className="h-2" />
              ) : (
                <div
                  key={line}
                  className="mt-1.5 h-1 rounded-full bg-border"
                  style={{ width: `${width}%` }}
                />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Feature({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5 [&_svg]:text-primary">
      {icon}
      {children}
    </span>
  );
}

export function StartScreen({
  modKey,
  showKeys,
  documents,
  onPaste,
  onOpenFile,
  onWrite,
  onSample,
  onOpenDocument,
}: {
  modKey: string;
  /** A keyboard and mouse are in use: mention the shortcuts. */
  showKeys: boolean;
  documents: DocumentSummary[];
  onPaste: () => void;
  onOpenFile: () => void;
  /** Start an empty document; `firstKey` is a key typed straight onto this screen. */
  onWrite: (firstKey?: string) => void;
  onSample: (id: string) => void;
  onOpenDocument: (id: string) => void;
}) {
  // Typing anywhere starts writing - nobody should have to find a button to
  // begin a document.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
      if (event.key === "?" || event.key === " ") return;
      const target = event.target as HTMLElement | null;
      // Keys meant for something else: a text field, a focused button or link
      // (Space and Enter activate those), or an open menu's type-ahead.
      if (
        target &&
        (target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName) ||
          target.closest('[role="menu"], [role="dialog"], [role="listbox"], [cmdk-root]'))
      ) {
        return;
      }
      event.preventDefault();
      onWrite(event.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onWrite]);

  const recent = documents.slice(0, 4);
  const stagger = (index: number): CSSProperties => ({ animationDelay: `${60 + index * 70}ms` });

  return (
    <div className="relative h-full overflow-y-auto overscroll-contain">
      <PaperBackdrop />

      <div className="relative mx-auto flex min-h-full w-full max-w-[44rem] flex-col items-center justify-center px-5 py-10 text-center sm:py-14">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft px-3 py-1 text-xs font-medium text-primary animate-fade-up"
          style={stagger(0)}
        >
          <Sparkles className="size-3.5" />
          Made for ChatGPT, Claude and Gemini answers
        </span>

        <h1
          className="mt-5 text-balance text-[2rem] font-semibold leading-[1.08] tracking-[-0.03em] text-foreground sm:text-5xl animate-fade-up"
          style={stagger(1)}
        >
          Turn any AI answer into a{" "}
          <span className="bg-gradient-to-r from-primary to-primary-2 bg-clip-text text-transparent">
            beautiful PDF
          </span>
        </h1>

        <p
          className="mt-4 max-w-[34rem] text-pretty text-[15px] leading-relaxed text-muted-foreground sm:text-base animate-fade-up"
          style={stagger(2)}
        >
          Paste a reply, pick a style, download. Arrows, emoji, tables, code and maths
          print exactly the way you see them.
        </p>

        <div
          className="mt-8 w-full rounded-3xl border border-border bg-surface/90 p-5 text-left shadow-lg backdrop-blur sm:p-7 animate-fade-up"
          style={stagger(3)}
        >
          <div className="flex items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-2 text-white shadow-md">
              <ClipboardPaste className="size-6 animate-bob" />
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold text-foreground">Paste your answer</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
                {showKeys ? (
                  <>
                    Press <Kbd>{modKey}</Kbd>
                    <Kbd>V</Kbd> anywhere, drop a Markdown file, or just start typing.
                  </>
                ) : (
                  "Copy an answer, then tap Paste. Formatting comes with it."
                )}
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <Button variant="primary" size="lg" onClick={onPaste}>
              <ClipboardPaste /> Paste
            </Button>
            <Button size="lg" onClick={onOpenFile}>
              <FolderOpen /> Open a file
            </Button>
            <Button variant="ghost" size="lg" onClick={() => onWrite()}>
              <PenLine /> Write
            </Button>
          </div>
        </div>

        <div
          className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 animate-fade-up"
          style={stagger(4)}
        >
          <Feature icon={<Sparkles />}>Every symbol and emoji prints</Feature>
          <Feature icon={<Palette />}>{PRESET_IDS.length} typeset styles</Feature>
          <Feature icon={<Lock />}>Private: saved only in your browser</Feature>
        </div>

        {recent.length > 0 && (
          <section className="mt-10 w-full text-left animate-fade-up" style={stagger(5)}>
            <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">
              Pick up where you left off
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {recent.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => onOpenDocument(document.id)}
                  className="group flex min-w-0 items-start gap-3 rounded-xl border border-border bg-surface p-3 text-left shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
                >
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted-foreground">
                    <FileText className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-foreground">
                      {document.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {relativeTime(document.updatedAt)}
                      {document.excerpt ? ` · ${document.excerpt}` : ""}
                    </span>
                  </span>
                  <ArrowRight className="mt-2 size-4 shrink-0 text-subtle-foreground opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="mt-8 animate-fade-up" style={stagger(6)}>
          <p className="text-xs text-muted-foreground">New here? See what it does with a sample</p>
          <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
            {SAMPLES.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => onSample(sample.id)}
                title={sample.description}
                className="h-8 rounded-full border border-border bg-surface px-3.5 text-xs font-medium text-foreground transition-[border-color,background-color,transform] hover:-translate-y-px hover:border-border-strong hover:bg-surface-hover"
              >
                {sample.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
