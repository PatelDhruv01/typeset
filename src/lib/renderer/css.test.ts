import { describe, expect, it } from "vitest";

import { configFromPreset } from "@/lib/config/presets";
import {
  documentConfigSchema,
  type PartialDocumentConfig,
} from "@/lib/config/schema";
import { buildDocumentCss } from "@/lib/renderer/css";

const CONTEXT = {
  title: "Quarterly Review",
  subtitle: "Draft two",
  author: "A. Nother",
  date: "1 March 2026",
  filename: "quarterly-review",
};

function css(overrides: PartialDocumentConfig = {}) {
  return buildDocumentCss(documentConfigSchema.parse(overrides), CONTEXT, {
    includeKatex: false,
  });
}

describe("buildDocumentCss", () => {
  describe("page geometry", () => {
    it("emits A4 in millimetres by default", () => {
      expect(css()).toContain("size: 210mm 297mm;");
    });

    it("swaps the axes for landscape", () => {
      expect(css({ page: { orientation: "landscape" } })).toContain(
        "size: 297mm 210mm;",
      );
    });

    it("uses custom dimensions only when size is custom", () => {
      const custom = css({
        page: { size: "custom", customWidth: 120, customHeight: 180 },
      });
      expect(custom).toContain("size: 120mm 180mm;");

      // Custom dimensions are ignored while a named size is selected, so
      // switching back and forth does not lose the named size.
      expect(css({ page: { customWidth: 120, customHeight: 180 } })).toContain(
        "size: 210mm 297mm;",
      );
    });

    it("emits margins in CSS order", () => {
      expect(
        css({ page: { margins: { top: 10, right: 20, bottom: 30, left: 40 } } }),
      ).toContain("margin: 10mm 20mm 30mm 40mm;");
    });
  });

  describe("running heads and feet", () => {
    it("turns {page} and {pages} into live counters, not text", () => {
      const out = css({ footer: { enabled: true, right: "{page} / {pages}" } });
      expect(out).toContain('counter(page) " / " counter(pages)');
    });

    it("substitutes document metadata as literal strings", () => {
      const out = css({ header: { enabled: true, left: "{title} - {author}" } });
      expect(out).toContain('"Quarterly Review" " - " "A. Nother"');
    });

    it("maps {section} to the running string set by headings", () => {
      const out = css({ header: { enabled: true, center: "{section}" } });
      expect(out).toContain("string(section-title)");
      expect(out).toContain("string-set: section-title content(text)");
    });

    it("emits nothing for a disabled slot", () => {
      expect(css({ header: { enabled: false, left: "{title}" } })).not.toContain(
        "@top-left",
      );
    });

    it("suppresses running text on the first page when asked", () => {
      const out = css({
        footer: { enabled: true, center: "{page}", showOnFirstPage: false },
      });
      expect(out).toContain("@page :first");
      expect(out).toContain("@bottom-center { content: none; }");
    });

    it("escapes quotes in user text rather than breaking the stylesheet", () => {
      const out = css({ header: { enabled: true, left: 'The "Big" Report' } });
      expect(out).toContain('\\"Big\\"');
    });
  });

  describe("typography", () => {
    it("always appends the Devanagari fallback to the stack", () => {
      expect(css()).toContain("Noto Sans Devanagari");
    });

    it("derives heading sizes from the modular scale", () => {
      const out = css({ typography: { headingScale: 1.2 } });
      // 1.2^3 = 1.728, 1.2^2 = 1.44
      expect(out).toContain("h1 { font-size: 1.728em; }");
      expect(out).toContain("h2 { font-size: 1.44em; }");
      expect(out).toContain("h4 { font-size: 1em; }");
    });

    it("enables hyphenation only when asked", () => {
      expect(css({ typography: { hyphenate: true } })).toContain("hyphens: auto");
      expect(css()).toContain("hyphens: manual");
    });

    it("wraps long code lines by default and can be told not to", () => {
      expect(css()).toContain("white-space: pre-wrap");
      expect(css({ typography: { wrapCode: false } })).toContain(
        "white-space: pre;",
      );
    });
  });

  describe("link styles", () => {
    it("prints the URL after the link text in footnote mode", () => {
      const out = css({ theme: { linkStyle: "footnote" } });
      expect(out).toContain('content: "(" attr(href) ")"');
      // The separator has to be a margin: CSS collapses leading whitespace in
      // generated content, so " (" would render flush against the link text.
      expect(out).toContain("margin-left: 0.3em");
    });

    it("does not print URLs in any other mode", () => {
      for (const style of ["colour", "underline", "plain"] as const) {
        expect(css({ theme: { linkStyle: style } })).not.toContain("attr(href)");
      }
    });
  });

  describe("pagination control", () => {
    it("never lets a heading sit alone at the foot of a page", () => {
      expect(css()).toContain("break-after: avoid-page");
    });

    it("repeats table headers across a page break", () => {
      expect(css()).toContain("thead { display: table-header-group; }");
    });

    it("honours the avoidBreakInside list", () => {
      const out = css({ structure: { avoidBreakInside: ["table"] } });
      expect(out).toMatch(/table \{\n\s+break-inside: avoid;/);
    });

    it("breaks before a chosen heading level, but never the first one", () => {
      const out = css({ structure: { pageBreakBefore: "h1" } });
      expect(out).toContain("break-before: page");
      expect(out).toContain("h1:first-child");
    });
  });

  describe("watermark", () => {
    it("is absent unless enabled with text", () => {
      expect(css()).not.toContain("pagedjs_page::after");
      expect(css({ watermark: { enabled: true, text: "   " } })).not.toContain(
        "pagedjs_page::after",
      );
    });

    it("renders per paginated page when enabled", () => {
      const out = css({
        watermark: { enabled: true, text: "DRAFT", rotation: -45 },
      });
      expect(out).toContain('content: "DRAFT"');
      expect(out).toContain("rotate(-45deg)");
    });
  });

  describe("presets", () => {
    it("produces a stylesheet for every preset without throwing", () => {
      for (const id of ["github", "technical", "report", "academic", "book", "minimal", "night"] as const) {
        expect(() =>
          buildDocumentCss(configFromPreset(id), CONTEXT, { includeKatex: false }),
        ).not.toThrow();
      }
    });

    it("only emits the fonts a preset actually uses", () => {
      const academic = buildDocumentCss(configFromPreset("academic"), CONTEXT, {
        includeKatex: false,
      });
      expect(academic).toContain("EB Garamond");
      expect(academic).not.toContain("font-family: Literata");
    });
  });

  it("rewrites asset URLs through resolveUrl, for the inlining renderer", () => {
    const out = buildDocumentCss(documentConfigSchema.parse({}), CONTEXT, {
      includeKatex: false,
      resolveUrl: (url) => `data:font/woff2;base64,STUB(${url})`,
    });
    expect(out).toContain("data:font/woff2;base64,STUB(/fonts/inter/");
    expect(out).not.toContain("src: url(/fonts/");
  });
});
