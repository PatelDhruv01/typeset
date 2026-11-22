"use client";

import type { ReactNode, RefObject } from "react";
import {
  Bold,
  ClipboardPaste,
  Code,
  FolderOpen,
  Heading2,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  SquareCode,
  Strikethrough,
  Table2,
  TextQuote,
} from "lucide-react";

import {
  MarkdownEditor,
  type ClipboardPayload,
  type EditorHandle,
} from "@/components/markdown-editor";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tip } from "@/components/ui/tooltip";
import { SAMPLES } from "@/lib/samples";

const TABLE_TEMPLATE = "\n| Column | Column |\n| --- | --- |\n| Cell | Cell |\n";

function ToolButton({
  label,
  shortcut,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tip label={label} shortcut={shortcut}>
      <button
        type="button"
        aria-label={label}
        // Keep the editor's selection: a mousedown on the button would
        // otherwise move focus away and collapse it before the click lands.
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
        className="grid size-[30px] shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground [&_svg]:size-4"
      >
        {children}
      </button>
    </Tip>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

export function FormattingToolbar({
  editor,
  modKey,
}: {
  editor: RefObject<EditorHandle | null>;
  modKey: string;
}) {
  const run = (action: (handle: EditorHandle) => void) => () => {
    if (editor.current) action(editor.current);
  };

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex h-11 shrink-0 items-center overflow-x-auto border-b border-border px-2 [scrollbar-width:none]"
    >
      <ToolButton label="Heading" onClick={run((e) => e.toggleLinePrefix(() => "## ", /^#{1,6}\s+/))}>
        <Heading2 />
      </ToolButton>
      <ToolButton label="Bold" shortcut={`${modKey} B`} onClick={run((e) => e.wrap("**", "**", "bold text"))}>
        <Bold />
      </ToolButton>
      <ToolButton label="Italic" shortcut={`${modKey} I`} onClick={run((e) => e.wrap("*", "*", "italic text"))}>
        <Italic />
      </ToolButton>
      <ToolButton label="Strikethrough" onClick={run((e) => e.wrap("~~", "~~", "text"))}>
        <Strikethrough />
      </ToolButton>
      <Divider />
      <ToolButton label="Bulleted list" onClick={run((e) => e.toggleLinePrefix(() => "- ", /^[-*+]\s+(?!\[[ xX]\])/))}>
        <List />
      </ToolButton>
      <ToolButton
        label="Numbered list"
        onClick={run((e) => e.toggleLinePrefix((index) => `${index + 1}. `, /^\d+[.)]\s+/))}
      >
        <ListOrdered />
      </ToolButton>
      <ToolButton label="Checklist" onClick={run((e) => e.toggleLinePrefix(() => "- [ ] ", /^[-*+]\s+\[[ xX]\]\s+/))}>
        <ListChecks />
      </ToolButton>
      <ToolButton label="Quote" onClick={run((e) => e.toggleLinePrefix(() => "> ", /^>\s?/))}>
        <TextQuote />
      </ToolButton>
      <Divider />
      <ToolButton label="Inline code" shortcut={`${modKey} E`} onClick={run((e) => e.wrap("`", "`", "code"))}>
        <Code />
      </ToolButton>
      <ToolButton label="Code block" onClick={run((e) => e.wrap("\n```\n", "\n```\n", "code"))}>
        <SquareCode />
      </ToolButton>
      <ToolButton label="Link" onClick={run((e) => e.link())}>
        <Link2 />
      </ToolButton>
      <ToolButton label="Table" onClick={run((e) => e.insert(TABLE_TEMPLATE))}>
        <Table2 />
      </ToolButton>
      <ToolButton label="Divider" onClick={run((e) => e.insert("\n---\n"))}>
        <Minus />
      </ToolButton>
    </div>
  );
}

/**
 * What an empty document shows: the one thing most people came to do - paste
 * a chatbot answer - made obvious, with the alternatives beside it.
 */
function EmptyState({
  modKey,
  showKeyHint,
  onPaste,
  onOpenFile,
  onSample,
}: {
  modKey: string;
  showKeyHint: boolean;
  onPaste: () => void;
  onOpenFile: () => void;
  onSample: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-y-auto p-5">
      <div className="pointer-events-auto w-full max-w-[25rem] rounded-2xl border border-border bg-surface p-6 text-center shadow-md animate-pop-in">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
          <ClipboardPaste className="size-6" />
        </span>
        <h2 className="mt-4 text-lg font-semibold tracking-[-0.01em]">Paste a chatbot answer</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          Copy a reply from ChatGPT, Claude or Gemini and paste it here. Headings, tables,
          code, maths and emoji all come with it.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button variant="primary" onClick={onPaste}>
            <ClipboardPaste /> Paste from clipboard
          </Button>
          <Button onClick={onOpenFile}>
            <FolderOpen /> Open a file
          </Button>
        </div>
        {showKeyHint && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-subtle-foreground">
            or press <Kbd>{modKey}</Kbd>
            <Kbd>V</Kbd> anywhere, or just start typing
          </p>
        )}
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">Or start from a sample</p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {SAMPLES.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => onSample(sample.id)}
                title={sample.description}
                className="h-8 rounded-full border border-border px-3 text-xs font-medium text-foreground transition-colors hover:border-border-strong hover:bg-surface-hover"
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

export function EditorPane({
  documentId,
  source,
  onChange,
  editorRef,
  transformPaste,
  modKey,
  showKeyHint,
  showToolbar,
  onPasteFromClipboard,
  onOpenFile,
  onSample,
}: {
  documentId: string;
  source: string;
  onChange: (source: string) => void;
  editorRef: RefObject<EditorHandle | null>;
  transformPaste: (payload: ClipboardPayload) => string | null;
  modKey: string;
  showKeyHint: boolean;
  showToolbar: boolean;
  onPasteFromClipboard: () => void;
  onOpenFile: () => void;
  onSample: (id: string) => void;
}) {
  const empty = source.trim() === "";

  return (
    <section aria-label="Editor" className="flex h-full min-h-0 flex-col bg-surface">
      {showToolbar && <FormattingToolbar editor={editorRef} modKey={modKey} />}
      <div className="relative min-h-0 flex-1">
        <MarkdownEditor
          // A new document gets a new editor: one document's undo history must
          // never replay into another.
          key={documentId}
          ref={editorRef}
          value={source}
          onChange={onChange}
          transformPaste={transformPaste}
          placeholder="Start typing Markdown…"
        />
        {empty && (
          <EmptyState
            modKey={modKey}
            showKeyHint={showKeyHint}
            onPaste={onPasteFromClipboard}
            onOpenFile={onOpenFile}
            onSample={onSample}
          />
        )}
      </div>
    </section>
  );
}
