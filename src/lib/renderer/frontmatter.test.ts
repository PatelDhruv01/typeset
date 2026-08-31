import { describe, expect, it } from "vitest";

import { documentConfigSchema } from "@/lib/config/schema";
import { renderCover } from "@/lib/renderer/cover";
import { renderToc } from "@/lib/renderer/toc";
import type { ExtractedHeading } from "@/lib/renderer/markdown";

const CONTEXT = {
  title: "Groundwater Extraction",
  subtitle: "Findings and recommendations",
  author: "Policy Research Unit",
  date: "March 2026",
};

function cover(overrides: Record<string, unknown> = {}) {
  return renderCover(
    documentConfigSchema.parse({ cover: { enabled: true, ...overrides } }).cover,
    CONTEXT,
  );
}

function toc(
  headings: ExtractedHeading[],
  overrides: Record<string, unknown> = {},
) {
  return renderToc(
    documentConfigSchema.parse({ toc: { enabled: true, ...overrides } }).toc,
    headings,
  );
}

const HEADINGS: ExtractedHeading[] = [
  { depth: 1, text: "Executive summary", number: "1", id: "executive-summary" },
  { depth: 2, text: "Sampling frame", number: "1.1", id: "sampling-frame" },
  { depth: 3, text: "Instruments", number: "1.1.1", id: "instruments" },
  { depth: 1, text: "Findings", number: "2", id: "findings" },
];

describe("renderCover", () => {
  it("produces nothing when disabled", () => {
    expect(renderCover(documentConfigSchema.parse({}).cover, CONTEXT)).toBe("");
  });

  it("produces nothing when there is no title to show", () => {
    // A blank cover sheet is worse than no cover: the user has to explain it.
    expect(cover({ title: "" })).toBe("");
    expect(renderCover(
      documentConfigSchema.parse({ cover: { enabled: true } }).cover,
      { ...CONTEXT, title: "" },
    )).toBe("");
  });

  it("falls back to the document's own title, author and date", () => {
    const html = cover();
    expect(html).toContain("Groundwater Extraction");
    expect(html).toContain("Policy Research Unit");
    expect(html).toContain("March 2026");
  });

  it("prefers explicitly configured fields", () => {
    expect(cover({ title: "Override Title" })).toContain("Override Title");
  });

  it("never uses an h1, which would hijack the running head", () => {
    // An h1 here would set `section-title`, so every page of section one would
    // carry the document title instead of the section name.
    const html = cover();
    expect(html).not.toContain("<h1");
    expect(html).toContain('class="cover-title"');
  });

  it("escapes user-supplied fields", () => {
    const html = cover({ title: '<script>alert(1)</script>' });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("splits the abstract on blank lines", () => {
    const html = cover({ abstract: "First para.\n\nSecond para." });
    expect(html).toContain("<p>First para.</p>");
    expect(html).toContain("<p>Second para.</p>");
  });

  it("carries the layout through as a class", () => {
    expect(cover({ layout: "banner" })).toContain("cover cover-banner");
  });

  it("sizes the logo in millimetres, like all other geometry", () => {
    const html = cover({ logo: "data:image/png;base64,AAA", logoWidth: 55 });
    expect(html).toContain("width:55mm");
  });
});

describe("renderToc", () => {
  it("produces nothing when disabled", () => {
    expect(renderToc(documentConfigSchema.parse({}).toc, HEADINGS)).toBe("");
  });

  it("produces nothing when no heading is in range", () => {
    // A contents page listing nothing is worse than no contents page.
    expect(toc([])).toBe("");
    expect(toc(HEADINGS, { minDepth: 5, maxDepth: 6 })).toBe("");
  });

  it("links each entry so the page number can be resolved after layout", () => {
    const html = toc(HEADINGS);
    expect(html).toContain('href="#executive-summary"');
    expect(html).toContain('href="#findings"');
  });

  it("leaves the page-number slot empty for the layout pass to fill", () => {
    // Only the layout engine knows the page, and adding the contents page
    // changes the pagination it describes. Each entry therefore ships an empty
    // fixed-width slot that fillTocPageNumbers writes into afterwards.
    const html = toc(HEADINGS);
    for (const entry of html.split("<li").slice(1)) {
      expect(entry).toContain(
        '<span class="toc-leader"></span><span class="toc-page"></span></a>',
      );
    }
  });

  it("honours the depth range", () => {
    const html = toc(HEADINGS, { minDepth: 1, maxDepth: 2 });
    expect(html).toContain("Executive summary");
    expect(html).toContain("Sampling frame");
    expect(html).not.toContain("Instruments");
  });

  it("carries section numbers when heading numbering is on", () => {
    expect(toc(HEADINGS)).toContain('<span class="toc-number">1.1</span>');
  });

  it("omits the number span for unnumbered headings", () => {
    const html = toc([
      { depth: 1, text: "Plain", number: null, id: "plain" },
    ]);
    expect(html).not.toContain("toc-number");
    expect(html).toContain("Plain");
  });

  it("skips headings with no anchor, which cannot be linked", () => {
    const html = toc([
      { depth: 1, text: "Anchored", number: null, id: "anchored" },
      { depth: 1, text: "Orphan", number: null, id: "" },
    ]);
    expect(html).toContain("Anchored");
    expect(html).not.toContain("Orphan");
  });

  it("escapes heading text", () => {
    const html = toc([
      { depth: 1, text: "A <b>bold</b> claim", number: null, id: "a" },
    ]);
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
  });

  it("tags each entry with its level for indentation", () => {
    const html = toc(HEADINGS);
    expect(html).toContain("toc-entry toc-level-1");
    expect(html).toContain("toc-entry toc-level-3");
  });
});
