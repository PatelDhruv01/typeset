"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { MarkdownEditor } from "@/components/markdown-editor";
import {
  PaginatedPreview,
  type PreviewStatus,
} from "@/components/paginated-preview";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { mergeConfig } from "@/lib/config/merge";
import {
  configFromPreset,
  DEFAULT_PRESET_ID,
  PRESETS,
  PRESET_IDS,
  type PresetId,
} from "@/lib/config/presets";
import {
  documentConfigSchema,
  type DocumentConfig,
  type PartialDocumentConfig,
} from "@/lib/config/schema";
import { useDebouncedValue, useTheme } from "@/lib/hooks";
import { absoluteAssetUrl } from "@/lib/renderer/asset-urls";
import { renderDocument } from "@/lib/renderer/document";
import { DEFAULT_SAMPLE, SAMPLES } from "@/lib/samples";

/** Long enough that typing never triggers a layout; short enough to feel live. */
const SOURCE_DEBOUNCE_MS = 500;
/** Shorter: settings changes are discrete, so the wait is more noticeable. */
const CONFIG_DEBOUNCE_MS = 250;

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5] as const;

type DownloadState =
  | { status: "idle" }
  | { status: "working" }
  | { status: "done"; pages: number; ms: number; degraded: boolean }
  | { status: "error"; message: string };

export default function Home() {
  const [presetId, setPresetId] = useState<PresetId>(DEFAULT_PRESET_ID);
  const [config, setConfig] = useState<DocumentConfig>(() =>
    configFromPreset(DEFAULT_PRESET_ID),
  );
  const [source, setSource] = useState(DEFAULT_SAMPLE.source);
  const [sourceName, setSourceName] = useState<string | undefined>(undefined);
  const [showSettings, setShowSettings] = useState(false);
  const [paginate, setPaginate] = useState(true);
  const [fellBackToContinuous, setFellBackToContinuous] = useState(false);
  const [zoom, setZoom] = useState(0.75);
  const [preview, setPreview] = useState<PreviewStatus>({ state: "idle" });
  const [download, setDownload] = useState<DownloadState>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const [theme, toggleTheme] = useTheme();

  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Every settings change goes through the schema.
   *
   * Merging a partial and re-parsing means the config in state is always valid,
   * so no component downstream has to defend against a half-typed colour or a
   * cleared number field. An unparseable patch is dropped and the last good
   * value stands.
   */
  const update = useCallback((patch: PartialDocumentConfig) => {
    setConfig((previous) => {
      try {
        return documentConfigSchema.parse(mergeConfig(previous, patch));
      } catch {
        return previous;
      }
    });
    setDownload({ status: "idle" });
  }, []);

  const applyPreset = useCallback((id: PresetId) => {
    setPresetId(id);
    setConfig(configFromPreset(id));
    setDownload({ status: "idle" });
  }, []);

  // Provenance, so the panel can say "Report (modified)" and offer a reset.
  const modified = useMemo(
    () =>
      JSON.stringify(config) !== JSON.stringify(configFromPreset(presetId)),
    [config, presetId],
  );

  // Rendering Markdown is fast; laying it out into pages is not. Debouncing
  // both inputs means the iframe is rebuilt only once the user pauses.
  const settledSource = useDebouncedValue(source, SOURCE_DEBOUNCE_MS);
  const settledConfig = useDebouncedValue(config, CONFIG_DEBOUNCE_MS);

  const rendered = useMemo(() => {
    try {
      return {
        ok: true as const,
        value: renderDocument(settledSource, settledConfig, {
          sourceName,
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
  }, [settledSource, settledConfig, sourceName]);

  const openFile = useCallback(async (file: File) => {
    const text = await file.text();
    setSource(text);
    setSourceName(file.name);
    setDownload({ status: "idle" });
  }, []);

  const handleDownload = useCallback(async () => {
    setDownload({ status: "working" });

    try {
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The full config, not the preset id: customisations have to reach the
        // renderer, and a complete config needs no preset to resolve against.
        body: JSON.stringify({ source, config, sourceName }),
      });

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message =
          body && typeof body === "object" && "error" in body
            ? String((body as { error: unknown }).error)
            : `Request failed with ${response.status}.`;
        setDownload({ status: "error", message });
        return;
      }

      const blob = await response.blob();

      // The server's filename is authoritative: it comes from the same fallback
      // chain the PDF metadata uses. Recomputing it here would let the two drift.
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const encoded = /filename\*=UTF-8''([^;]+)/.exec(disposition)?.[1];
      const fileName = encoded
        ? decodeURIComponent(encoded)
        : `${rendered.ok ? rendered.value.fileName : "document"}.pdf`;

      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);

      setDownload({
        status: "done",
        pages: Number(response.headers.get("X-Typeset-Pages") ?? 0),
        ms: Number(response.headers.get("X-Typeset-Duration-Ms") ?? 0),
        degraded: response.headers.get("X-Typeset-Paginator") !== "pagedjs",
      });
    } catch (error) {
      setDownload({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [config, rendered, source, sourceName]);

  const zoomBy = useCallback((direction: 1 | -1) => {
    setZoom((current) => {
      const index = ZOOM_STEPS.indexOf(current as (typeof ZOOM_STEPS)[number]);
      const from = index === -1 ? 2 : index;
      const next = Math.min(ZOOM_STEPS.length - 1, Math.max(0, from + direction));
      return ZOOM_STEPS[next] ?? 1;
    });
  }, []);

  return (
    <main
      className="flex h-dvh flex-col"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) void openFile(file);
      }}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <span className="mr-1 text-sm font-semibold tracking-tight">Typeset</span>

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

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md border border-input px-2.5 py-1 text-xs transition-colors hover:bg-surface-hover"
        >
          Open file
        </button>

        <select
          className="rounded-md border border-input bg-card px-2 py-1 text-xs text-foreground"
          defaultValue={DEFAULT_SAMPLE.id}
          aria-label="Sample document"
          onChange={(event) => {
            const sample = SAMPLES.find((s) => s.id === event.target.value);
            if (!sample) return;
            setSource(sample.source);
            setSourceName(undefined);
            setDownload({ status: "idle" });
          }}
        >
          {SAMPLES.map((sample) => (
            <option key={sample.id} value={sample.id}>
              {sample.name}
            </option>
          ))}
        </select>

        {/* The output filename, editable in place. This is the fallback chain
            output.fileName already implements - explicit override, else front
            matter title, else the first heading, else the opened filename -
            surfaced where it's actually useful, instead of only reachable via
            Customise > Output. */}
        <EditableFilename
          value={
            config.output.fileName ??
            (rendered.ok
              ? rendered.value.fileName
              : (sourceName?.replace(/\.[^./]+$/, "") ?? "document"))
          }
          isOverridden={config.output.fileName !== null}
          onCommit={(next) => update({ output: { fileName: next } })}
        />

        <div className="ml-auto flex items-center gap-2">
          {download.status === "error" && (
            <span className="max-w-[20rem] truncate text-[11px] text-destructive">
              {download.message}
            </span>
          )}
          {download.status === "done" && (
            <span className="font-mono text-[11px] text-muted-foreground">
              saved · {download.pages}pp · {(download.ms / 1000).toFixed(1)}s
              {download.degraded ? " · no running heads" : ""}
            </span>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} appearance`}
            className="grid size-7 place-items-center rounded-md border border-input transition-colors hover:bg-surface-hover"
          >
            {theme === "dark" ? <MoonIcon /> : <SunIcon />}
          </button>

          <button
            type="button"
            onClick={() => setShowSettings((open) => !open)}
            aria-pressed={showSettings}
            aria-label="Customise"
            className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
              showSettings
                ? "border-foreground bg-foreground text-background"
                : "border-input hover:bg-surface-hover"
            }`}
          >
            Customise{modified ? " ·" : ""}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={download.status === "working" || !rendered.ok}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {download.status === "working" ? "Rendering…" : "Download PDF"}
          </button>
        </div>
      </header>

      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-3 py-1.5">
        {PRESET_IDS.map((id) => {
          const active = id === presetId;
          return (
            <button
              key={id}
              type="button"
              title={PRESETS[id].bestFor}
              aria-label={`${PRESETS[id].name} preset`}
              aria-pressed={active}
              onClick={() => applyPreset(id)}
              className={`shrink-0 rounded-md px-2.5 py-1 text-xs transition-colors ${
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
              }`}
            >
              {PRESETS[id].name}
            </button>
          );
        })}
        {/* ml-auto plus a rule of its own is the point: sitting flush after
            the button row (as it did before) reads as an eighth, unlabelled
            preset rather than a caption describing the one that's active. */}
        <span className="ml-auto hidden truncate border-l border-border pl-3 text-[11px] italic text-muted-foreground xl:block">
          {modified ? "Modified from " : ""}
          {PRESETS[presetId].tagline}
        </span>
      </div>

      {/* Only a wide viewport gets a third column. Below xl the settings panel
          is an overlay and does not take part in the grid, so the editor and
          preview keep their halves.
          `relative` here is load-bearing: the overlay below is `absolute`
          against *this* box, which already excludes the header and footer.
          It used to be `fixed` against the viewport, which ignored the footer
          entirely and sat on top of it (z-40) whenever the panel was open. */}
      <div
        className={`relative grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2 ${
          showSettings
            ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_330px]"
            : ""
        }`}
      >
        <div className="min-h-0 border-r border-border">
          <MarkdownEditor
            value={source}
            onChange={(next) => {
              setSource(next);
              setDownload({ status: "idle" });
            }}
            placeholder="Write Markdown here, or drop a .md file anywhere on the page."
          />
        </div>

        <div className="relative min-h-0 bg-muted">
          {rendered.ok ? (
            <PaginatedPreview
              html={rendered.value.html}
              paginate={paginate}
              pageOffset={settledConfig.structure.startPageNumber - 1}
              zoom={zoom}
              onStatus={(status) => {
                setPreview(status);
                // A failed layout leaves the pane showing the previous pages,
                // which would silently misrepresent the current document.
                // Continuous is always correct, just unpaginated - better to
                // show the right content in the wrong shape than the wrong
                // content in the right one.
                if (status.state === "error" && paginate) {
                  setPaginate(false);
                  setFellBackToContinuous(true);
                }
              }}
            />
          ) : (
            <pre className="m-4 whitespace-pre-wrap rounded-lg border border-destructive/40 bg-destructive/5 p-4 font-mono text-xs text-destructive">
              {rendered.message}
            </pre>
          )}

          {preview.state === "laying-out" && paginate && (
            <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-card/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm">
              Laying out…
            </div>
          )}
        </div>

        {showSettings && (
          <div className="absolute inset-y-0 right-0 z-40 w-[330px] max-w-[85vw] shadow-2xl xl:static xl:z-auto xl:col-start-3 xl:shadow-none">
            <SettingsPanel
              config={config}
              onChange={update}
              presetId={presetId}
              modified={modified}
              onResetPreset={() => applyPreset(presetId)}
            />
          </div>
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
        {rendered.ok && (
          <>
            <span>{rendered.value.wordCount.toLocaleString()} words</span>
            <span>{rendered.value.headings.length} headings</span>
            <span className="truncate">{rendered.value.fileName}.pdf</span>
          </>
        )}

        {preview.state === "ready" && paginate && (
          <span>
            {preview.pages} pages · {(preview.ms / 1000).toFixed(1)}s
          </span>
        )}
        {preview.state === "error" && (
          <span className="text-destructive">{preview.message}</span>
        )}
        {fellBackToContinuous && !paginate && (
          <span className="text-warning">Showing continuous view</span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-input">
            {(
              [
                ["Pages", true],
                ["Continuous", false],
              ] as const
            ).map(([label, value]) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setPaginate(value);
                  setFellBackToContinuous(false);
                }}
                className={`px-2 py-0.5 transition-colors ${
                  paginate === value
                    ? "bg-foreground text-background"
                    : "hover:bg-surface-hover"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => zoomBy(-1)}
              aria-label="Zoom out"
              className="rounded border border-input px-1.5 transition-colors hover:bg-surface-hover"
            >
              −
            </button>
            <span className="w-10 text-center tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => zoomBy(1)}
              aria-label="Zoom in"
              className="rounded border border-input px-1.5 transition-colors hover:bg-surface-hover"
            >
              +
            </button>
          </div>
        </div>
      </footer>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/80">
          <div className="rounded-xl border-2 border-dashed border-primary px-8 py-6 text-sm font-medium">
            Drop a Markdown file to open it
          </div>
        </div>
      )}
    </main>
  );
}

/**
 * The output filename, shown as plain text and turned into an input on click.
 *
 * A top-level function, not one nested inside Home: nested there, it would be a
 * new component type on every render and React would unmount/remount it on
 * each keystroke elsewhere in the app - the same bug LengthField had in the
 * settings panel. Its edit state has to survive its parent re-rendering, so it
 * owns that state itself rather than being fully controlled.
 */
function EditableFilename({
  value,
  isOverridden,
  onCommit,
}: {
  /** The name to show while not editing - either an override or the derived one. */
  value: string;
  /** True when `value` is a user override rather than a derived name. */
  isOverridden: boolean;
  /** Called with the new override, or null to go back to the derived name. */
  onCommit: (next: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const startEditing = () => {
    setDraft(value);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === value) return; // Nothing actually changed.
    onCommit(trimmed === "" ? null : trimmed);
  };

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        value={draft}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        aria-label="Output filename"
        className="min-w-0 max-w-[16rem] rounded border border-ring bg-card px-1.5 py-0.5 font-mono text-[11px] text-foreground outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      title="Click to rename the PDF"
      className="group flex min-w-0 max-w-[16rem] items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
    >
      <span className="truncate">{value}.pdf</span>
      {isOverridden && (
        <span
          role="button"
          tabIndex={0}
          title="Reset to the automatic name"
          onClick={(event) => {
            event.stopPropagation();
            onCommit(null);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.stopPropagation();
            event.preventDefault();
            onCommit(null);
          }}
          className="shrink-0 rounded px-1 text-muted-foreground/70 hover:bg-muted hover:text-foreground"
        >
          ×
        </span>
      )}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}
