"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, Palette, PanelLeft, PanelLeftClose, RotateCcw, Search } from "lucide-react";

import { CommandPalette } from "@/components/app/command-palette";
import { DocumentsMenu } from "@/components/app/documents-menu";
import { EditorPane } from "@/components/app/editor-pane";
import { ExportButton } from "@/components/app/export-button";
import { Logo } from "@/components/app/logo";
import { MobileTabBar, type MobileView } from "@/components/app/mobile-tab-bar";
import { MoreMenu } from "@/components/app/more-menu";
import { PresetGallery } from "@/components/app/preset-gallery";
import { PreviewPane, type Zoom } from "@/components/app/preview-pane";
import { ShortcutsDialog } from "@/components/app/shortcuts-dialog";
import { Splitter } from "@/components/app/splitter";
import { StartScreen } from "@/components/app/start-screen";
import { StatusBar } from "@/components/app/status-bar";
import type { ClipboardPayload, EditorHandle } from "@/components/markdown-editor";
import type { PreviewStatus } from "@/components/paginated-preview";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { Button } from "@/components/ui/button";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { Tip } from "@/components/ui/tooltip";
import { exportMarkdown, exportPdf, exportStandaloneHtml } from "@/lib/app/export";
import { hasModKey, useLayout, useMediaQuery, useModKey, useWideDesktop } from "@/lib/app/media";
import { setThemePreference } from "@/lib/app/theme";
import { useWorkspace } from "@/lib/app/use-workspace";
import { cn } from "@/lib/cn";
import { PRESETS } from "@/lib/config/presets";
import { useDebouncedValue } from "@/lib/hooks";
import {
  clipboardToMarkdown,
  findClosingOffer,
  hasChatbotArtefacts,
  readClipboard,
} from "@/lib/paste/clipboard";
import { absoluteAssetUrl } from "@/lib/renderer/asset-urls";
import { renderDocument, toSafeFileName } from "@/lib/renderer/document";
import { SAMPLES } from "@/lib/samples";
import { deriveTitle, truncateWords } from "@/lib/text/title";

/** Long enough that typing never triggers a layout; short enough to feel live. */
const SOURCE_DEBOUNCE_MS = 450;
/** Shorter: settings changes are discrete, so the wait is more noticeable. */
const CONFIG_DEBOUNCE_MS = 200;

const EDITOR_WIDTH_KEY = "typeset:editor-width";
const DEFAULT_EDITOR_WIDTH = 460;
const MIN_EDITOR_WIDTH = 300;

function readEditorWidth(): number {
  if (typeof window === "undefined") return DEFAULT_EDITOR_WIDTH;
  try {
    const stored = Number(window.localStorage.getItem(EDITOR_WIDTH_KEY));
    return Number.isFinite(stored) && stored >= MIN_EDITOR_WIDTH ? stored : DEFAULT_EDITOR_WIDTH;
  } catch {
    return DEFAULT_EDITOR_WIDTH;
  }
}

/** True when the event target takes text input of its own. */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

const MARKDOWN_FILE = /\.(?:md|markdown|mdx|txt)$/i;

/** Shown while hydrating, identical on server and client. */
function AppSkeleton() {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center border-b border-border bg-surface px-4">
        <Logo />
      </header>
      <div className="min-h-0 flex-1 bg-background" />
    </div>
  );
}

export default function Home() {
  const workspace = useWorkspace();
  const { hydrated, document: doc } = workspace;

  const layout = useLayout();
  const wide = useWideDesktop();
  const modKey = useModKey();
  // Keyboard hints only for people with a keyboard and a mouse in front of them.
  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)", true);

  const [view, setView] = useState<MobileView>("write");
  const [showEditor, setShowEditor] = useState(true);
  // The Design panel docks beside the pages on wide screens and slides over
  // them as a sheet elsewhere. Separate states, so resizing a window with the
  // docked panel open never pops a modal sheet up out of nowhere.
  const [panelOpen, setPanelOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [paginate, setPaginate] = useState(true);
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [effectiveZoom, setEffectiveZoom] = useState(1);
  const [preview, setPreview] = useState<PreviewStatus>({ state: "idle" });
  // The document whose pages have been on screen at least once - until then,
  // the preview shows a skeleton rather than the previous document's pages.
  const [readyDocId, setReadyDocId] = useState<string | null>(null);
  // The empty document the user chose to write in; any other empty document
  // shows the start screen.
  const [writingId, setWritingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [justDownloaded, setJustDownloaded] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [editorWidth, setEditorWidth] = useState(readEditorWidth);

  const editorRef = useRef<EditorHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportingRef = useRef(false);
  // For the "Try again" button on a failed download, which outlives the
  // render that created it and must retry with the document as it is now.
  const retryDownloadRef = useRef<() => void>(() => {});
  const docIdRef = useRef(doc.id);
  useEffect(() => {
    docIdRef.current = doc.id;
  }, [doc.id]);

  const isDesktop = layout === "desktop";
  const isPhone = layout === "phone";
  const settingsDocked = isDesktop && wide;
  const empty = doc.source.trim() === "";
  const startScreen = empty && writingId !== doc.id;

  // --- rendering ------------------------------------------------------------

  // Rendering Markdown is fast; laying it out into pages is not. Debouncing
  // both inputs means the preview is rebuilt only once the user pauses. The
  // text is debounced together with its document's id: switching document
  // must show the new one at once, not the old one for another half-second.
  const pending = useMemo(() => ({ id: doc.id, source: doc.source }), [doc.id, doc.source]);
  const settled = useDebouncedValue(pending, SOURCE_DEBOUNCE_MS);
  const settledSource = settled.id === doc.id ? settled.source : doc.source;
  const settledConfig = useDebouncedValue(doc.config, CONFIG_DEBOUNCE_MS);

  // The pages appear once there is something on them - and only after a
  // pause, so the first keystroke of a new document doesn't shove the editor
  // aside mid-word.
  const hasContent = settledSource.trim() !== "";

  const rendered = useMemo(() => {
    if (!hydrated || !hasContent) return null;
    try {
      return {
        ok: true as const,
        value: renderDocument(settledSource, settledConfig, {
          sourceName: doc.sourceName,
          // Absolute asset URLs: Paged.js resolves them against the srcdoc
          // frame's "about:srcdoc" location, where a same-origin path throws.
          resolveUrl: absoluteAssetUrl,
        }),
      };
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }, [hydrated, hasContent, settledSource, settledConfig, doc.sourceName]);

  const title = useMemo(() => (empty ? "Untitled" : deriveTitle(doc.source)), [doc.source, empty]);

  // What the PDF will be called - the same rule the server applies, so the
  // name shown is the name downloaded.
  const fileName =
    doc.config.output.fileName ??
    (rendered?.ok ? rendered.value.fileName : toSafeFileName(title));

  useEffect(() => {
    window.document.title = empty ? "Typeset" : `${title} · Typeset`;
  }, [title, empty]);

  // --- small things that happen after a paste ----------------------------------

  /** Offers to drop a chatbot's closing "Want me to…?" from the document. */
  const offerClosingRemoval = useCallback(
    (markdown: string, converted: boolean) => {
      const offer = findClosingOffer(markdown);
      const remove = {
        label: "Remove it",
        onClick: () =>
          workspace.editSource((source) => {
            const found = findClosingOffer(source);
            return found && found.text === offer?.text ? found.without : source;
          }),
      };

      if (offer) {
        const quote = truncateWords(offer.text.replace(/[*_]/g, ""), 60, true);
        toast(converted ? "Pasted as Markdown" : "Remove the closing question?", {
          description: converted
            ? `It ends with “${quote}”. Remove that from the PDF?`
            : `“${quote}” - a chat follow-up reads oddly in a saved document.`,
          action: { ...remove, label: "Remove" },
          duration: 9000,
        });
      } else if (converted) {
        toast.success("Pasted as Markdown", {
          description: "Headings, lists, tables, code and maths were kept.",
          duration: 3000,
        });
      }
    },
    [workspace],
  );

  // --- getting text in ---------------------------------------------------------

  /** New text from outside the editor: fills an empty document, else a new one. */
  const importText = useCallback(
    (markdown: string, options: { sourceName?: string; converted?: boolean } = {}) => {
      if (empty && !options.sourceName) {
        workspace.setSource(markdown);
      } else {
        const id = workspace.createDocument({ source: markdown, sourceName: options.sourceName });
        toast.success("Pasted into a new document", {
          description: "Your previous document is saved in Documents.",
          action: { label: "Undo", onClick: () => workspace.removeDocument(id) },
        });
      }
      offerClosingRemoval(markdown, options.converted ?? false);
      if (isPhone) setView("preview");
    },
    [empty, isPhone, offerClosingRemoval, workspace],
  );

  const openFile = useCallback(
    async (file: File) => {
      if (!MARKDOWN_FILE.test(file.name) && !file.type.startsWith("text/")) {
        toast.error(`${file.name} isn't a text file`, {
          description: "Open a Markdown (.md) or plain text (.txt) file.",
        });
        return;
      }
      const text = await file.text();
      workspace.createDocument({ source: text, sourceName: file.name });
      toast.success(`Opened ${file.name}`);
    },
    [workspace],
  );

  const pasteFromClipboard = useCallback(async () => {
    try {
      const { markdown, converted } = await readClipboard();
      if (markdown.trim() === "") {
        toast("The clipboard is empty", { description: "Copy an answer first, then try again." });
        return;
      }
      importText(markdown, { converted });
    } catch {
      toast.error("Couldn't read the clipboard", {
        description: finePointer
          ? `Your browser blocked it. Press ${modKey}+V instead.`
          : "Your browser blocked it. Choose Write, then long-press and Paste.",
      });
    }
  }, [finePointer, importText, modKey]);

  const loadSample = useCallback(
    (id: string) => {
      const sample = SAMPLES.find((candidate) => candidate.id === id);
      if (!sample) return;
      if (empty) workspace.setSource(sample.source);
      else workspace.createDocument({ source: sample.source });
    },
    [empty, workspace],
  );

  /** "Write" on the start screen, or a key typed straight onto it. */
  const startWriting = useCallback(
    (firstKey?: string) => {
      setWritingId(docIdRef.current);
      setView("write");
      if (firstKey) workspace.setSource(firstKey);
      // After React has mounted the editor in place of the start screen.
      requestAnimationFrame(() => requestAnimationFrame(() => editorRef.current?.focusEnd()));
    },
    [workspace],
  );

  const onEditorChange = useCallback(
    (source: string) => {
      // Typing in this document's editor keeps it in the editor even if it is
      // emptied again - never yank someone back to the start screen mid-edit.
      setWritingId(docIdRef.current);
      workspace.setSource(source);
    },
    [workspace],
  );

  /** Paste inside the editor: rich chatbot HTML becomes Markdown. */
  const transformPaste = useCallback(
    ({ html, text }: ClipboardPayload): string | null => {
      const result = clipboardToMarkdown({ html, text });
      offerClosingRemoval(result.markdown, result.converted);
      if (result.converted) return result.markdown;
      return text !== null && hasChatbotArtefacts(text) ? result.markdown : null;
    },
    [offerClosingRemoval],
  );

  // Paste anywhere outside a text field: the fastest path from a chat window
  // to a PDF is Ctrl+V the moment the app opens.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (isEditable(event.target)) return;
      const data = event.clipboardData;
      if (!data) return;

      const file = data.files?.[0];
      if (file) {
        event.preventDefault();
        void openFile(file);
        return;
      }

      const { markdown, converted } = clipboardToMarkdown({
        html: data.getData("text/html") || null,
        text: data.getData("text/plain") || null,
      });
      if (markdown.trim() === "") return;
      event.preventDefault();
      importText(markdown, { converted });
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [importText, openFile]);

  // --- getting a document out --------------------------------------------------

  const downloadPdf = useCallback(async () => {
    if (exportingRef.current) return;
    if (doc.source.trim() === "") {
      toast("Nothing to download yet", { description: "Paste or write something first." });
      return;
    }

    exportingRef.current = true;
    setExporting(true);
    const toastId = toast.loading("Creating your PDF…");

    try {
      const result = await exportPdf({
        source: doc.source,
        // The name on screen goes with the request, so it is the name that
        // comes back - whatever the server would have derived on its own.
        config: {
          ...doc.config,
          output: { ...doc.config.output, fileName: doc.config.output.fileName ?? fileName },
        },
        sourceName: doc.sourceName,
        fallbackName: fileName,
      });
      toast.success(`Downloaded ${result.fileName}`, {
        id: toastId,
        description: `${result.pages} ${result.pages === 1 ? "page" : "pages"} · ${(result.ms / 1000).toFixed(1)}s${
          result.degraded ? " · without running heads" : ""
        }`,
      });
      setJustDownloaded(true);
      window.setTimeout(() => setJustDownloaded(false), 2400);
      if (result.missing.length > 0) {
        toast.warning(
          result.missing.length === 1
            ? "1 character couldn't be printed"
            : `${result.missing.length} characters couldn't be printed`,
          { description: result.missing.slice(0, 24).join(" ") },
        );
      }
    } catch (error) {
      toast.error("Couldn't create the PDF", {
        id: toastId,
        description: error instanceof Error ? error.message : String(error),
        action: { label: "Try again", onClick: () => retryDownloadRef.current() },
      });
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }, [doc.config, doc.source, doc.sourceName, fileName]);

  useEffect(() => {
    retryDownloadRef.current = () => void downloadPdf();
  }, [downloadPdf]);

  const downloadHtml = useCallback(async () => {
    if (empty) return;
    const name = toSafeFileName(fileName);
    try {
      const { html } = renderDocument(doc.source, doc.config, {
        sourceName: doc.sourceName,
        resolveUrl: absoluteAssetUrl,
      });
      await exportStandaloneHtml(html, name);
      toast.success(`Downloaded ${name}.html`, {
        description: "Opens in any browser, even offline.",
      });
    } catch (error) {
      toast.error("Couldn't create the web page", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }, [doc.config, doc.source, doc.sourceName, empty, fileName]);

  const downloadMarkdown = useCallback(() => {
    if (empty) return;
    const name = toSafeFileName(fileName);
    exportMarkdown(doc.source, name);
    toast.success(`Downloaded ${name}.md`);
  }, [doc.source, empty, fileName]);

  // --- documents -----------------------------------------------------------------

  const deleteDocument = useCallback(
    (id: string) => {
      const removed = workspace.removeDocument(id);
      if (!removed) return;
      toast(`Deleted “${deriveTitle(removed.source)}”`, {
        action: { label: "Undo", onClick: () => workspace.restoreDocument(removed) },
      });
    },
    [workspace],
  );

  const toggleDesign = useCallback(() => {
    if (settingsDocked) setPanelOpen((open) => !open);
    else setSheetOpen((open) => !open);
  }, [settingsDocked]);

  // --- keyboard -------------------------------------------------------------------

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = hasModKey(event);
      const key = event.key.toLowerCase();

      if (mod && !event.shiftKey && key === "s") {
        event.preventDefault();
        void downloadPdf();
      } else if (mod && !event.shiftKey && key === "o") {
        event.preventDefault();
        fileInputRef.current?.click();
      } else if (mod && key === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      } else if (mod && event.key === "\\") {
        event.preventDefault();
        setShowEditor((visible) => !visible);
      } else if (event.key === "?" && !mod && !isEditable(event.target)) {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [downloadPdf]);

  // --- preview ---------------------------------------------------------------------

  const onPreviewStatus = useCallback((status: PreviewStatus) => {
    setPreview(status);
    if (status.state === "ready") setReadyDocId(docIdRef.current);
    // A failed layout would leave the previous pages on screen, silently
    // misrepresenting the document. Continuous is always correct, only
    // unpaginated - the right content in the wrong shape beats the reverse.
    if (status.state === "error") {
      setPaginate(false);
      toast.warning("Showing one continuous column", {
        description: `The preview couldn't lay out pages: ${status.message}`,
      });
    }
  }, []);

  const resizeEditor = useCallback((width: number) => {
    setEditorWidth(width);
    try {
      window.localStorage.setItem(EDITOR_WIDTH_KEY, String(width));
    } catch {
      // Not remembered; still resized.
    }
  }, []);

  if (!hydrated) return <AppSkeleton />;

  const words = rendered?.ok ? rendered.value.wordCount : 0;
  const headings = rendered?.ok ? rendered.value.headings.length : 0;
  const missing = rendered?.ok && !empty ? rendered.value.missingCharacters : [];
  const pages = preview.state === "ready" && paginate && hasContent ? preview.pages : 0;
  const firstLayout = hasContent && readyDocId !== doc.id && preview.state !== "error";
  const designOpen = settingsDocked ? panelOpen : sheetOpen;
  // Phones and tablets show one pane; with nothing to preview, it is the editor.
  const paneView: MobileView = hasContent ? view : "write";

  // --- pieces ------------------------------------------------------------------------

  const settingsPanel = (inSheet: boolean) => (
    <SettingsPanel
      config={doc.config}
      onChange={workspace.updateConfig}
      presetId={doc.presetId}
      modified={workspace.modified}
      onResetPreset={workspace.resetPreset}
      showHeader={!inSheet}
      styleTab={
        <div>
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            Start from a style, then fine-tune anything in the other tabs. Switching style
            replaces your changes.
          </p>
          <PresetGallery
            value={doc.presetId}
            modified={workspace.modified}
            onSelect={workspace.applyPreset}
            columns={2}
          />
        </div>
      }
    />
  );

  const editorPane = (centered: boolean) => (
    <EditorPane
      documentId={doc.id}
      source={doc.source}
      onChange={onEditorChange}
      editorRef={editorRef}
      transformPaste={transformPaste}
      modKey={modKey}
      centered={centered}
    />
  );

  const previewPane = (
    <PreviewPane
      html={rendered?.ok ? rendered.value.html : null}
      error={rendered && !rendered.ok ? rendered.message : null}
      empty={!hasContent}
      paginate={paginate}
      onPaginateChange={setPaginate}
      zoom={zoom}
      effectiveZoom={effectiveZoom}
      onZoomChange={setZoom}
      onEffectiveZoom={setEffectiveZoom}
      pageOffset={settledConfig.structure.startPageNumber - 1}
      status={preview}
      onStatus={onPreviewStatus}
      compact={isPhone}
      firstLayout={firstLayout}
    />
  );

  const exportProps = {
    busy: exporting,
    done: justDownloaded,
    disabled: empty,
    modKey,
    fileName,
    fileNameOverridden: doc.config.output.fileName !== null,
    onRename: (name: string | null) => workspace.updateConfig({ output: { fileName: name } }),
    onPdf: () => void downloadPdf(),
    onHtml: () => void downloadHtml(),
    onMarkdown: downloadMarkdown,
  };

  return (
    <div
      className="flex h-dvh flex-col bg-background"
      onDragEnter={(event) => {
        if (event.dataTransfer.types.includes("Files")) setDragging(true);
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDragLeave={(event) => {
        if (event.relatedTarget === null) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) void openFile(file);
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.mdx,.txt,text/markdown,text/plain"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void openFile(file);
          event.target.value = "";
        }}
      />

      {/* ------------------------------------------------------------ header */}
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-1.5 border-b border-border bg-surface px-2.5 sm:gap-2 sm:px-3 lg:px-4">
        <Logo compact={!isDesktop} />
        {isDesktop && <span aria-hidden className="mx-1.5 h-5 w-px bg-border" />}

        <DocumentsMenu
          title={startScreen ? "New document" : title}
          currentId={doc.id}
          documents={workspace.documents}
          saveState={workspace.saveState}
          showSaveState={isDesktop && !empty}
          onOpen={workspace.openDocument}
          onCreate={() => workspace.createDocument()}
          onOpenFile={() => fileInputRef.current?.click()}
          onDelete={deleteDocument}
          className="min-w-0 flex-1"
        />

        {layout === "tablet" && hasContent && !startScreen && (
          <Segmented
            label="View"
            size="md"
            value={view}
            onChange={setView}
            options={[
              { value: "write", label: "Write" },
              { value: "preview", label: "Preview" },
            ]}
          />
        )}

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          {isDesktop && finePointer && (
            <Tip label="Command menu" shortcut={`${modKey} K`}>
              <Button variant="ghost" size="icon" aria-label="Command menu" onClick={() => setCommandOpen(true)}>
                <Search />
              </Button>
            </Tip>
          )}
          {isDesktop && hasContent && !startScreen && (
            <Tip label={showEditor ? "Hide editor" : "Show editor"} shortcut={`${modKey} \\`}>
              <Button
                variant="ghost"
                size="icon"
                aria-label={showEditor ? "Hide editor" : "Show editor"}
                aria-pressed={showEditor}
                onClick={() => setShowEditor((visible) => !visible)}
              >
                {showEditor ? <PanelLeftClose /> : <PanelLeft />}
              </Button>
            </Tip>
          )}
          {hasContent && !startScreen && !isPhone && (
            <Tip label="Style and layout">
              <Button
                variant={designOpen ? "secondary" : "ghost"}
                size={isDesktop ? "md" : "icon"}
                aria-label={`Style: ${PRESETS[doc.presetId].name}. Open the Design panel`}
                aria-pressed={designOpen}
                onClick={toggleDesign}
              >
                <Palette />
                {isDesktop && (
                  <>
                    <span className="max-w-[9rem] truncate">{PRESETS[doc.presetId].name}</span>
                    {workspace.modified && (
                      <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                    )}
                  </>
                )}
              </Button>
            </Tip>
          )}
          {/* Style and Download arrive with the pages: there is nothing to
              style or save in an empty document. */}
          {hasContent && !startScreen && (
            <div className="animate-fade-in">
              <ExportButton {...exportProps} compact={isPhone} />
            </div>
          )}
          <MoreMenu
            modKey={modKey}
            showKeyboardHelp={finePointer}
            onShortcuts={() => setShortcutsOpen(true)}
            onCommandMenu={() => setCommandOpen(true)}
          />
        </div>
      </header>

      {/* -------------------------------------------------------------- body */}
      {startScreen ? (
        <main className="min-h-0 flex-1">
          <StartScreen
            modKey={modKey}
            showKeys={finePointer}
            documents={workspace.documents}
            onPaste={() => void pasteFromClipboard()}
            onOpenFile={() => fileInputRef.current?.click()}
            onWrite={startWriting}
            onSample={loadSample}
            onOpenDocument={workspace.openDocument}
          />
        </main>
      ) : isDesktop ? (
        <main className="flex min-h-0 flex-1">
          {(showEditor || !hasContent) && (
            <>
              <div
                className="flex min-w-0 shrink-0 flex-col transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ width: hasContent ? `min(${editorWidth}px, 58vw)` : "100%" }}
              >
                {editorPane(!hasContent)}
              </div>
              {hasContent && (
                <Splitter
                  value={editorWidth}
                  min={MIN_EDITOR_WIDTH}
                  max={Math.round(window.innerWidth * 0.58)}
                  onChange={resizeEditor}
                  onReset={() => resizeEditor(DEFAULT_EDITOR_WIDTH)}
                />
              )}
            </>
          )}
          {hasContent && <div className="min-w-0 flex-1 animate-reveal">{previewPane}</div>}
          {settingsDocked && panelOpen && (
            <div className="w-[384px] shrink-0 border-l border-border animate-panel-in">
              {settingsPanel(false)}
            </div>
          )}
        </main>
      ) : (
        // Both panes stay mounted, so switching is instant: the editor keeps its
        // cursor and undo history, the preview its laid-out pages. The hidden
        // one is transparent rather than `visibility: hidden`, which the
        // preview's iframe overrides on itself once it has laid out.
        <main className="relative min-h-0 flex-1">
          <div
            className={cn(
              "absolute inset-0 transition-opacity duration-200",
              paneView === "write" ? "z-10" : "pointer-events-none opacity-0",
            )}
            inert={paneView !== "write"}
          >
            {editorPane(false)}
          </div>
          {hasContent && (
            <div
              className={cn(
                "absolute inset-0 transition-opacity duration-200",
                paneView === "preview" ? "z-10" : "pointer-events-none opacity-0",
              )}
              inert={paneView !== "preview"}
            >
              {previewPane}
            </div>
          )}
        </main>
      )}

      {!isPhone && hasContent && !startScreen && (
        <StatusBar
          words={hasContent ? words : 0}
          headings={hasContent ? headings : 0}
          missing={missing}
          status={preview}
          paginate={paginate && hasContent}
        />
      )}

      {isPhone && !startScreen && (
        <MobileTabBar
          view={paneView}
          onViewChange={setView}
          onStyle={() => setSheetOpen(true)}
          styleOpen={sheetOpen}
          pages={pages}
          previewEnabled={hasContent}
        />
      )}

      {/* -------------------------------------------------- overlays */}
      <Dialog open={sheetOpen && !settingsDocked} onOpenChange={setSheetOpen}>
        <SheetContent
          side={isPhone ? "bottom" : "right"}
          title="Design"
          description="Choose a style and adjust the page, type, colours and structure."
          className={isPhone ? "h-[88dvh]" : undefined}
          actions={
            workspace.modified ? (
              <Button variant="ghost" size="sm" onClick={workspace.resetPreset}>
                <RotateCcw /> Reset
              </Button>
            ) : null
          }
        >
          {settingsPanel(true)}
        </SheetContent>
      </Dialog>

      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        modKey={modKey}
        documents={workspace.documents}
        currentId={doc.id}
        presetId={doc.presetId}
        paginate={paginate}
        editorVisible={showEditor}
        settingsVisible={designOpen}
        onNew={() => workspace.createDocument()}
        onOpenFile={() => fileInputRef.current?.click()}
        onPaste={() => void pasteFromClipboard()}
        onOpenDocument={workspace.openDocument}
        onPdf={() => void downloadPdf()}
        onHtml={() => void downloadHtml()}
        onMarkdown={downloadMarkdown}
        onPreset={workspace.applyPreset}
        onToggleEditor={isDesktop && hasContent ? () => setShowEditor((visible) => !visible) : undefined}
        onToggleSettings={toggleDesign}
        onPaginate={setPaginate}
        onFit={() => setZoom("fit")}
        onTheme={setThemePreference}
        onSample={loadSample}
        onShortcuts={() => setShortcutsOpen(true)}
      />

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} modKey={modKey} />

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-[80] grid place-items-center bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-primary bg-surface px-12 py-9 text-center shadow-lg animate-pop-in">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
              <FileUp className="size-6 animate-bob" />
            </span>
            <p className="mt-3 text-[15px] font-semibold">Drop to open</p>
            <p className="mt-1 text-xs text-muted-foreground">Markdown or plain text files</p>
          </div>
        </div>
      )}
    </div>
  );
}
