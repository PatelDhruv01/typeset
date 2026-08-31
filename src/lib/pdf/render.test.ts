import { PDFDocument } from "pdf-lib";
import { afterAll, describe, expect, it } from "vitest";

import { configFromPreset } from "@/lib/config/presets";
import { documentConfigSchema } from "@/lib/config/schema";
import { browserEnvironment, closeBrowser } from "@/lib/pdf/browser";
import { renderPdf, renderPdfWithFallback } from "@/lib/pdf/render";

/**
 * These tests drive a real Chromium, so they are slow and depend on a browser
 * being installed. They skip rather than fail when there is none, so a
 * contributor without Chrome still gets a green suite for everything else.
 */
const hasBrowser =
  browserEnvironment.isServerless || browserEnvironment.hasCandidate();

const describePdf = hasBrowser ? describe : describe.skip;

const TIMEOUT = 90_000;
const FIXED_NOW = new Date("2026-03-01T00:00:00Z");

const SHORT = `# Test Document

A paragraph of body text.

| Column | Value |
|---|---|
| One | 1 |

\`\`\`js
const x = 1;
\`\`\`
`;

/** Enough content to be certain it spills onto a second page. */
const LONG = `# Long Document\n\n${Array.from(
  { length: 60 },
  (_, i) => `## Section ${i + 1}\n\nParagraph ${i + 1}. ${"Filler text. ".repeat(20)}`,
).join("\n\n")}`;

function isPdf(bytes: Uint8Array): boolean {
  // %PDF-
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

describePdf("renderPdf", () => {
  afterAll(async () => {
    await closeBrowser();
  });

  it(
    "produces a valid PDF",
    async () => {
      const result = await renderPdf(SHORT, configFromPreset("github"), {
        now: FIXED_NOW,
      });

      expect(isPdf(result.pdf)).toBe(true);
      expect(result.pageCount).toBeGreaterThanOrEqual(1);
      expect(result.paginatedBy).toBe("pagedjs");
      expect(result.fileName).toBe("Test Document");
    },
    TIMEOUT,
  );

  it(
    "embeds the text, so the PDF is selectable rather than an image",
    async () => {
      const result = await renderPdf(SHORT, configFromPreset("github"), {
        now: FIXED_NOW,
      });
      // Rasterising the page is the classic failure mode of these tools. A real
      // text PDF names font resources in its page dictionary; an image of a
      // page does not. Re-saving without object streams puts those dictionaries
      // in the clear, since the shipped file compresses them.
      const flat = await (await PDFDocument.load(result.pdf)).save({
        useObjectStreams: false,
      });
      expect(Buffer.from(flat).toString("latin1")).toContain("/Font");
    },
    TIMEOUT,
  );

  it(
    "writes document metadata into the PDF, not just the HTML",
    async () => {
      const result = await renderPdf(
        SHORT,
        documentConfigSchema.parse({
          output: {
            metadata: {
              title: "Metadata Title",
              author: "A. Nother",
              subject: "Testing",
              keywords: ["alpha", "beta"],
            },
          },
        }),
        { now: FIXED_NOW },
      );

      // updateMetadata: false is essential here. pdf-lib stamps its own
      // Producer over the file the instant it loads one, so reading with the
      // default would measure this test's own write rather than the engine's.
      const pdf = await PDFDocument.load(result.pdf, { updateMetadata: false });
      expect(pdf.getTitle()).toBe("Metadata Title");
      expect(pdf.getAuthor()).toBe("A. Nother");
      expect(pdf.getSubject()).toBe("Testing");
      expect(pdf.getKeywords()).toContain("alpha");
      expect(pdf.getProducer()).toBe("Typeset");
    },
    TIMEOUT,
  );

  it(
    "paginates a long document onto multiple pages",
    async () => {
      const result = await renderPdf(LONG, configFromPreset("github"), {
        now: FIXED_NOW,
      });
      expect(result.pageCount).toBeGreaterThan(1);
    },
    TIMEOUT,
  );

  it(
    "honours page size and orientation",
    async () => {
      const landscape = await renderPdf(
        SHORT,
        documentConfigSchema.parse({
          page: { size: "a4", orientation: "landscape" },
        }),
        { now: FIXED_NOW },
      );

      const pdf = await PDFDocument.load(landscape.pdf);
      const { width, height } = pdf.getPage(0).getSize();
      expect(width).toBeGreaterThan(height);
      // A4 landscape is 297mm wide = 841.89pt, within a rounding tolerance.
      expect(width).toBeGreaterThan(830);
      expect(width).toBeLessThan(850);
    },
    TIMEOUT,
  );

  it(
    "does not double the margins when Paged.js takes over",
    async () => {
      // The stylesheet applies the page box as body padding while unpaginated.
      // If the .paginated class were not set before layout, that padding would
      // stack on top of the @page margins and the text block would shrink.
      const wide = await renderPdf(
        SHORT,
        documentConfigSchema.parse({
          page: { margins: { top: 40, right: 40, bottom: 40, left: 40 } },
        }),
        { now: FIXED_NOW },
      );

      const narrow = await renderPdf(
        SHORT,
        documentConfigSchema.parse({
          page: { margins: { top: 10, right: 10, bottom: 10, left: 10 } },
        }),
        { now: FIXED_NOW },
      );

      // Both must be the same physical page size; only the text block differs.
      const wideSize = (await PDFDocument.load(wide.pdf)).getPage(0).getSize();
      const narrowSize = (await PDFDocument.load(narrow.pdf))
        .getPage(0)
        .getSize();

      expect(Math.round(wideSize.width)).toBe(Math.round(narrowSize.width));
      expect(Math.round(wideSize.height)).toBe(Math.round(narrowSize.height));
    },
    TIMEOUT,
  );

  it(
    "renders every preset",
    async () => {
      for (const id of ["github", "academic", "night"] as const) {
        const result = await renderPdf(SHORT, configFromPreset(id), {
          now: FIXED_NOW,
        });
        expect(isPdf(result.pdf), id).toBe(true);
      }
    },
    TIMEOUT * 2,
  );

  it(
    "numbers the contents entries, and stays fast doing it",
    async () => {
      // Resolving these with CSS target-counter took a 27-page document from
      // 6 seconds to 38 - past the timeout and into the Chromium fallback.
      // They are filled from the finished layout instead. Both halves matter:
      // the numbers must appear AND Paged.js must still have been used.
      const result = await renderPdf(
        LONG,
        documentConfigSchema.parse({
          toc: { enabled: true, maxDepth: 3 },
          structure: { numberHeadings: true },
        }),
        { now: FIXED_NOW },
      );

      expect(result.paginatedBy).toBe("pagedjs");
      expect(result.tocEntriesNumbered).toBeGreaterThan(50);
    },
    TIMEOUT,
  );

  it(
    "reports no numbered entries when the contents is off",
    async () => {
      const result = await renderPdf(SHORT, configFromPreset("github"), {
        now: FIXED_NOW,
      });
      expect(result.tocEntriesNumbered).toBe(0);
    },
    TIMEOUT,
  );

  it(
    "can bypass Paged.js and use Chromium's own pagination",
    async () => {
      const result = await renderPdf(SHORT, configFromPreset("github"), {
        now: FIXED_NOW,
        nativePagination: true,
      });
      expect(isPdf(result.pdf)).toBe(true);
      expect(result.paginatedBy).toBe("chromium");
    },
    TIMEOUT,
  );

  it(
    "still returns a PDF through the fallback path",
    async () => {
      const result = await renderPdfWithFallback(
        SHORT,
        configFromPreset("github"),
        { now: FIXED_NOW },
      );
      expect(isPdf(result.pdf)).toBe(true);
      expect(result.fallbackReason).toBeUndefined();
    },
    TIMEOUT,
  );
});
