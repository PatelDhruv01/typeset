import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "@/lib/config/schema";
import type { MarkdownConfig, StructureConfig } from "@/lib/config/schema";
import { renderMarkdown } from "@/lib/renderer/markdown";

function render(
  source: string,
  overrides: {
    markdown?: Partial<MarkdownConfig>;
    structure?: Partial<StructureConfig>;
  } = {},
) {
  return renderMarkdown(source, {
    markdown: { ...DEFAULT_CONFIG.markdown, ...overrides.markdown },
    structure: { ...DEFAULT_CONFIG.structure, ...overrides.structure },
  });
}

describe("renderMarkdown", () => {
  describe("GitHub Flavored Markdown", () => {
    it("renders tables with a real thead", () => {
      const { html } = render("| a | b |\n|---|---|\n| 1 | 2 |");
      expect(html).toContain("<table>");
      expect(html).toContain("<thead>");
      expect(html).toContain("<th>a</th>");
    });

    it("renders task lists and strikethrough", () => {
      const { html } = render("- [x] done\n- [ ] todo\n\n~~gone~~");
      expect(html).toContain('type="checkbox"');
      expect(html).toContain("<del>gone</del>");
    });

    it("renders footnotes", () => {
      const { html } = render("Claim.[^1]\n\n[^1]: Evidence.");
      expect(html).toContain("footnote");
      expect(html).toContain("Evidence.");
    });
  });

  describe("line breaks", () => {
    const wrapped = "A hard-wrapped paragraph\nthat continues on this line.";

    it("reflows hard-wrapped paragraphs by default", () => {
      // The legacy script set marked's `breaks: true`, which turned every
      // wrapped line into its own line in the PDF.
      expect(render(wrapped).html).not.toContain("<br>");
    });

    it("honours softBreaks when explicitly enabled", () => {
      expect(render(wrapped, { markdown: { softBreaks: true } }).html).toContain(
        "<br>",
      );
    });
  });

  describe("front matter", () => {
    const source = "---\ntitle: Quarterly Review\nauthor: A. Nother\n---\n\n# Body heading\n";

    it("parses it into metadata and keeps it out of the body", () => {
      const result = render(source);
      expect(result.frontMatter).toEqual({
        title: "Quarterly Review",
        author: "A. Nother",
      });
      expect(result.html).not.toContain("Quarterly Review");
      expect(result.title).toBe("Quarterly Review");
    });

    it("falls back to the first h1 when there is no front matter title", () => {
      expect(render("# Just A Heading\n\ntext").title).toBe("Just A Heading");
    });

    it("drops it entirely in ignore mode", () => {
      const result = render(source, { markdown: { frontMatter: "ignore" } });
      expect(result.frontMatter).toEqual({});
      expect(result.html).not.toContain("Quarterly Review");
      // Crucially it must not leak as a stray <hr> or setext heading either.
      expect(result.html).not.toContain("<hr>");
    });

    it("shows it as a code block in render mode", () => {
      const result = render(source, { markdown: { frontMatter: "render" } });
      // Syntax highlighting wraps each token, so assert on the code block and
      // the words rather than on a contiguous "Quarterly Review".
      expect(result.html).toContain('<code class="hljs language-yaml"');
      expect(result.html).toContain("Quarterly");
      expect(result.html).toContain("Nother");
    });

    it("survives malformed YAML without failing the render", () => {
      const result = render("---\n:\n  - [unclosed\n---\n\n# Still here\n");
      expect(result.html).toContain("Still here");
    });
  });

  describe("callouts", () => {
    it("converts GitHub alert blockquotes", () => {
      const { html } = render("> [!WARNING]\n> This overwrites the file.");
      expect(html).toContain('class="callout callout-warning"');
      expect(html).toContain('<div class="callout-title">Warning</div>');
      expect(html).toContain("This overwrites the file.");
      expect(html).not.toContain("[!WARNING]");
    });

    it("converts ::: container directives, with a custom title", () => {
      const { html } = render("::: tip Read this first\nBody text.\n:::");
      expect(html).toContain('class="callout callout-tip"');
      expect(html).toContain(
        '<div class="callout-title">Read this first</div>',
      );
      expect(html).toContain("Body text.");
    });

    it("leaves an ordinary blockquote alone", () => {
      const { html } = render("> Just a quotation.");
      expect(html).toContain("<blockquote>");
      expect(html).not.toContain("callout");
    });

    it("leaves an unrecognised alert kind as a blockquote", () => {
      const { html } = render("> [!NONSENSE]\n> text");
      expect(html).toContain("<blockquote>");
      expect(html).not.toContain("callout");
    });
  });

  describe("page breaks", () => {
    it("turns a pagebreak comment into a break element", () => {
      const { html } = render("before\n\n<!-- pagebreak -->\n\nafter");
      expect(html).toContain('class="page-break"');
    });

    it("ignores unrelated HTML comments", () => {
      const { html } = render("before\n\n<!-- just a note -->\n\nafter");
      expect(html).not.toContain("page-break");
    });
  });

  describe("headings", () => {
    const doc = "# One\n\n## One A\n\n### Deep\n\n## One B\n\n# Two\n";

    it("extracts every heading with depth and anchor id", () => {
      const { headings } = render(doc);
      expect(headings.map((h) => [h.depth, h.text])).toEqual([
        [1, "One"],
        [2, "One A"],
        [3, "Deep"],
        [2, "One B"],
        [1, "Two"],
      ]);
      expect(headings[0]?.id).toBe("one");
    });

    it("does not number headings by default", () => {
      expect(render(doc).headings.every((h) => h.number === null)).toBe(true);
    });

    it("numbers hierarchically, resetting deeper counters", () => {
      const { headings, html } = render(doc, {
        structure: { numberHeadings: true },
      });
      expect(headings.map((h) => h.number)).toEqual([
        "1",
        "1.1",
        "1.1.1",
        "1.2",
        "2",
      ]);
      expect(html).toContain('class="heading-number"');
    });

    it("respects numberFrom, for documents whose h1 is the title", () => {
      const { headings } = render(doc, {
        structure: { numberHeadings: true, numberFrom: 2 },
      });
      expect(headings.map((h) => h.number)).toEqual([
        null,
        "1",
        "1.1",
        "2",
        null,
      ]);
    });

    it("stops numbering past numberDepth", () => {
      const { headings } = render(doc, {
        structure: { numberHeadings: true, numberDepth: 2 },
      });
      expect(headings.map((h) => h.number)).toEqual(["1", "1.1", null, "1.2", "2"]);
    });
  });

  describe("code", () => {
    it("highlights a fenced block with a declared language", () => {
      const { html } = render('```js\nconst x = 1;\n```');
      expect(html).toContain("hljs");
      expect(html).toContain("language-js");
    });

    it("leaves mermaid blocks unhighlighted for the diagram renderer", () => {
      const { html } = render("```mermaid\ngraph TD;\nA-->B;\n```");
      expect(html).toContain("language-mermaid");
      expect(html).not.toContain("hljs-keyword");
    });
  });

  describe("maths", () => {
    it("renders inline and display maths with KaTeX", () => {
      const { html } = render("Inline $E = mc^2$ and\n\n$$\\int_0^1 x\\,dx$$");
      expect(html).toContain("katex");
      expect(html).not.toContain("$E = mc^2$");
    });

    it("leaves the source alone when maths is off", () => {
      const { html } = render("$E = mc^2$", { markdown: { math: false } });
      expect(html).toContain("$E = mc^2$");
      expect(html).not.toContain("katex");
    });
  });

  describe("security", () => {
    it("strips script tags in the default sanitise mode", () => {
      const { html } = render('text <script>alert(1)</script> more');
      expect(html).not.toContain("<script");
      expect(html).not.toContain("alert(1)");
    });

    it("strips event handler attributes", () => {
      const { html } = render('<div onclick="steal()">click</div>');
      expect(html).not.toContain("onclick");
      expect(html).toContain("click");
    });

    it("strips javascript: URLs", () => {
      const { html } = render("[go](javascript:alert(1))");
      expect(html).not.toContain("javascript:");
    });

    it("strips iframes", () => {
      const { html } = render('<iframe src="https://evil.example"></iframe>');
      expect(html).not.toContain("<iframe");
    });

    it("keeps class attributes, which maths and highlighting depend on", () => {
      const { html } = render('<span class="keep-me">x</span>');
      expect(html).toContain("keep-me");
    });

    it("removes all HTML in strip mode", () => {
      const { html } = render("<b>bold</b> text", {
        markdown: { rawHtml: "strip" },
      });
      expect(html).not.toContain("<b>");
      expect(html).toContain("text");
    });
  });

  describe("typography", () => {
    it("converts straight quotes and dashes by default", () => {
      const { html } = render('He said "hello" -- and left...');
      expect(html).toContain("\u201chello\u201d");
      expect(html).toContain("\u2014");
    });

    it("leaves them alone when smart typography is off", () => {
      const { html } = render('"hello"', {
        markdown: { smartTypography: false },
      });
      expect(html).toContain('"hello"');
    });

    it("expands emoji shortcodes", () => {
      expect(render("ship it :rocket:").html).toContain("\u{1F680}");
    });
  });

  it("counts words for the status bar", () => {
    expect(render("# Title\n\nOne two three four.").wordCount).toBe(5);
  });
});
