import { describe, expect, it } from "vitest";

import { configFromPreset, PRESET_IDS } from "@/lib/config/presets";
import { CHATBOT_SAMPLE } from "@/lib/fonts/chatbot-sample";
import {
  EMOJI_FONT,
  findMissingCharacters,
  fontChain,
  fontFaceCss,
  FONTS,
  selectFaces,
  SELECTABLE_FONTS,
} from "@/lib/fonts";
import { inlineAssetOrKeep } from "@/lib/pdf/assets";
import { renderDocument } from "@/lib/renderer/document";

describe("fontChain", () => {
  it("puts scripts, then symbols, then emoji behind every selectable face", () => {
    for (const font of SELECTABLE_FONTS) {
      const roles = fontChain(font.id).map((id) => FONTS[id].role);
      expect(roles[0]).toBe("face");
      expect(roles.at(-1)).toBe("emoji");

      const firstSymbol = roles.indexOf("symbol");
      const lastScript = roles.lastIndexOf("script");
      expect(lastScript).toBeLessThan(firstSymbol);
    }
  });

  it("gives code a monospace symbol font first, so file trees stay aligned", () => {
    const chain = fontChain("jetbrains-mono");
    const symbols = chain.filter((id) => FONTS[id].role === "symbol");
    expect(symbols[0]).toBe("dejavu-sans-mono");
  });

  it("matches Devanagari to the document's style", () => {
    expect(fontChain("source-serif-4")).toContain("noto-serif-devanagari");
    expect(fontChain("inter")).toContain("noto-sans-devanagari");
  });
});

describe("coverage", () => {
  it.each(SELECTABLE_FONTS.map((font) => font.id))(
    "%s draws every character chatbots use",
    (id) => {
      expect(findMissingCharacters([id], CHATBOT_SAMPLE)).toEqual([]);
    },
  );

  it("reports what nothing can draw", () => {
    expect(findMissingCharacters(["inter"], "你好 → ")).toEqual([
      "你",
      "好",
      "",
    ]);
  });

  it("does not count invisible characters as missing", () => {
    expect(findMissingCharacters(["inter"], "a​b﻿­c\n\t‍")).toEqual([]);
  });
});

describe("selectFaces", () => {
  it("needs only the face's own Latin file for plain Latin text", () => {
    const { faces } = selectFaces(["inter"], "Hello, world.");
    expect([...faces.keys()]).toEqual(["inter"]);
    expect([...(faces.get("inter") ?? [])].every((face) => face.subset === "latin")).toBe(
      true,
    );
  });

  it("pulls in one emoji file for one emoji", () => {
    const { faces } = selectFaces(["inter"], "Done ✅");
    expect(faces.get(EMOJI_FONT)?.size).toBe(1);
  });

  it("draws a whole ZWJ sequence from the single file that holds every part", () => {
    const { faces } = selectFaces(["inter"], "👩🏾‍🔬");
    const chosen = [...(faces.get(EMOJI_FONT) ?? [])];
    expect(chosen).toHaveLength(1);
    // Nothing else is needed: the parts are not drawn on their own.
    expect([...faces.keys()]).toEqual([EMOJI_FONT]);
  });

  it("draws box drawing in code from the monospace fallback", () => {
    const { faces } = selectFaces(["jetbrains-mono"], "├── src");
    expect(faces.has("dejavu-sans-mono")).toBe(true);
    expect(faces.has("dejavu-sans")).toBe(false);
  });

  it("draws an arrow in prose from Noto Sans Math", () => {
    const { faces } = selectFaces(["source-serif-4"], "a → b");
    expect(faces.has("noto-sans-math")).toBe(true);
  });

  it("never lets a text symbol font claim a default-emoji character", () => {
    const { faces } = selectFaces(["inter"], "⭐ ⚡ ☕");
    for (const id of faces.keys()) expect(FONTS[id].role).not.toBe("symbol");
  });
});

describe("fontFaceCss", () => {
  it("emits only the files the text needs", () => {
    const css = fontFaceCss(["inter"], undefined, "Hello");
    expect(css).toContain("font-family: Inter;");
    expect(css).not.toContain("Noto Color Emoji");
    expect(css).not.toContain("DejaVu");
  });

  it("emits the whole chain when no text is given", () => {
    const css = fontFaceCss(["inter"]);
    expect(css).toContain('font-family: "Noto Color Emoji";');
    expect(css).toContain('font-family: "DejaVu Sans";');
    expect(css).toContain('font-family: "Noto Sans Gujarati";');
  });
});

describe("renderDocument", () => {
  it.each(PRESET_IDS)("%s reports nothing missing for chatbot output", (id) => {
    const doc = renderDocument(CHATBOT_SAMPLE, configFromPreset(id));
    expect(doc.missingCharacters).toEqual([]);
  });

  it("reports characters no shipped font can draw", () => {
    const doc = renderDocument("# 你好", configFromPreset("github"));
    expect(doc.missingCharacters).toEqual(["你", "好"]);
  });

  it("inlines only the font files a document needs into the PDF input", () => {
    const options = { resolveUrl: inlineAssetOrKeep };
    const plain = renderDocument("# Notes\n\nPlain text.", configFromPreset("github"), options);
    const rich = renderDocument(CHATBOT_SAMPLE, configFromPreset("github"), options);

    const fallbacks = Object.values(FONTS).filter((font) => font.role !== "face");
    for (const font of fallbacks) {
      expect(plain.css).not.toContain(`font-family: "${font.family}";`);
    }
    expect(rich.css).toContain('font-family: "Noto Color Emoji";');
    expect(rich.css).toContain("data:font/woff2;base64,");
  });
});
