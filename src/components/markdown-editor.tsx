"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

import { useLatestRef } from "@/lib/hooks";

import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { HighlightStyle, syntaxHighlighting, indentUnit } from "@codemirror/language";
import { EditorSelection, EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  keymap,
  placeholder as placeholderExt,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";

/**
 * The Markdown editor.
 *
 * A thin binding over CodeMirror 6 rather than a wrapper library: the whole
 * integration is the effects below, and owning it means the theme can be
 * driven from the app's own design tokens instead of fighting someone else's.
 *
 * CodeMirror keeps the authoritative document. React re-renders must therefore
 * never reset it from props on every keystroke - see the second effect, which
 * only writes back when the two have genuinely diverged.
 */

/** What the toolbar, and anything else outside the editor, can ask of it. */
export type EditorHandle = {
  focus: () => void;
  /** Replaces the selection (or inserts at the cursor). */
  insert: (text: string) => void;
  /** Wraps each selection in `before`/`after`, or `placeholder` when empty. */
  wrap: (before: string, after: string, placeholder: string) => void;
  /** Toggles a line prefix (heading, list, quote) on every selected line. */
  toggleLinePrefix: (prefix: (index: number) => string, pattern: RegExp) => void;
  /** Inserts a link around the selection, leaving the URL selected to type over. */
  link: () => void;
};

export type ClipboardPayload = { html: string | null; text: string | null };

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /**
   * Turns clipboard contents into the text to insert. Return null to let
   * CodeMirror paste the plain text as it normally would.
   */
  transformPaste?: (payload: ClipboardPayload) => string | null;
  ref?: Ref<EditorHandle>;
  /** Accessible name for the editing surface. */
  label?: string;
};

/**
 * Colours come from the same CSS custom properties as the rest of the app, so
 * the editor follows the light/dark switch without a second palette to keep in
 * sync. The font size is 16px on small screens: iOS zooms the whole page into
 * any focused text smaller than that.
 */
const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "var(--editor-font-size, 14px)",
    backgroundColor: "var(--surface)",
    color: "var(--foreground)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    lineHeight: "1.7",
    padding: "1.25rem 0 6rem",
  },
  ".cm-content": {
    padding: "0 clamp(1rem, 4%, 2rem)",
    caretColor: "var(--primary)",
    maxWidth: "52rem",
  },
  ".cm-line": { padding: "0" },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--surface-2) 70%, transparent)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in srgb, var(--primary) 22%, transparent) !important",
  },
  ".cm-cursor": { borderLeftColor: "var(--primary)", borderLeftWidth: "2px" },
  ".cm-placeholder": { color: "var(--subtle-foreground)" },
});

const highlightStyle = HighlightStyle.define([
  { tag: tags.heading1, color: "var(--foreground)", fontWeight: "700", fontSize: "1.12em" },
  { tag: tags.heading2, color: "var(--foreground)", fontWeight: "700", fontSize: "1.06em" },
  { tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], color: "var(--foreground)", fontWeight: "600" },
  { tag: tags.strong, fontWeight: "700", color: "var(--foreground)" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "var(--primary)" },
  { tag: tags.url, color: "var(--muted-foreground)" },
  { tag: tags.quote, color: "var(--muted-foreground)", fontStyle: "italic" },
  { tag: [tags.monospace, tags.content], color: "var(--foreground)" },
  { tag: tags.keyword, color: "var(--primary)" },
  { tag: tags.string, color: "color-mix(in srgb, var(--foreground) 72%, var(--primary) 28%)" },
  { tag: tags.comment, color: "var(--subtle-foreground)", fontStyle: "italic" },
  { tag: tags.number, color: "var(--foreground)" },
  { tag: [tags.processingInstruction, tags.meta], color: "var(--subtle-foreground)" },
  { tag: tags.list, color: "var(--primary)" },
]);

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function wrapSelection(view: EditorView, before: string, after: string, placeholder: string) {
  const transaction = view.state.changeByRange((range) => {
    const selected = view.state.sliceDoc(range.from, range.to);
    const inner = selected || placeholder;
    const outerBefore = view.state.sliceDoc(range.from - before.length, range.from);
    const outerAfter = view.state.sliceDoc(range.to, range.to + after.length);

    // Already wrapped: unwrap instead, so the button toggles.
    if (selected && outerBefore === before && outerAfter === after) {
      return {
        changes: [
          { from: range.from - before.length, to: range.from, insert: "" },
          { from: range.to, to: range.to + after.length, insert: "" },
        ],
        range: EditorSelection.range(range.from - before.length, range.to - before.length),
      };
    }

    return {
      changes: { from: range.from, to: range.to, insert: `${before}${inner}${after}` },
      range: EditorSelection.range(
        range.from + before.length,
        range.from + before.length + inner.length,
      ),
    };
  });

  view.dispatch(transaction, { scrollIntoView: true, userEvent: "input" });
  view.focus();
}

function toggleLinePrefix(
  view: EditorView,
  prefix: (index: number) => string,
  pattern: RegExp,
) {
  const { state } = view;
  const lineNumbers: number[] = [];
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;
    for (let n = first; n <= last; n += 1) {
      if (!lineNumbers.includes(n)) lineNumbers.push(n);
    }
  }

  const lines = lineNumbers.map((n) => state.doc.line(n));
  const allHavePrefix = lines.every((line) => pattern.test(line.text));
  // Any other line marker (a heading's #, a list's -, a quote's >) is replaced,
  // so switching a bullet list to a numbered one does not stack markers.
  const anyMarker = /^(?:#{1,6}\s+|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+|>\s?)/;

  const changes = lines.map((line, index) => {
    const existing = (allHavePrefix ? pattern : anyMarker).exec(line.text)?.[0] ?? "";
    return {
      from: line.from,
      to: line.from + existing.length,
      insert: allHavePrefix ? "" : prefix(index),
    };
  });

  view.dispatch({ changes, scrollIntoView: true, userEvent: "input" });
  view.focus();
}

function insertLink(view: EditorView) {
  const transaction = view.state.changeByRange((range) => {
    const text = view.state.sliceDoc(range.from, range.to) || "link text";
    const insert = `[${text}](https://)`;
    const urlStart = range.from + text.length + 3;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.range(urlStart, urlStart + "https://".length),
    };
  });
  view.dispatch(transaction, { scrollIntoView: true, userEvent: "input" });
  view.focus();
}

const formattingKeymap = keymap.of([
  { key: "Mod-b", run: (view) => (wrapSelection(view, "**", "**", "bold text"), true) },
  { key: "Mod-i", run: (view) => (wrapSelection(view, "*", "*", "italic text"), true) },
  { key: "Mod-e", run: (view) => (wrapSelection(view, "`", "`", "code"), true) },
]);

function baseExtensions(label: string): Extension[] {
  return [
    history(),
    drawSelection(),
    highlightActiveLine(),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({
      "aria-label": label,
      spellcheck: "true",
      autocapitalize: "sentences",
    }),
    indentUnit.of("  "),
    // `codeLanguages` is what highlights the inside of fenced code blocks, so a
    // ```ts block in the editor looks like the one in the PDF.
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    syntaxHighlighting(highlightStyle),
    editorTheme,
    formattingKeymap,
    keymap.of([...defaultKeymap, ...historyKeymap]),
  ];
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  transformPaste,
  ref,
  label = "Markdown source",
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Held in refs so changing a handler does not tear down the editor and lose
  // the cursor, selection and undo history with it.
  const onChangeRef = useLatestRef(onChange);
  const transformPasteRef = useLatestRef(transformPaste);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => viewRef.current?.focus(),
      insert: (text) => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch(view.state.replaceSelection(text), {
          scrollIntoView: true,
          userEvent: "input.paste",
        });
        view.focus();
      },
      wrap: (before, after, fallback) => {
        if (viewRef.current) wrapSelection(viewRef.current, before, after, fallback);
      },
      toggleLinePrefix: (prefix, pattern) => {
        if (viewRef.current) toggleLinePrefix(viewRef.current, prefix, pattern);
      },
      link: () => {
        if (viewRef.current) insertLink(viewRef.current);
      },
    }),
    [],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          ...baseExtensions(label),
          ...(placeholder ? [placeholderExt(placeholder)] : []),
          EditorView.domEventHandlers({
            paste: (event, editor) => {
              const transform = transformPasteRef.current;
              const data = event.clipboardData;
              if (!transform || !data) return false;

              const replacement = transform({
                html: data.getData("text/html") || null,
                text: data.getData("text/plain") || null,
              });
              if (replacement === null) return false;

              event.preventDefault();
              editor.dispatch(editor.state.replaceSelection(replacement), {
                scrollIntoView: true,
                userEvent: "input.paste",
              });
              return true;
            },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      }),
    });

    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // `value` is deliberately not a dependency: it is the initial document only.
    // Later changes are reconciled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeholder, label]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const current = view.state.doc.toString();
    // Only write back when the document genuinely differs - text pasted from
    // outside the editor, a sample loaded in. Dispatching on every keystroke
    // would fight the editor for ownership and collapse the selection.
    // (Switching to another document remounts the editor instead - see its
    // `key` in the page - so one document's undo history never replays into
    // another.)
    if (current === value) return;

    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value]);

  return (
    <div
      ref={hostRef}
      className="h-full min-h-0 overflow-hidden [--editor-font-size:16px] sm:[--editor-font-size:14px]"
    />
  );
}
