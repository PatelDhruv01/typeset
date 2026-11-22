"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Download, FileCode2, FileText, LoaderCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

type ExportProps = {
  busy: boolean;
  disabled: boolean;
  modKey: string;
  fileName: string;
  fileNameOverridden: boolean;
  onRename: (name: string | null) => void;
  onPdf: () => void;
  onHtml: () => void;
  onMarkdown: () => void;
};

function FileNameField({
  value,
  overridden,
  onCommit,
}: {
  value: string;
  overridden: boolean;
  onCommit: (name: string | null) => void;
}) {
  // A draft of its own, committed on blur or Enter: renaming mid-word must not
  // re-render the whole document on every keystroke.
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === value) return;
    onCommit(trimmed === "" ? null : trimmed);
  };

  return (
    <div>
      <label htmlFor="export-file-name" className="text-xs font-medium text-muted-foreground">
        File name
      </label>
      <div className="mt-1.5 flex items-center gap-1.5">
        <div className="flex h-9 min-w-0 flex-1 items-center rounded-lg border border-input bg-surface shadow-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/15">
          <input
            id="export-file-name"
            value={draft}
            onFocus={(event) => {
              focused.current = true;
              event.currentTarget.select();
            }}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              focused.current = false;
              commit();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") setDraft(value);
            }}
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent pl-2.5 text-[13px] outline-none focus-visible:outline-none"
          />
          <span className="pr-2.5 text-[13px] text-subtle-foreground">.pdf</span>
        </div>
        {overridden && (
          <Tip label="Use the automatic name">
            <Button
              variant="muted"
              size="icon-sm"
              aria-label="Use the automatic name"
              onClick={() => onCommit(null)}
            >
              <RotateCcw />
            </Button>
          </Tip>
        )}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-subtle-foreground">
        {overridden
          ? "Your own name. Reset to name the file after the document's title."
          : "Taken from the document's title. Type to change it."}
      </p>
    </div>
  );
}

function Option({
  icon,
  title,
  description,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <PopoverClose asChild>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex w-full items-start gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-[18px] [&_svg]:text-muted-foreground"
      >
        <span className="mt-0.5 shrink-0">{icon}</span>
        <span className="min-w-0">
          <span className="block text-[13px] font-medium">{title}</span>
          <span className="block text-xs leading-snug text-muted-foreground">{description}</span>
        </span>
      </button>
    </PopoverClose>
  );
}

function ExportOptions(props: ExportProps) {
  return (
    <div className="p-3">
      <FileNameField
        value={props.fileName}
        overridden={props.fileNameOverridden}
        onCommit={props.onRename}
      />
      <div className="-mx-1 mt-3 grid gap-0.5 border-t border-border pt-2">
        <Option
          icon={<Download />}
          title="PDF"
          description="Print-ready, with page numbers and running heads."
          onClick={props.onPdf}
          disabled={props.disabled || props.busy}
        />
        <Option
          icon={<FileCode2 />}
          title="Web page (HTML)"
          description="One self-contained file that opens in any browser, offline."
          onClick={props.onHtml}
          disabled={props.disabled}
        />
        <Option
          icon={<FileText />}
          title="Markdown"
          description="The source text, to keep or edit elsewhere."
          onClick={props.onMarkdown}
          disabled={props.disabled}
        />
      </div>
    </div>
  );
}

/** The primary action: Download PDF, with the other formats one click away. */
export function ExportButton(props: ExportProps & { compact?: boolean }) {
  const { busy, disabled, compact, modKey, onPdf } = props;

  if (compact) {
    return (
      <Button
        variant="primary"
        size="icon"
        onClick={onPdf}
        disabled={disabled || busy}
        aria-label={busy ? "Creating PDF" : "Download PDF"}
      >
        {busy ? <LoaderCircle className="animate-spin" /> : <Download />}
      </Button>
    );
  }

  return (
    <div className="flex shrink-0 items-center">
      <Tip label="Download PDF" shortcut={`${modKey} S`}>
        <Button
          variant="primary"
          onClick={onPdf}
          disabled={disabled || busy}
          className="rounded-r-none pr-3"
        >
          {busy ? <LoaderCircle className="animate-spin" /> : <Download />}
          {busy ? "Creating PDF…" : "Download PDF"}
        </Button>
      </Tip>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="primary"
            aria-label="More download options"
            disabled={disabled}
            className={cn(
              "rounded-l-none border-l border-white/25 px-2 dark:border-black/20",
              "data-[state=open]:bg-primary-hover",
            )}
          >
            <ChevronDown />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(340px,calc(100vw-24px))]">
          <ExportOptions {...props} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
