import { describe, expect, it } from "vitest";

import { mergeConfig } from "@/lib/config/merge";
import { PRESETS } from "@/lib/config/presets";
import { documentConfigSchema } from "@/lib/config/schema";

describe("mergeConfig", () => {
  it("merges nested branches instead of replacing them", () => {
    // The bug this exists to prevent: a spread would drop the other three
    // margins the moment a caller set one.
    const merged = mergeConfig(
      { page: { margins: { top: 25, right: 20, bottom: 25, left: 20 } } },
      { page: { margins: { top: 40 } } },
    );

    expect(merged.page?.margins).toEqual({
      top: 40,
      right: 20,
      bottom: 25,
      left: 20,
    });
  });

  it("keeps sibling branches untouched", () => {
    const merged = mergeConfig(
      { page: { size: "letter" }, typography: { bodyFont: "lora" } },
      { typography: { baseFontSize: 12 } },
    );

    expect(merged.page?.size).toBe("letter");
    expect(merged.typography).toEqual({ bodyFont: "lora", baseFontSize: 12 });
  });

  it("replaces arrays wholesale rather than merging element-wise", () => {
    const merged = mergeConfig(
      { output: { metadata: { keywords: ["a", "b", "c"] } } },
      { output: { metadata: { keywords: ["x"] } } },
    );

    expect(merged.output?.metadata?.keywords).toEqual(["x"]);
  });

  it("treats null as a value, not an absence", () => {
    // `measure: null` means "use the full column width" and has to be able to
    // override a number.
    const merged = mergeConfig(
      { typography: { measure: 120 } },
      { typography: { measure: null } },
    );

    expect(merged.typography?.measure).toBeNull();
  });

  it("ignores undefined, so an unset field does not erase a preset value", () => {
    const merged = mergeConfig(
      { typography: { bodyFont: "lora" } },
      { typography: { bodyFont: undefined } },
    );

    expect(merged.typography?.bodyFont).toBe("lora");
  });

  it("applies patches left to right", () => {
    const merged = mergeConfig(
      { page: { size: "a4" } },
      { page: { size: "letter" } },
      { page: { size: "a5" } },
    );

    expect(merged.page?.size).toBe("a5");
  });

  it("does not mutate its inputs", () => {
    const base = { page: { margins: { top: 25 } } };
    mergeConfig(base, { page: { margins: { top: 40 } } });
    expect(base.page.margins.top).toBe(25);
  });

  it("refuses prototype-polluting keys", () => {
    // This merges request bodies, so a `__proto__` key must not reach
    // Object.prototype.
    const merged = mergeConfig(
      {},
      JSON.parse('{"__proto__": {"polluted": true}}'),
    );

    expect(merged).toBeDefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty("polluted");
  });

  it("produces a valid config when a preset is overridden", () => {
    // The exact path /api/render takes: preset first, caller's config on top.
    const merged = mergeConfig(PRESETS.report.config, {
      page: { margins: { left: 45 } },
      typography: { baseFontSize: 12 },
    });

    const config = documentConfigSchema.parse(merged);

    expect(config.page.margins.left).toBe(45);
    // ...and the rest of Report survives.
    expect(config.page.margins.right).toBe(22);
    expect(config.typography.bodyFont).toBe("source-serif-4");
    expect(config.typography.baseFontSize).toBe(12);
    expect(config.cover.enabled).toBe(true);
  });
});
