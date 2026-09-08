"use client";

import { useEffect, useRef } from "react";

import { useLatestRef } from "@/lib/hooks";

import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import {
  HighlightStyle,
  syntaxHighlighting,
  indentUnit,
} from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as placeholderExt,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";

/**
 * The Markdown editor.
 *
 * A thin binding over CodeMirror 6 rather than a wrapper library: the whole
 * integration is the effect below, and owning it means the theme can be driven
 * from the app's own design tokens instead of fighting someone else's.
 *
 * CodeMirror keeps the authoritative document. React re-renders must therefore
 * never reset it from props on every keystroke - see the second effect, which
 * only writes back when the two have genuinely diverged.
 */

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showLineNumbers?: boolean;
};

/**
 * Colours come from the same CSS custom properties as the rest of the app, so
 * the editor follows the light/dark toggle without a second palette to keep in
 * sync.
 */
const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    backgroundColor: "var(--card)",
    color: "var(--foreground)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    lineHeight: "1.7",
    padding: "0.75rem 0",
  },
  ".cm-content": { padding: "0 1rem", caretColor: "var(--foreground)" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--muted-foreground)",
    paddingRight: "0.5rem",
  },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--muted) 55%, transparent)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--foreground)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in srgb, var(--primary) 25%, transparent)",
  },
  ".cm-cursor": { borderLeftColor: "var(--foreground)" },
  ".cm-placeholder": { color: "var(--muted-foreground)" },
});

const highlightStyle = HighlightStyle.define([
  { tag: tags.heading1, color: "var(--foreground)", fontWeight: "700", fontSize: "1.15em" },
  { tag: tags.heading2, color: "var(--foreground)", fontWeight: "700", fontSize: "1.08em" },
  { tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], color: "var(--foreground)", fontWeight: "600" },
  { tag: tags.strong, fontWeight: "700", color: "var(--foreground)" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "var(--primary)" },
  { tag: tags.url, color: "var(--muted-foreground)" },
  { tag: tags.quote, color: "var(--muted-foreground)", fontStyle: "italic" },
  { tag: [tags.monospace, tags.content], color: "var(--foreground)" },
  { tag: tags.keyword, color: "var(--primary)" },
  // Modernist is a mono-accent system - no second or third hue to spend on
  // syntax highlighting. Strings get a subtle warm tint mixed from the one
  // accent rather than a separate invented colour; numbers are plain ink.
  { tag: tags.string, color: "color-mix(in srgb, var(--foreground) 75%, var(--primary) 25%)" },
  { tag: tags.comment, color: "var(--muted-foreground)", fontStyle: "italic" },
  { tag: tags.number, color: "var(--foreground)" },
  { tag: [tags.processingInstruction, tags.meta], color: "var(--muted-foreground)" },
  { tag: tags.list, color: "var(--primary)" },
]);

function baseExtensions(showLineNumbers: boolean): Extension[] {
  return [
    history(),
    drawSelection(),
    highlightActiveLine(),
    ...(showLineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []),
    EditorView.lineWrapping,
    indentUnit.of("  "),
    // `codeLanguages` is what highlights the inside of fenced code blocks, so a
    // ```ts block in the editor looks like the one in the PDF.
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    syntaxHighlighting(highlightStyle),
    editorTheme,
    keymap.of([...defaultKeymap, ...historyKeymap]),
  ];
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  showLineNumbers = false,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Held in a ref so changing the handler does not tear down the editor and
  // lose the cursor, selection and undo history with it.
  const onChangeRef = useLatestRef(onChange);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          ...baseExtensions(showLineNumbers),
          ...(placeholder ? [placeholderExt(placeholder)] : []),
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
  }, [showLineNumbers, placeholder]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const current = view.state.doc.toString();
    // Only write back when the document genuinely differs - loading a file, or
    // switching sample. Dispatching on every keystroke would fight the editor
    // for ownership and collapse the selection.
    if (current === value) return;

    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value]);

  return <div ref={hostRef} className="h-full min-h-0 overflow-hidden" />;
}
