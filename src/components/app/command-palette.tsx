"use client";

import type { ReactNode } from "react";
import { Command } from "cmdk";
import {
  BookOpen,
  Check,
  ClipboardPaste,
  Download,
  FileCode2,
  FilePlus2,
  FileText,
  Files,
  FolderOpen,
  Keyboard,
  Maximize2,
  Monitor,
  Moon,
  PanelLeft,
  Palette,
  ScrollText,
  Search,
  SlidersHorizontal,
  Sun,
} from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import type { DocumentSummary } from "@/lib/app/documents";
import type { ThemePreference } from "@/lib/app/theme";
import { PRESET_IDS, PRESETS, type PresetId } from "@/lib/config/presets";
import { SAMPLES } from "@/lib/samples";

export type CommandActions = {
  onNew: () => void;
  onOpenFile: () => void;
  onPaste: () => void;
  onOpenDocument: (id: string) => void;
  onPdf: () => void;
  onHtml: () => void;
  onMarkdown: () => void;
  onPreset: (id: PresetId) => void;
  onToggleEditor?: () => void;
  onToggleSettings: () => void;
  onPaginate: (paginate: boolean) => void;
  onFit: () => void;
  onTheme: (theme: ThemePreference) => void;
  onSample: (id: string) => void;
  onShortcuts: () => void;
};

/**
 * Predictable matching: every word typed must appear in the label or its
 * keywords. cmdk's default fuzzy scorer matched letters scattered across a
 * whole description, so "light" ranked the Technical style ("...built to
 * survive long listings") above "Light appearance" - and Enter ran it.
 * Labels that start with the query rank first, then word starts, then the rest.
 */
function filterCommands(value: string, search: string, keywords?: string[]): number {
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 1;

  const label = value.toLowerCase();
  const haystack = `${label} ${(keywords ?? []).join(" ").toLowerCase()}`;
  if (!terms.every((term) => haystack.includes(term))) return 0;

  const first = terms[0] as string;
  if (label.startsWith(first)) return 1;
  if (label.split(/[\s:·-]+/).some((word) => word.startsWith(first))) return 0.75;
  return 0.4;
}

function Item({
  value,
  icon,
  shortcut,
  keywords,
  onSelect,
  children,
  checked,
}: {
  /** What the search matches against; defaults to the visible label. */
  value: string;
  icon: ReactNode;
  shortcut?: string;
  keywords?: string[];
  onSelect: () => void;
  children: ReactNode;
  checked?: boolean;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      keywords={keywords}
      className="flex h-10 cursor-pointer select-none items-center gap-3 rounded-lg px-3 text-[13px] text-foreground outline-none data-[selected=true]:bg-surface-hover [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {checked && <Check className="!text-primary" />}
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </Command.Item>
  );
}

const GROUP =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-subtle-foreground";

export function CommandPalette({
  open,
  onOpenChange,
  modKey,
  documents,
  currentId,
  presetId,
  paginate,
  editorVisible,
  settingsVisible,
  ...actions
}: CommandActions & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modKey: string;
  documents: DocumentSummary[];
  currentId: string;
  presetId: PresetId;
  paginate: boolean;
  editorVisible: boolean;
  settingsVisible: boolean;
}) {
  // Every command closes the menu first, so a command that opens something
  // else (a file picker, a sheet) is not fighting this dialog for focus.
  const run = (action: () => void) => () => {
    onOpenChange(false);
    action();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[12vh] w-[min(600px,calc(100vw-24px))]">
        <DialogTitle className="sr-only">Command menu</DialogTitle>
        <DialogDescription className="sr-only">
          Search for an action, a style or a document, then press Enter.
        </DialogDescription>
        <Command loop filter={filterCommands} className="flex max-h-[min(520px,70dvh)] flex-col">
          <div className="flex items-center gap-2.5 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Command.Input
              autoFocus
              placeholder="Search actions, styles and documents…"
              className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-subtle-foreground focus-visible:outline-none"
            />
            <Kbd>Esc</Kbd>
          </div>
          <Command.List className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
            <Command.Empty className="py-10 text-center text-sm text-muted-foreground">
              Nothing matches that.
            </Command.Empty>

            <Command.Group heading="Document" className={GROUP}>
              <Item value="New document" icon={<FilePlus2 />} onSelect={run(actions.onNew)}>
                New document
              </Item>
              <Item value="Open a file" icon={<FolderOpen />} shortcut={`${modKey} O`} onSelect={run(actions.onOpenFile)}>
                Open a file…
              </Item>
              <Item value="Paste from clipboard" icon={<ClipboardPaste />} keywords={["chatgpt", "claude", "gemini"]} onSelect={run(actions.onPaste)}>
                Paste from clipboard
              </Item>
            </Command.Group>

            <Command.Group heading="Download" className={GROUP}>
              <Item value="Download PDF" icon={<Download />} shortcut={`${modKey} S`} keywords={["export", "save", "print"]} onSelect={run(actions.onPdf)}>
                Download PDF
              </Item>
              <Item value="Download web page (HTML)" icon={<FileCode2 />} keywords={["export", "offline"]} onSelect={run(actions.onHtml)}>
                Download web page (HTML)
              </Item>
              <Item value="Download Markdown" icon={<FileText />} keywords={["export", "md", "source"]} onSelect={run(actions.onMarkdown)}>
                Download Markdown
              </Item>
            </Command.Group>

            <Command.Group heading="Style" className={GROUP}>
              {PRESET_IDS.map((id) => (
                <Item
                  key={id}
                  value={`${PRESETS[id].name} style`}
                  icon={<Palette />}
                  keywords={["preset", "theme"]}
                  checked={id === presetId}
                  onSelect={run(() => actions.onPreset(id))}
                >
                  {PRESETS[id].name}
                  <span className="ml-2 text-muted-foreground">{PRESETS[id].tagline}</span>
                </Item>
              ))}
            </Command.Group>

            <Command.Group heading="View" className={GROUP}>
              {actions.onToggleEditor && (
                <Item value={editorVisible ? "Hide editor" : "Show editor"} icon={<PanelLeft />} shortcut={`${modKey} \\`} onSelect={run(actions.onToggleEditor)}>
                  {editorVisible ? "Hide editor" : "Show editor"}
                </Item>
              )}
              <Item value={settingsVisible ? "Hide customise panel" : "Customise the document"} icon={<SlidersHorizontal />} keywords={["settings", "customize", "margins", "fonts"]} onSelect={run(actions.onToggleSettings)}>
                {settingsVisible ? "Hide customise panel" : "Customise the document"}
              </Item>
              <Item value="Preview as pages" icon={<Files />} checked={paginate} onSelect={run(() => actions.onPaginate(true))}>
                Preview as pages
              </Item>
              <Item value="Preview as one continuous column" icon={<ScrollText />} checked={!paginate} onSelect={run(() => actions.onPaginate(false))}>
                Preview as one continuous column
              </Item>
              <Item value="Fit pages to width" icon={<Maximize2 />} keywords={["zoom"]} onSelect={run(actions.onFit)}>
                Fit pages to width
              </Item>
            </Command.Group>

            {documents.length > 0 && (
              <Command.Group heading="Recent documents" className={GROUP}>
                {documents.slice(0, 8).map((document) => (
                  <Item
                    key={document.id}
                    value={`${document.title} ${document.id}`}
                    icon={<FileText />}
                    keywords={["document", "open"]}
                    checked={document.id === currentId}
                    onSelect={run(() => actions.onOpenDocument(document.id))}
                  >
                    {document.title}
                  </Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Samples" className={GROUP}>
              {SAMPLES.map((sample) => (
                <Item key={sample.id} value={`${sample.name} sample`} icon={<BookOpen />} keywords={["example"]} onSelect={run(() => actions.onSample(sample.id))}>
                  {sample.name}
                </Item>
              ))}
            </Command.Group>

            <Command.Group heading="Appearance" className={GROUP}>
              <Item value="Light appearance" icon={<Sun />} keywords={["theme", "mode"]} onSelect={run(() => actions.onTheme("light"))}>
                Light appearance
              </Item>
              <Item value="Dark appearance" icon={<Moon />} keywords={["theme", "mode"]} onSelect={run(() => actions.onTheme("dark"))}>
                Dark appearance
              </Item>
              <Item value="Match the system appearance" icon={<Monitor />} keywords={["theme", "auto"]} onSelect={run(() => actions.onTheme("system"))}>
                Match the system appearance
              </Item>
            </Command.Group>

            <Command.Group heading="Help" className={GROUP}>
              <Item value="Keyboard shortcuts" icon={<Keyboard />} shortcut="?" onSelect={run(actions.onShortcuts)}>
                Keyboard shortcuts
              </Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
