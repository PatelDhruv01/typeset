"use client";

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { Check, ChevronDown, Download, FileCode2, FileText, LoaderCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogTrigger, SheetContent } from "@/components/ui/dialog";
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
  // Every keystroke is committed. This used to wait for blur - but clicking
  // Download closes this popover, unmounting the field without a blur, so a
  // freshly typed name was silently dropped. The draft is kept separately only
  // so an emptied field can show nothing while focused and fall back to the
  // automatic name afterwards.
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  const atFocus = useRef<{ value: string; overridden: boolean } | null>(null);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  const commit = (next: string) => {
    const trimmed = next.trim();
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
              atFocus.current = { value, overridden };
              event.currentTarget.select();
            }}
            onChange={(event) => {
              setDraft(event.target.value);
              commit(event.target.value);
            }}
            onBlur={() => {
              focused.current = false;
              setDraft(value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape" && atFocus.current) {
                // Undo this editing session, not the whole history.
                const before = atFocus.current;
                setDraft(before.value);
                onCommit(before.overridden ? before.value : null);
              }
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

/** Wraps a control so activating it also closes its popover or sheet. */
type CloseWrapper = (props: { children: ReactElement }) => ReactElement;

const ClosePopover: CloseWrapper = ({ children }) => <PopoverClose asChild>{children}</PopoverClose>;
const CloseSheet: CloseWrapper = ({ children }) => <DialogClose asChild>{children}</DialogClose>;

function Option({
  icon,
  title,
  description,
  onClick,
  disabled,
  close: Close,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  close: CloseWrapper;
}) {
  return (
    <Close>
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
    </Close>
  );
}

function ExportOptions(props: ExportProps & { close: CloseWrapper }) {
  return (
    <div className="p-3">
      <FileNameField
        value={props.fileName}
        overridden={props.fileNameOverridden}
        onCommit={props.onRename}
      />
      <p className="mt-3 border-t border-border pt-3 text-xs font-medium text-muted-foreground">
        Also download as
      </p>
      <div className="-mx-1 mt-1 grid gap-0.5">
        <Option
          icon={<FileCode2 />}
          title="Web page (HTML)"
          description="One self-contained file that opens in any browser, offline."
          onClick={props.onHtml}
          disabled={props.disabled}
          close={props.close}
        />
        <Option
          icon={<FileText />}
          title="Markdown"
          description="The source text, to keep or edit elsewhere."
          onClick={props.onMarkdown}
          disabled={props.disabled}
          close={props.close}
        />
      </div>
    </div>
  );
}

/** The primary action: Download PDF, with the other formats one click away. */
export function ExportButton(props: ExportProps & { compact?: boolean; done?: boolean }) {
  const { busy, disabled, compact, modKey, onPdf, done = false } = props;

  // Busy, then a moment of "Downloaded" - so the button itself answers "did
  // that work?" without anyone having to look for a toast.
  const icon = busy ? (
    <LoaderCircle className="animate-spin" />
  ) : done ? (
    <Check key="done" className="animate-pop-in" strokeWidth={2.75} />
  ) : (
    <Download key="idle" />
  );

  // Phones: the button opens a sheet, so the file can be named before it is
  // saved - there is no room for a split button and its menu in the header.
  if (compact) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="primary"
            size="icon"
            disabled={disabled || busy}
            aria-label={busy ? "Creating PDF" : done ? "PDF downloaded" : "Download"}
          >
            {icon}
          </Button>
        </DialogTrigger>
        <SheetContent
          side="bottom"
          title="Download"
          description="Name the file, then download it as a PDF, a web page or Markdown."
        >
          <div className="px-4">
            <CloseSheet>
              <Button variant="primary" size="lg" className="w-full" onClick={onPdf} disabled={busy}>
                <Download /> Download PDF
              </Button>
            </CloseSheet>
          </div>
          <div className="px-1 pb-3">
            <ExportOptions {...props} close={CloseSheet} />
          </div>
        </SheetContent>
      </Dialog>
    );
  }

  return (
    <div className="flex shrink-0 items-center">
      <Tip label="Download PDF" shortcut={`${modKey} S`}>
        <Button
          variant="primary"
          onClick={onPdf}
          disabled={disabled || busy}
          className="min-w-[10.5rem] rounded-r-none pr-3"
        >
          {icon}
          {busy ? "Creating PDF…" : done ? "Downloaded" : "Download PDF"}
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
          <ExportOptions {...props} close={ClosePopover} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
