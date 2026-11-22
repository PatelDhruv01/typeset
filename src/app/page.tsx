"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  FileUp,
  Palette,
  PanelLeft,
  PanelLeftClose,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";

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
import { StatusBar } from "@/components/app/status-bar";
import type { ClipboardPayload, EditorHandle } from "@/components/markdown-editor";
import type { PreviewStatus } from "@/components/paginated-preview";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { Button } from "@/components/ui/button";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/segmented";
import { Tip } from "@/components/ui/tooltip";
import { deriveTitle } from "@/lib/app/documents";
import { exportMarkdown, exportPdf, exportStandaloneHtml } from "@/lib/app/export";
import { hasModKey, useLayout, useMediaQuery, useModKey, useWideDesktop } from "@/lib/app/media";
import { setThemePreference } from "@/lib/app/theme";
import { useWorkspace } from "@/lib/app/use-workspace";
import { cn } from "@/lib/cn";
import { PRESETS } from "@/lib/config/presets";
import { useDebouncedValue } from "@/lib/hooks";
import { clipboardToMarkdown, hasChatbotArtefacts, readClipboard } from "@/lib/paste/clipboard";
import { absoluteAssetUrl } from "@/lib/renderer/asset-urls";
import { renderDocument, toSafeFileName } from "@/lib/renderer/document";
import { SAMPLES } from "@/lib/samples";

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
      <div className="min-h-0 flex-1 bg-canvas" />
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paginate, setPaginate] = useState(true);
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [effectiveZoom, setEffectiveZoom] = useState(1);
  const [preview, setPreview] = useState<PreviewStatus>({ state: "idle" });
  const [exporting, setExporting] = useState(false);
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

  const isDesktop = layout === "desktop";
  const isPhone = layout === "phone";
  const settingsDocked = isDesktop && wide;
  const empty = doc.source.trim() === "";

  // --- rendering ------------------------------------------------------------

  // Rendering Markdown is fast; laying it out into pages is not. Debouncing
  // both inputs means the preview is rebuilt only once the user pauses.
  const settledSource = useDebouncedValue(doc.source, SOURCE_DEBOUNCE_MS);
  const settledConfig = useDebouncedValue(doc.config, CONFIG_DEBOUNCE_MS);

  const rendered = useMemo(() => {
    if (!hydrated) return null;
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
  }, [hydrated, settledSource, settledConfig, doc.sourceName]);

  const title = useMemo(() => (empty ? "Untitled" : deriveTitle(doc.source)), [doc.source, empty]);

  const fileName =
    doc.config.output.fileName ??
    (rendered?.ok && rendered.value.fileName !== "document"
      ? rendered.value.fileName
      : toSafeFileName(title));

  useEffect(() => {
    window.document.title = empty ? "Typeset" : `${title} · Typeset`;
  }, [title, empty]);

  // --- getting text in ---------------------------------------------------------

  /** New text from outside the editor: fills an empty document, else a new one. */
  const importText = useCallback(
    (markdown: string, options: { sourceName?: string; message?: string } = {}) => {
      if (empty && !options.sourceName) {
        workspace.setSource(markdown);
      } else {
        const id = workspace.createDocument({ source: markdown, sourceName: options.sourceName });
        toast.success(options.message ?? "Pasted into a new document", {
          description: "Your previous document is saved in Documents.",
          action: {
            label: "Undo",
            onClick: () => {
              workspace.removeDocument(id);
            },
          },
        });
      }
      if (isPhone) setView("preview");
    },
    [empty, isPhone, workspace],
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
      const { markdown } = await readClipboard();
      if (markdown.trim() === "") {
        toast("The clipboard is empty", { description: "Copy an answer first, then try again." });
        return;
      }
      importText(markdown);
    } catch {
      toast.error("Couldn't read the clipboard", {
        description: finePointer
          ? `Your browser blocked it. Press ${modKey}+V instead.`
          : "Your browser blocked it. Long-press in the editor and choose Paste.",
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

  /** Paste inside the editor: rich chatbot HTML becomes Markdown. */
  const transformPaste = useCallback(({ html, text }: ClipboardPayload): string | null => {
    const result = clipboardToMarkdown({ html, text });
    if (result.converted) {
      toast.success("Pasted as Markdown", {
        description: "Headings, lists, tables, code and maths were kept.",
        duration: 3000,
      });
      return result.markdown;
    }
    return text !== null && hasChatbotArtefacts(text) ? result.markdown : null;
  }, []);

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

      const { markdown } = clipboardToMarkdown({
        html: data.getData("text/html") || null,
        text: data.getData("text/plain") || null,
      });
      if (markdown.trim() === "") return;
      event.preventDefault();
      importText(markdown);
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
        config: doc.config,
        sourceName: doc.sourceName,
        fallbackName: fileName,
      });
      toast.success(`Downloaded ${result.fileName}`, {
        id: toastId,
        description: `${result.pages} ${result.pages === 1 ? "page" : "pages"} · ${(result.ms / 1000).toFixed(1)}s${
          result.degraded ? " · without running heads" : ""
        }`,
      });
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
    try {
      const { html } = renderDocument(doc.source, doc.config, {
        sourceName: doc.sourceName,
        resolveUrl: absoluteAssetUrl,
      });
      await exportStandaloneHtml(html, fileName);
      toast.success(`Downloaded ${fileName}.html`, {
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
    exportMarkdown(doc.source, fileName);
    toast.success(`Downloaded ${fileName}.md`);
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
  const pages = preview.state === "ready" && paginate ? preview.pages : 0;

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

  const editorPane = (
    <EditorPane
      documentId={doc.id}
      source={doc.source}
      onChange={workspace.setSource}
      editorRef={editorRef}
      transformPaste={transformPaste}
      modKey={modKey}
      showKeyHint={finePointer}
      showToolbar
      onPasteFromClipboard={() => void pasteFromClipboard()}
      onOpenFile={() => fileInputRef.current?.click()}
      onSample={loadSample}
    />
  );

  const previewPane = (
    <PreviewPane
      html={rendered?.ok ? rendered.value.html : null}
      error={rendered && !rendered.ok ? rendered.message : null}
      empty={empty}
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
    />
  );

  const exportProps = {
    busy: exporting,
    disabled: empty,
    modKey,
    fileName,
    fileNameOverridden: doc.config.output.fileName !== null,
    onRename: (name: string | null) => workspace.updateConfig({ output: { fileName: name } }),
    onPdf: () => void downloadPdf(),
    onHtml: () => void downloadHtml(),
    onMarkdown: downloadMarkdown,
  };

  const moreMenu = (
    <MoreMenu
      modKey={modKey}
      showExports={isPhone}
      showKeyboardHelp={finePointer}
      onNew={() => workspace.createDocument()}
      onOpenFile={() => fileInputRef.current?.click()}
      onPaste={() => void pasteFromClipboard()}
      onSample={loadSample}
      onPdf={() => void downloadPdf()}
      onHtml={() => void downloadHtml()}
      onMarkdown={downloadMarkdown}
      onShortcuts={() => setShortcutsOpen(true)}
      onCommandMenu={() => setCommandOpen(true)}
    />
  );

  const stylePicker = (
    <Popover>
      <Tip label="Document style">
        <PopoverTrigger asChild>
          <Button variant="ghost" className="data-[state=open]:bg-surface-hover">
            <Palette />
            <span className="max-w-[9rem] truncate">{PRESETS[doc.presetId].name}</span>
            {workspace.modified && (
              <span aria-label="edited" className="size-1.5 rounded-full bg-primary" />
            )}
            <ChevronDown className="!size-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
      </Tip>
      <PopoverContent align="end" className="w-[min(640px,calc(100vw-24px))] p-3">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-[13px] font-semibold">Document style</p>
            <p className="text-xs text-muted-foreground">
              Typefaces, page and colours in one click. Fine-tune in Customise.
            </p>
          </div>
          {workspace.modified && (
            <Button variant="ghost" size="sm" onClick={workspace.resetPreset}>
              <RotateCcw /> Reset changes
            </Button>
          )}
        </div>
        <PresetGallery
          value={doc.presetId}
          modified={workspace.modified}
          onSelect={workspace.applyPreset}
          columns={4}
          thumbnailHeight={96}
        />
      </PopoverContent>
    </Popover>
  );

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
      <header className="flex h-14 shrink-0 items-center gap-1.5 border-b border-border bg-surface px-2.5 sm:gap-2 sm:px-3 lg:px-4">
        <Logo compact={!isDesktop} />
        {isDesktop && <span aria-hidden className="mx-1.5 h-5 w-px bg-border" />}

        <DocumentsMenu
          title={title}
          currentId={doc.id}
          documents={workspace.documents}
          saveState={workspace.saveState}
          showSaveState={isDesktop && !empty}
          onOpen={workspace.openDocument}
          onCreate={() => workspace.createDocument()}
          onDelete={deleteDocument}
          className="min-w-0 flex-1"
        />

        {layout === "tablet" && (
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
          {isDesktop && stylePicker}
          {isDesktop && (
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
          {!isPhone &&
            (isDesktop ? (
              <Button
                variant={settingsOpen ? "secondary" : "ghost"}
                aria-pressed={settingsOpen}
                onClick={() => setSettingsOpen((open) => !open)}
              >
                <SlidersHorizontal /> Customise
              </Button>
            ) : (
              <Tip label="Customise">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Customise"
                  onClick={() => setSettingsOpen(true)}
                >
                  <SlidersHorizontal />
                </Button>
              </Tip>
            ))}
          <ExportButton {...exportProps} compact={isPhone} />
          {moreMenu}
        </div>
      </header>

      {/* -------------------------------------------------------------- body */}
      {isDesktop ? (
        <main className="flex min-h-0 flex-1">
          {showEditor && (
            <>
              <div
                className="flex min-w-0 shrink-0 flex-col"
                style={{ width: `min(${editorWidth}px, 58vw)` }}
              >
                {editorPane}
              </div>
              <Splitter
                value={editorWidth}
                min={MIN_EDITOR_WIDTH}
                max={Math.round(window.innerWidth * 0.58)}
                onChange={resizeEditor}
                onReset={() => resizeEditor(DEFAULT_EDITOR_WIDTH)}
              />
            </>
          )}
          <div className="min-w-0 flex-1">{previewPane}</div>
          {settingsDocked && settingsOpen && (
            <div className="w-[384px] shrink-0 border-l border-border animate-fade-in">
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
              "absolute inset-0",
              view === "write" ? "z-10" : "pointer-events-none opacity-0",
            )}
            inert={view !== "write"}
          >
            {editorPane}
          </div>
          <div
            className={cn(
              "absolute inset-0",
              view === "preview" ? "z-10" : "pointer-events-none opacity-0",
            )}
            inert={view !== "preview"}
          >
            {previewPane}
          </div>
        </main>
      )}

      {!isPhone && (
        <StatusBar
          words={empty ? 0 : words}
          headings={empty ? 0 : headings}
          missing={missing}
          status={preview}
          paginate={paginate && !empty}
        />
      )}

      {isPhone && (
        <MobileTabBar
          view={view}
          onViewChange={setView}
          onStyle={() => setSettingsOpen(true)}
          styleOpen={settingsOpen}
          pages={empty ? 0 : pages}
        />
      )}

      {/* -------------------------------------------------- overlays */}
      <Dialog open={settingsOpen && !settingsDocked} onOpenChange={setSettingsOpen}>
        <SheetContent
          side={isPhone ? "bottom" : "right"}
          title="Customise"
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
        settingsVisible={settingsOpen}
        onNew={() => workspace.createDocument()}
        onOpenFile={() => fileInputRef.current?.click()}
        onPaste={() => void pasteFromClipboard()}
        onOpenDocument={workspace.openDocument}
        onPdf={() => void downloadPdf()}
        onHtml={() => void downloadHtml()}
        onMarkdown={downloadMarkdown}
        onPreset={workspace.applyPreset}
        onToggleEditor={isDesktop ? () => setShowEditor((visible) => !visible) : undefined}
        onToggleSettings={() => setSettingsOpen((open) => !open)}
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
              <FileUp className="size-6" />
            </span>
            <p className="mt-3 text-[15px] font-semibold">Drop to open</p>
            <p className="mt-1 text-xs text-muted-foreground">Markdown or plain text files</p>
          </div>
        </div>
      )}
    </div>
  );
}
