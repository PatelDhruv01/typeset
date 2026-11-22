import type { DocumentConfig } from "@/lib/config/schema";

/**
 * Getting a document out: PDF from the server, HTML and Markdown in the browser.
 */

export type PdfExport = {
  fileName: string;
  pages: number;
  ms: number;
  /** Paged.js failed and Chromium paginated instead: no running heads. */
  degraded: boolean;
  /** Characters no bundled font could draw. */
  missing: string[];
};

/** Hands a blob to the browser as a download. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Safari starts the download asynchronously; revoking at once can cancel it.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function exportPdf(input: {
  source: string;
  config: DocumentConfig;
  sourceName?: string;
  fallbackName: string;
  signal?: AbortSignal;
}): Promise<PdfExport> {
  const response = await fetch("/api/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // The full config, not the preset id: customisations have to reach the
    // renderer, and a complete config needs no preset to resolve against.
    body: JSON.stringify({
      source: input.source,
      config: input.config,
      sourceName: input.sourceName,
    }),
    signal: input.signal,
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `The server answered ${response.status}.`;
    throw new Error(message);
  }

  const blob = await response.blob();

  // The server's filename is authoritative: it comes from the same fallback
  // chain the PDF metadata uses. Recomputing it here would let the two drift.
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const encoded = /filename\*=UTF-8''([^;]+)/.exec(disposition)?.[1];
  const fileName = encoded ? decodeURIComponent(encoded) : `${input.fallbackName}.pdf`;

  saveBlob(blob, fileName);

  const missingHeader = response.headers.get("X-Typeset-Missing-Glyphs");
  return {
    fileName,
    pages: Number(response.headers.get("X-Typeset-Pages") ?? 0),
    ms: Number(response.headers.get("X-Typeset-Duration-Ms") ?? 0),
    degraded: response.headers.get("X-Typeset-Paginator") !== "pagedjs",
    missing: missingHeader ? decodeURIComponent(missingHeader).split(" ").filter(Boolean) : [],
  };
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read a font file."));
    reader.readAsDataURL(blob);
  });
}

/**
 * The rendered document as one HTML file that works offline: every font and
 * KaTeX file it references is fetched and inlined as a data: URI. The preview
 * already chose only the files this document needs, so this is a handful of
 * requests, not the whole font library.
 */
export async function exportStandaloneHtml(html: string, fileName: string): Promise<void> {
  const origin = window.location.origin;
  const pattern = new RegExp(
    `url\\((${origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/(?:fonts|katex)/[^)\\s]+)\\)`,
    "g",
  );

  const urls = [...new Set([...html.matchAll(pattern)].map((match) => match[1] as string))];
  const inlined = new Map<string, string>();

  await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Could not fetch ${url}.`);
      inlined.set(url, await toDataUrl(await response.blob()));
    }),
  );

  const standalone = html.replace(pattern, (match, url: string) => {
    const data = inlined.get(url);
    return data ? `url(${data})` : match;
  });

  saveBlob(new Blob([standalone], { type: "text/html;charset=utf-8" }), `${fileName}.html`);
}

export function exportMarkdown(source: string, fileName: string): void {
  saveBlob(new Blob([source], { type: "text/markdown;charset=utf-8" }), `${fileName}.md`);
}
