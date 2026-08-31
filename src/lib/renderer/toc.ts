import type { TocConfig } from "@/lib/config/schema";
import type { ExtractedHeading } from "@/lib/renderer/markdown";

/**
 * The table of contents.
 *
 * Page numbers are not written here - they cannot be. Only the layout engine
 * knows which page a heading lands on, and adding a contents page changes the
 * pagination it is describing. Each entry carries a link plus an empty,
 * fixed-width slot; fillTocPageNumbers() in paged-hooks.ts fills the slots once
 * Paged.js has finished laying the document out.
 *
 * The CSS way - `content: target-counter(attr(href), page)` - is one line and
 * far more elegant, but Paged.js resolves each occurrence with extra layout
 * passes. On a 27-page document it took the render from 6 seconds to 38.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderToc(
  toc: TocConfig,
  headings: readonly ExtractedHeading[],
): string {
  if (!toc.enabled) return "";

  const min = Math.min(toc.minDepth, toc.maxDepth);
  const max = Math.max(toc.minDepth, toc.maxDepth);

  const entries = headings.filter(
    (heading) => heading.depth >= min && heading.depth <= max && heading.id !== "",
  );

  // A contents page listing nothing is worse than no contents page.
  if (entries.length === 0) return "";

  const items = entries
    .map((heading) => {
      const number = heading.number
        ? `<span class="toc-number">${escapeHtml(heading.number)}</span>`
        : "";

      return [
        `<li class="toc-entry toc-level-${heading.depth}">`,
        `<a href="#${escapeHtml(heading.id)}">`,
        number,
        `<span class="toc-text">${escapeHtml(heading.text)}</span>`,
        // Flex spacer carrying the dot leader, then the slot the page number
        // is written into after layout. The slot has a reserved width, so
        // filling it cannot reflow the page and invalidate its own answer.
        '<span class="toc-leader"></span>',
        '<span class="toc-page"></span>',
        "</a>",
        "</li>",
      ].join("");
    })
    .join("\n");

  return [
    '<nav class="toc" role="doc-toc">',
    `<div class="toc-title">${escapeHtml(toc.title)}</div>`,
    '<ul class="toc-list">',
    items,
    "</ul>",
    "</nav>",
  ].join("\n");
}
