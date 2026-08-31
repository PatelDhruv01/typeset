import { describe, expect, it } from "vitest";

import { documentConfigSchema } from "@/lib/config/schema";
import type { PartialDocumentConfig } from "@/lib/config/schema";
import { renderDocument, toSafeFileName } from "@/lib/renderer/document";

const FIXED_NOW = new Date("2026-03-01T00:00:00Z");

function render(source: string, overrides: PartialDocumentConfig = {}, sourceName?: string) {
  return renderDocument(source, documentConfigSchema.parse(overrides), {
    now: FIXED_NOW,
    sourceName,
    includeKatex: false,
  });
}

describe("toSafeFileName", () => {
  it("keeps ordinary names intact, hyphens included", () => {
    expect(toSafeFileName("q3-review")).toBe("q3-review");
    expect(toSafeFileName("Groundwater Report 2026")).toBe(
      "Groundwater Report 2026",
    );
  });

  it("strips characters that are illegal on some filesystem", () => {
    expect(toSafeFileName('a/b\\c:d*e?f"g<h>i|j')).toBe("a b c d e f g h i j");
  });

  it("strips accents rather than emitting non-ASCII filenames", () => {
    expect(toSafeFileName("Résumé Français")).toBe("Resume Francais");
  });

  it("refuses Windows reserved device names", () => {
    // Creating "CON.pdf" on Windows fails in ways that are hard to explain.
    expect(toSafeFileName("CON")).toBe("document");
    expect(toSafeFileName("lpt1")).toBe("document");
  });

  it("trims trailing dots and spaces, which Windows silently drops", () => {
    expect(toSafeFileName("report...")).toBe("report");
    expect(toSafeFileName("report   ")).toBe("report");
  });

  it("falls back when nothing usable is left", () => {
    expect(toSafeFileName("///")).toBe("document");
    expect(toSafeFileName("")).toBe("document");
  });

  it("caps the length", () => {
    expect(toSafeFileName("x".repeat(300)).length).toBeLessThanOrEqual(120);
  });
});

describe("renderDocument", () => {
  it("produces a complete, self-contained HTML document", () => {
    const result = render("# Hello\n\nWorld.");
    expect(result.html.startsWith("<!doctype html>")).toBe(true);
    expect(result.html).toContain("<style>");
    // Self-contained matters: Chromium renders this detached, with no origin
    // to resolve a stylesheet link against.
    expect(result.html).not.toContain('<link rel="stylesheet"');
  });

  describe("filename derivation", () => {
    // The entire reason this project exists: never make the user rename a file.
    it("prefers an explicit output filename", () => {
      expect(
        render("# Doc Heading", { output: { fileName: "chosen-name" } }).fileName,
      ).toBe("chosen-name");
    });

    it("then front matter title", () => {
      expect(render("---\ntitle: From Front Matter\n---\n\n# Heading").fileName).toBe(
        "From Front Matter",
      );
    });

    it("then the first h1", () => {
      expect(render("# From The Heading\n\ntext").fileName).toBe(
        "From The Heading",
      );
    });

    it("then the uploaded filename, extension removed", () => {
      expect(render("just text", {}, "my-notes.md").fileName).toBe("my-notes");
    });

    it("and falls back to 'document' with nothing to go on", () => {
      expect(render("just text").fileName).toBe("document");
    });
  });

  describe("title derivation", () => {
    it("prefers configured metadata over the document", () => {
      expect(
        render("# Heading", { output: { metadata: { title: "Configured" } } })
          .title,
      ).toBe("Configured");
    });

    it("uses front matter over the first heading", () => {
      expect(render("---\ntitle: Front\n---\n\n# Heading").title).toBe("Front");
    });

    it("escapes the title in the <title> tag", () => {
      // A title from config or front matter never passes through the HTML
      // sanitiser, so this is the path where escaping actually matters.
      const result = render("# Heading", {
        output: { metadata: { title: 'Tom & Jerry <b>"quoted"</b>' } },
      });
      expect(result.html).toContain(
        "<title>Tom &amp; Jerry &lt;b&gt;&quot;quoted&quot;&lt;/b&gt;</title>",
      );
      expect(result.html).not.toContain("<title>Tom & Jerry <b>");
    });
  });

  describe("KaTeX inclusion", () => {
    it("reports maths presence so the stylesheet can be skipped", () => {
      expect(render("no maths here").hasMath).toBe(false);
      expect(render("$E = mc^2$").hasMath).toBe(true);
    });

    it("omits the 23 KB stylesheet from a document with no maths", () => {
      const plain = renderDocument(
        "# Plain\n\nNo maths.",
        documentConfigSchema.parse({}),
        { now: FIXED_NOW },
      );
      expect(plain.css).not.toContain(".katex");

      const mathy = renderDocument(
        "# Maths\n\n$E = mc^2$",
        documentConfigSchema.parse({}),
        { now: FIXED_NOW },
      );
      expect(mathy.css).toContain(".katex");
    });
  });

  it("passes metadata through to meta tags", () => {
    const result = render("# Doc", {
      output: {
        metadata: {
          author: "A. Nother",
          subject: "Water policy",
          keywords: ["groundwater", "policy"],
        },
      },
    });
    expect(result.html).toContain('<meta name="author" content="A. Nother">');
    expect(result.html).toContain('content="Water policy"');
    expect(result.html).toContain('content="groundwater, policy"');
  });

  it("uses a fixed date only when nothing supplies one", () => {
    const fromConfig = render("# Doc", { cover: { date: "Michaelmas 2026" } });
    expect(fromConfig.css).not.toContain("March");

    const withHeader = renderDocument(
      "# Doc",
      documentConfigSchema.parse({ header: { enabled: true, left: "{date}" } }),
      { now: FIXED_NOW, includeKatex: false },
    );
    expect(withHeader.css).toContain("1 March 2026");
  });

  it("is deterministic given a fixed clock", () => {
    const a = render("# Same\n\nInput.");
    const b = render("# Same\n\nInput.");
    expect(a.html).toBe(b.html);
  });
});
