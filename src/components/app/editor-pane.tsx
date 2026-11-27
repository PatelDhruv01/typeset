"use client";

import type { ReactNode, RefObject } from "react";
import {
  Bold,
  Code,
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
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

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
  centered = false,
}: {
  editor: RefObject<EditorHandle | null>;
  modKey: string;
  centered?: boolean;
}) {
  const run = (action: (handle: EditorHandle) => void) => () => {
    if (editor.current) action(editor.current);
  };

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className={cn(
        "flex h-11 shrink-0 items-center overflow-x-auto border-b border-border px-2 [scrollbar-width:none]",
        centered && "justify-center",
      )}
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
 * The editor and its toolbar. An empty document never shows here with
 * nothing in it: the start screen (start-screen.tsx) stands in until the user
 * pastes, opens, picks a sample or chooses to write.
 */
export function EditorPane({
  documentId,
  source,
  onChange,
  editorRef,
  transformPaste,
  modKey,
  centered,
}: {
  documentId: string;
  source: string;
  onChange: (source: string) => void;
  editorRef: RefObject<EditorHandle | null>;
  transformPaste: (payload: ClipboardPayload) => string | null;
  modKey: string;
  /** Alone on the screen: write in a centred column. */
  centered: boolean;
}) {
  return (
    <section aria-label="Editor" className="flex h-full min-h-0 flex-col bg-surface">
      <FormattingToolbar editor={editorRef} modKey={modKey} centered={centered} />
      <div className={cn("relative min-h-0 flex-1", centered && "editor-centered")}>
        <MarkdownEditor
          // A new document gets a new editor: one document's undo history must
          // never replay into another.
          key={documentId}
          ref={editorRef}
          value={source}
          onChange={onChange}
          transformPaste={transformPaste}
          placeholder="Start typing Markdown - or paste an answer…"
        />
      </div>
    </section>
  );
}
