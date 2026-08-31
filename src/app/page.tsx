"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";

import {
  configFromPreset,
  DEFAULT_PRESET_ID,
  PRESETS,
  PRESET_IDS,
  type PresetId,
} from "@/lib/config/presets";
import { renderDocument } from "@/lib/renderer/document";
import { DEFAULT_SAMPLE, SAMPLES } from "@/lib/samples";

/**
 * Phase 2 harness.
 *
 * Still deliberately plain: it exists to exercise the renderer and the PDF
 * engine end to end. The real editor, the paginated preview and the
 * customisation drawer arrive in Phases 3-4 and replace this page.
 */

type DownloadState =
  | { status: "idle" }
  | { status: "working" }
  | { status: "done"; pages: number; ms: number; degraded: string | null }
  | { status: "error"; message: string };

export default function Home() {
  const [presetId, setPresetId] = useState<PresetId>(DEFAULT_PRESET_ID);
  const [source, setSource] = useState(DEFAULT_SAMPLE.source);
  const [download, setDownload] = useState<DownloadState>({ status: "idle" });

  // Rendering a large document on every keystroke would make typing feel
  // sticky. useDeferredValue lets the textarea stay responsive and the preview
  // catch up. Phase 3 moves this into a worker.
  const deferredSource = useDeferredValue(source);

  const rendered = useMemo(() => {
    try {
      return {
        ok: true as const,
        value: renderDocument(deferredSource, configFromPreset(presetId)),
      };
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }, [deferredSource, presetId]);

  const handleDownload = useCallback(async () => {
    setDownload({ status: "working" });

    try {
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, preset: presetId }),
      });

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const detail =
          body && typeof body === "object" && "error" in body
            ? String((body as { error: unknown }).error)
            : `Request failed with ${response.status}.`;
        setDownload({ status: "error", message: detail });
        return;
      }

      const blob = await response.blob();

      // The filename the server derived is authoritative - it is the same
      // fallback chain the PDF metadata uses. Read it back rather than
      // recomputing it here and risking the two drifting apart.
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

      const fallback = response.headers.get("X-Typeset-Fallback");
      setDownload({
        status: "done",
        pages: Number(response.headers.get("X-Typeset-Pages") ?? 0),
        ms: Number(response.headers.get("X-Typeset-Duration-Ms") ?? 0),
        degraded: fallback ? decodeURIComponent(fallback) : null,
      });
    } catch (error) {
      setDownload({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [presetId, rendered, source]);

  return (
    <main className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
        <div className="mr-2">
          <span className="text-sm font-semibold tracking-tight">Typeset</span>
          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            phase 2
          </span>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Sample
          <select
            className="rounded-md border border-input bg-card px-2 py-1 text-xs text-foreground"
            onChange={(event) => {
              const sample = SAMPLES.find((s) => s.id === event.target.value);
              if (sample) setSource(sample.source);
            }}
            defaultValue={DEFAULT_SAMPLE.id}
          >
            {SAMPLES.map((sample) => (
              <option key={sample.id} value={sample.id}>
                {sample.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Preset
          <select
            className="rounded-md border border-input bg-card px-2 py-1 text-xs text-foreground"
            value={presetId}
            onChange={(event) => {
              setPresetId(event.target.value as PresetId);
              setDownload({ status: "idle" });
            }}
          >
            {PRESET_IDS.map((id) => (
              <option key={id} value={id}>
                {PRESETS[id].name}
              </option>
            ))}
          </select>
        </label>

        <p className="hidden text-xs text-muted-foreground lg:block">
          {PRESETS[presetId].tagline}
        </p>

        <div className="ml-auto flex items-center gap-3">
          {download.status === "done" && (
            <span className="font-mono text-[11px] text-muted-foreground">
              {download.pages} pages in {(download.ms / 1000).toFixed(1)}s
              {download.degraded ? " · no running heads" : ""}
            </span>
          )}
          {download.status === "error" && (
            <span className="max-w-[28rem] truncate text-[11px] text-destructive">
              {download.message}
            </span>
          )}
          {rendered.ok && (
            <span className="hidden font-mono text-[11px] text-muted-foreground xl:inline">
              {rendered.value.wordCount.toLocaleString()} words ·{" "}
              {rendered.value.fileName}.pdf
            </span>
          )}

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

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
        <textarea
          value={source}
          onChange={(event) => {
            setSource(event.target.value);
            setDownload({ status: "idle" });
          }}
          spellCheck={false}
          aria-label="Markdown source"
          className="h-full resize-none border-r border-border bg-card p-4 font-mono text-[13px] leading-relaxed text-foreground outline-none"
        />

        <div className="h-full min-h-0 bg-muted">
          {rendered.ok ? (
            <iframe
              // `key` forces a fresh document rather than a srcdoc swap, which
              // otherwise leaves the previous stylesheet's @font-face rules
              // resident and can show the wrong font for a frame.
              key={presetId}
              title="Preview"
              srcDoc={rendered.value.html}
              // No background or padding here on purpose: the document's own
              // stylesheet draws the page and the surface behind it, so the
              // preview shows exactly what the stylesheet says.
              className="block h-full w-full border-0"
            />
          ) : (
            <pre className="m-4 whitespace-pre-wrap rounded-lg border border-destructive/40 bg-destructive/5 p-4 font-mono text-xs text-destructive">
              {rendered.message}
            </pre>
          )}
        </div>
      </div>
    </main>
  );
}
