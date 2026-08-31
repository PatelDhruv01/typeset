"use client";

import { useDeferredValue, useMemo, useState } from "react";

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
 * Phase 1 preview harness.
 *
 * Deliberately plain: this exists to make the renderer visible and to prove the
 * two claims the architecture rests on - that rendering is pure enough to run
 * in the browser, and that a preset is nothing more than a config value. The
 * real editor, the paginated preview and the PDF download arrive in Phases 2-4
 * and will replace this page entirely.
 */
export default function Home() {
  const [presetId, setPresetId] = useState<PresetId>(DEFAULT_PRESET_ID);
  const [source, setSource] = useState(DEFAULT_SAMPLE.source);

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

  return (
    <main className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
        <div className="mr-2">
          <span className="text-sm font-semibold tracking-tight">Typeset</span>
          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            phase 1
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
            onChange={(event) => setPresetId(event.target.value as PresetId)}
          >
            {PRESET_IDS.map((id) => (
              <option key={id} value={id}>
                {PRESETS[id].name}
              </option>
            ))}
          </select>
        </label>

        <p className="hidden text-xs text-muted-foreground sm:block">
          {PRESETS[presetId].tagline}
        </p>

        {rendered.ok && (
          <p className="ml-auto font-mono text-[11px] text-muted-foreground">
            {rendered.value.headings.length} headings ·{" "}
            {rendered.value.wordCount.toLocaleString()} words ·{" "}
            {rendered.value.fileName}.pdf
          </p>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
        <textarea
          value={source}
          onChange={(event) => setSource(event.target.value)}
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
