import type { DocumentConfig } from "@/lib/config/schema";
import { buildDocumentCss, type CssOptions } from "@/lib/renderer/css";
import { renderCover } from "@/lib/renderer/cover";
import { renderToc } from "@/lib/renderer/toc";
import {
  renderMarkdown,
  type ExtractedHeading,
} from "@/lib/renderer/markdown";

/**
 * Markdown + DocumentConfig -> one complete, self-contained HTML document.
 *
 * This is the seam the whole architecture rests on. The preview iframe and the
 * PDF renderer both call this and get the same string; the only difference is
 * how asset URLs are resolved, which is what `CssOptions.resolveUrl` is for.
 */

export type RenderDocumentOptions = CssOptions & {
  /**
   * Filename of the uploaded source, if there was one. Used as the last
   * fallback when deriving an output name.
   */
  sourceName?: string;
  /** Injected so date-dependent output stays testable. */
  now?: Date;
};

export type RenderedDocument = {
  /** A complete `<!doctype html>` document. */
  html: string;
  /** Just the body markup, for callers that want to compose it themselves. */
  bodyHtml: string;
  /** The generated stylesheet, for debugging and for the "export HTML" path. */
  css: string;
  title: string;
  /** Output filename, without the .pdf extension. */
  fileName: string;
  headings: ExtractedHeading[];
  frontMatter: Record<string, unknown>;
  wordCount: number;
  /** True when the document actually contains maths, so KaTeX can be skipped. */
  hasMath: boolean;
  /** True when a cover page was actually produced, not merely requested. */
  hasCover: boolean;
  /** True when a contents page was actually produced. */
  hasToc: boolean;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Front matter values are `unknown`; only take them when they are usable text. */
function asText(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return null;
}

/**
 * A filename that is safe on every filesystem and still recognisable.
 *
 * Windows additionally forbids a set of reserved device names, and trailing
 * dots or spaces, so those are handled explicitly rather than trusting the
 * character filter alone.
 */
const WINDOWS_RESERVED =
  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function toSafeFileName(value: string, fallback = "document"): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "")
    .slice(0, 120);

  if (cleaned === "" || WINDOWS_RESERVED.test(cleaned)) return fallback;
  return cleaned;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function renderDocument(
  source: string,
  config: DocumentConfig,
  options: RenderDocumentOptions = {},
): RenderedDocument {
  const { sourceName, now = new Date(), ...cssOptions } = options;

  const parsed = renderMarkdown(source, {
    markdown: config.markdown,
    structure: config.structure,
  });

  // Resolution order is the same everywhere: explicit config wins, then front
  // matter, then what the document itself says, then the uploaded filename.
  const title =
    config.output.metadata.title ??
    config.cover.title ??
    asText(parsed.frontMatter.title) ??
    parsed.title ??
    (sourceName ? sourceName.replace(/\.[^.]+$/, "") : "") ??
    "";

  const author =
    config.output.metadata.author ??
    config.cover.author ??
    asText(parsed.frontMatter.author) ??
    "";

  const date =
    config.cover.date ?? asText(parsed.frontMatter.date) ?? formatDate(now);

  const subtitle =
    config.cover.subtitle ?? asText(parsed.frontMatter.subtitle) ?? "";

  const fileName = toSafeFileName(
    config.output.fileName ??
      title ??
      (sourceName ? sourceName.replace(/\.[^.]+$/, "") : ""),
  );

  // KaTeX is 23 KB of CSS plus twenty font files. Documents without maths -
  // which is most of them - should not pay for it.
  const hasMath = config.markdown.math && parsed.html.includes("katex");

  const css = buildDocumentCss(
    config,
    { title, subtitle, author, date, filename: fileName },
    { ...cssOptions, includeKatex: cssOptions.includeKatex ?? hasMath },
  );

  const cover = renderCover(config.cover, {
    title,
    subtitle,
    author,
    date,
  });

  const toc = renderToc(config.toc, parsed.headings);

  const bodyHtml = `${cover}${toc}<div class="doc-body">${parsed.html}</div>`;

  const html = [
    "<!doctype html>",
    `<html lang="en">`,
    "<head>",
    '<meta charset="utf-8">',
    `<title>${escapeHtml(title || fileName)}</title>`,
    author ? `<meta name="author" content="${escapeHtml(author)}">` : "",
    config.output.metadata.subject
      ? `<meta name="description" content="${escapeHtml(config.output.metadata.subject)}">`
      : "",
    config.output.metadata.keywords.length > 0
      ? `<meta name="keywords" content="${escapeHtml(config.output.metadata.keywords.join(", "))}">`
      : "",
    `<style>\n${css}\n</style>`,
    "</head>",
    "<body>",
    bodyHtml,
    "</body>",
    "</html>",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    html,
    bodyHtml,
    css,
    title,
    fileName,
    headings: parsed.headings,
    frontMatter: parsed.frontMatter,
    wordCount: parsed.wordCount,
    hasMath,
    hasCover: cover !== "",
    hasToc: toc !== "",
  };
}
