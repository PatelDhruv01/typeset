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

  describe("screen fallback", () => {
    // @page margins are inert until the document is paginated, so without this
    // block the live preview shows text running to the very edge of the frame.
    it("mirrors the page box for the unpaginated preview", () => {
      const out = css({
        page: { margins: { top: 10, right: 20, bottom: 30, left: 40 } },
      });
      expect(out).toContain(":root:not(.paginated) body");
      expect(out).toContain("padding: 10mm 20mm 30mm 40mm;");
      expect(out).toContain("max-width: 210mm;");
    });

    it("is scoped so Paged.js can switch it off and avoid double margins", () => {
      const out = css();

      // The bare body rule stays at zero padding. If the page box were applied
      // there instead of under the guard, paginated output would get @page
      // margins *and* body padding, and every margin would be doubled.
      const start = out.indexOf("body {");
      const bodyRule = out.slice(start, out.indexOf("}", start));
      expect(bodyRule).toContain("padding: 0;");

      const guard = out.indexOf(":root:not(.paginated) body");
      expect(guard).toBeGreaterThan(-1);
      expect(out.indexOf("padding: 25mm")).toBeGreaterThan(guard);
    });

    it("tracks orientation, like the page box does", () => {
      const out = css({ page: { orientation: "landscape" } });
      expect(out).toContain("max-width: 297mm;");
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

    it("maps {section} to the h1 running string, taken at the page start", () => {
      const out = css({ header: { enabled: true, center: "{section}" } });
      // `first` is the first value assigned on the page. Without it, a page
      // opening a new section still showed the previous one.
      expect(out).toContain("string(section-title, first)");
      expect(out).toContain("h1 { string-set: section-title content(text); }");
    });

    it("maps {subsection} to h2, kept separate from {section}", () => {
      // Having h1 and h2 write the same string made the head show whichever
      // came last, so a page opening on a new h1 displayed the previous h2.
      const out = css({ header: { enabled: true, center: "{subsection}" } });
      expect(out).toContain("string(subsection-title, first)");
      expect(out).toContain("h2 { string-set: subsection-title content(text); }");
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

  describe("justification", () => {
    it("neutralises the text-align-last Paged.js inherits onto everything", () => {
      // Paged.js marks split elements with
      // [data-align-last-split-element="justify"] so a fragment's last visible
      // line stays justified. text-align-last is inherited and the body wrapper
      // is split on every page, so without this the last line of every
      // paragraph, heading and cell came out stretched across the measure.
      const out = css({ typography: { align: "justify" } });
      expect(out).toContain("text-align-last: auto;");
      expect(out).toMatch(/p, li, dd, dt, blockquote, figcaption, td, th, pre/);
    });

    it("never justifies code, whatever the body alignment", () => {
      // text-align is inherited, so a justified body would stretch the spaces
      // in wrapped code lines and destroy the author's alignment.
      const out = css({ typography: { align: "justify" } });

      // Find the standalone `pre` rule, not the `code, kbd, samp, pre` one.
      const preRule = out
        .split("}")
        .map((chunk) => chunk.trim())
        .find((chunk) => chunk.startsWith("pre {"));

      expect(preRule).toBeDefined();
      expect(preRule).toContain("text-align: left;");
      expect(preRule).toContain("hyphens: none;");
    });
  });

  describe("cover page", () => {
    it("is absent unless enabled", () => {
      expect(css()).not.toContain("@page cover");
    });

    it("gets a named page with every margin box blanked", () => {
      // @page :first would also match the first content page in documents with
      // no cover, so the cover needs a page of its own.
      const out = css({ cover: { enabled: true } });
      expect(out).toContain("@page cover");
      expect(out).toContain("page: cover;");
      for (const box of [
        "@top-left",
        "@top-center",
        "@top-right",
        "@bottom-left",
        "@bottom-center",
        "@bottom-right",
      ]) {
        expect(out).toContain(`${box} { content: none; }`);
      }
    });
  });

  describe("contents", () => {
    it("is absent unless enabled", () => {
      expect(css()).not.toContain(".toc-entry");
    });

    it("resolves page numbers from the link target after layout", () => {
      // Only the layout engine knows which page a heading lands on, and adding
      // the contents page changes the pagination it describes.
      const out = css({ toc: { enabled: true } });
      expect(out).toContain("content: target-counter(attr(href), page);");
    });

    it("drops leaders and numbers when they are switched off", () => {
      const out = css({
        toc: { enabled: true, pageNumbers: false, dotLeaders: false },
      });
      expect(out).toContain(".toc-entry a::after { content: none; }");
      expect(out).not.toContain("border-bottom: 1px dotted var(--doc-border); margin-bottom");
    });

    it("only breaks the page after the contents when asked", () => {
      expect(css({ toc: { enabled: true } })).toContain("break-after: page;");
      expect(
        css({ toc: { enabled: true, breakAfter: false } }),
      ).not.toMatch(/\.toc \{[^}]*break-after: page/);
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
