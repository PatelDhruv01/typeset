"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { MarkdownEditor } from "@/components/markdown-editor";
import {
  PaginatedPreview,
  type PreviewStatus,
} from "@/components/paginated-preview";
import {
  configFromPreset,
  DEFAULT_PRESET_ID,
  PRESETS,
  PRESET_IDS,
  type PresetId,
} from "@/lib/config/presets";
import { useDebouncedValue, useTheme } from "@/lib/hooks";
import { absoluteAssetUrl } from "@/lib/renderer/asset-urls";
import { renderDocument } from "@/lib/renderer/document";
import { DEFAULT_SAMPLE, SAMPLES } from "@/lib/samples";

/** Long enough that typing never triggers a layout; short enough to feel live. */
const PREVIEW_DEBOUNCE_MS = 500;

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5] as const;

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

type DownloadState =
  | { status: "idle" }
  | { status: "working" }
  | { status: "done"; pages: number; ms: number; degraded: boolean }
  | { status: "error"; message: string };

export default function Home() {
  const [presetId, setPresetId] = useState<PresetId>(DEFAULT_PRESET_ID);
  const [source, setSource] = useState(DEFAULT_SAMPLE.source);
  const [sourceName, setSourceName] = useState<string | undefined>(undefined);
  const [paginate, setPaginate] = useState(true);
  const [zoom, setZoom] = useState(0.75);
  const [preview, setPreview] = useState<PreviewStatus>({ state: "idle" });
  const [download, setDownload] = useState<DownloadState>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const [theme, toggleTheme] = useTheme();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const config = useMemo(() => configFromPreset(presetId), [presetId]);

  // Rendering Markdown is fast; laying it out into pages is not. Debouncing
  // here means the iframe is only rebuilt once the user pauses.
  const settledSource = useDebouncedValue(source, PREVIEW_DEBOUNCE_MS);

  const rendered = useMemo(() => {
    try {
      return {
        ok: true as const,
        value: renderDocument(settledSource, config, {
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
  }, [settledSource, config, sourceName]);

  const openFile = useCallback(async (file: File) => {
    const text = await file.text();
    setSource(text);
    setSourceName(file.name);
    setDownload({ status: "idle" });
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files[0];
      if (file) void openFile(file);
    },
    [openFile],
  );

  const handleDownload = useCallback(async () => {
    setDownload({ status: "working" });

    try {
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, preset: presetId, sourceName }),
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
  }, [presetId, rendered, source, sourceName]);

  const zoomBy = useCallback((direction: 1 | -1) => {
    setZoom((current) => {
      const index = ZOOM_STEPS.indexOf(current as (typeof ZOOM_STEPS)[number]);
      const from = index === -1 ? 2 : index;
      const next = Math.min(
        ZOOM_STEPS.length - 1,
        Math.max(0, from + direction),
      );
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
      onDrop={handleDrop}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <span className="mr-1 text-sm font-semibold tracking-tight">
          Typeset
        </span>

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

        {sourceName && (
          <span className="max-w-[16rem] truncate font-mono text-[11px] text-muted-foreground">
            {sourceName}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {download.status === "error" && (
            <span className="max-w-[22rem] truncate text-[11px] text-destructive">
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
              onClick={() => {
                setPresetId(id);
                setDownload({ status: "idle" });
              }}
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
        <span className="ml-2 hidden truncate text-[11px] text-muted-foreground lg:block">
          {PRESETS[presetId].tagline}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
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
              pageOffset={config.structure.startPageNumber - 1}
              zoom={zoom}
              onStatus={setPreview}
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
                onClick={() => setPaginate(value)}
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
