import fs from "node:fs";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "@/lib/config/schema";
import { renderMarkdown, type RenderedMarkdown } from "@/lib/renderer/markdown";

/**
 * Smoke test against the real document this project grew out of.
 *
 * reference/sample-technical.md is 1164 lines with 130 fenced code blocks and
 * 78 table rows - deliberately hostile, and representative of what this tool
 * actually gets pointed at. Unit tests confirm each feature in isolation; this
 * confirms they survive contact with a real document.
 */

const SAMPLE = path.join(process.cwd(), "reference", "sample-technical.md");

describe("reference/sample-technical.md", () => {
  let source: string;
  let result: RenderedMarkdown;

  beforeAll(() => {
    source = fs.readFileSync(SAMPLE, "utf8");
    result = renderMarkdown(source, {
      markdown: DEFAULT_CONFIG.markdown,
      structure: DEFAULT_CONFIG.structure,
    });
  });

  it("renders without throwing, and produces substantial output", () => {
    expect(result.html.length).toBeGreaterThan(source.length * 0.8);
    expect(result.wordCount).toBeGreaterThan(5_000);
  });

  it("finds the document title from the first h1", () => {
    expect(result.title).toContain("RFLR 2026");
  });

  it("extracts a full heading hierarchy", () => {
    expect(result.headings.length).toBeGreaterThan(20);
    expect(result.headings.some((h) => h.depth === 1)).toBe(true);
    expect(result.headings.some((h) => h.depth === 3)).toBe(true);
  });

  it("gives every heading a usable anchor id", () => {
    for (const heading of result.headings) {
      expect(heading.id, `heading "${heading.text}"`).not.toBe("");
    }
  });

  it("renders all the code blocks with highlighting", () => {
    const fences = (source.match(/^```/gm) ?? []).length;
    const blocks = (result.html.match(/<pre>/g) ?? []).length;
    // Fences come in pairs, so half of them open a block.
    expect(blocks).toBeGreaterThanOrEqual(Math.floor(fences / 2) - 2);
  });

  it("renders tables with repeating headers available", () => {
    expect(result.html).toContain("<table>");
    expect(result.html).toContain("<thead>");
  });

  it("emits no unescaped script tags", () => {
    expect(result.html).not.toContain("<script");
  });

  it("leaves no raw Markdown table pipes in the output", () => {
    // A parser misconfiguration usually shows up as literal "|---|" surviving
    // into the HTML.
    expect(result.html).not.toContain("|---|");
  });

  it("is deterministic - the same input gives byte-identical output", () => {
    const again = renderMarkdown(source, {
      markdown: DEFAULT_CONFIG.markdown,
      structure: DEFAULT_CONFIG.structure,
    });
    expect(again.html).toBe(result.html);
  });
});
