import { describe, expect, it } from "vitest";

import { deriveTitle, firstHeading, firstLine, truncateWords } from "@/lib/text/title";

describe("deriveTitle", () => {
  it("prefers front matter, then any heading, then the first line", () => {
    expect(deriveTitle("---\ntitle: From front matter\n---\n\n# Heading")).toBe(
      "From front matter",
    );
    expect(deriveTitle("Intro line\n\n## Second-level heading")).toBe("Second-level heading");
    expect(deriveTitle("**Short answer:** yes, it works.")).toBe("Short answer: yes, it works.");
  });

  it("skips code, tables and rules when looking for a first line", () => {
    expect(deriveTitle("```js\nconst a = 1;\n```\n\n| a | b |\n|---|---|\n\n---\n\nThe real text")).toBe(
      "The real text",
    );
  });

  it("ignores headings inside code fences", () => {
    expect(firstHeading("```md\n# not a title\n```\n\n## Real")).toBe("Real");
  });

  it("calls an empty document Untitled", () => {
    expect(deriveTitle("")).toBe("Untitled");
    expect(deriveTitle("```\nonly code\n```")).toBe("Untitled");
  });

  it("drops list and quote markers from a first line", () => {
    expect(firstLine("- [x] Ship the release")).toBe("Ship the release");
    expect(firstLine("> Quoted opening")).toBe("Quoted opening");
  });
});

describe("truncateWords", () => {
  it("cuts at a word boundary, with an ellipsis only when asked", () => {
    const text = "The quick brown fox jumps over the lazy dog";
    expect(truncateWords(text, 20)).toBe("The quick brown fox");
    expect(truncateWords(text, 20, true)).toBe("The quick brown fox…");
    expect(truncateWords("short", 20)).toBe("short");
  });
});
