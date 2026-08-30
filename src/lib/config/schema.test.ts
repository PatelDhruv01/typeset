import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONFIG,
  documentConfigSchema,
  type DocumentConfig,
} from "@/lib/config/schema";

describe("documentConfigSchema", () => {
  it("fills every nested branch from an empty object", () => {
    const config = documentConfigSchema.parse({});

    // The point of this test is the `.prefault({})` choice in schema.ts.
    // `.default({})` would leave these branches as literal `{}`, and the bug
    // would only surface as a missing font or a zero margin much later.
    expect(config.page.margins).toEqual({
      top: 25,
      right: 20,
      bottom: 25,
      left: 20,
    });
    expect(config.typography.bodyFont).toBe("inter");
    expect(config.output.metadata.keywords).toEqual([]);
    expect(config.footer.right).toBe("{page} / {pages}");
  });

  it("has no undefined anywhere, so it round-trips through JSON", () => {
    const roundTripped: DocumentConfig = JSON.parse(
      JSON.stringify(DEFAULT_CONFIG),
    );
    expect(roundTripped).toEqual(DEFAULT_CONFIG);
  });

  it("merges a partial override without dropping sibling defaults", () => {
    const config = documentConfigSchema.parse({
      page: { size: "letter" },
      typography: { baseFontSize: 12 },
    });

    expect(config.page.size).toBe("letter");
    expect(config.page.margins.top).toBe(25);
    expect(config.typography.baseFontSize).toBe(12);
    expect(config.typography.lineHeight).toBe(1.6);
  });

  it("keeps softBreaks off, unlike the legacy script", () => {
    // marked was configured with `breaks: true`, which turns hard-wrapped
    // paragraphs into ragged single lines. Regression guard.
    expect(DEFAULT_CONFIG.markdown.softBreaks).toBe(false);
  });

  it("defaults raw HTML to sanitising", () => {
    // Input can arrive from an uploaded file or an API caller and is rendered
    // in a browser context. Anything but "sanitise" here is a security bug.
    expect(DEFAULT_CONFIG.markdown.rawHtml).toBe("sanitise");
  });

  describe("validation", () => {
    it("rejects a colour that is not a 6-digit hex", () => {
      expect(() =>
        documentConfigSchema.parse({ theme: { text: "red" } }),
      ).toThrow();
      expect(() =>
        documentConfigSchema.parse({ theme: { text: "#fff" } }),
      ).toThrow();
      expect(
        documentConfigSchema.parse({ theme: { text: "#FF0000" } }).theme.text,
      ).toBe("#FF0000");
    });

    it("rejects an unknown font id", () => {
      expect(() =>
        documentConfigSchema.parse({ typography: { bodyFont: "comic-sans" } }),
      ).toThrow();
    });

    it("rejects out-of-range geometry rather than clamping silently", () => {
      expect(() =>
        documentConfigSchema.parse({ page: { margins: { top: -5 } } }),
      ).toThrow();
      expect(() =>
        documentConfigSchema.parse({ page: { scale: 12 } }),
      ).toThrow();
    });

    it("accepts headingFont: inherit as well as a real font", () => {
      expect(
        documentConfigSchema.parse({ typography: { headingFont: "inherit" } })
          .typography.headingFont,
      ).toBe("inherit");
      expect(
        documentConfigSchema.parse({
          typography: { headingFont: "eb-garamond" },
        }).typography.headingFont,
      ).toBe("eb-garamond");
    });
  });
});
