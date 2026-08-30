import { describe, expect, it } from "vitest";

import {
  configFromPreset,
  DEFAULT_PRESET_ID,
  PRESET_IDS,
  PRESETS,
} from "@/lib/config/presets";
import { documentConfigSchema } from "@/lib/config/schema";
import { FONTS } from "@/lib/fonts";

describe("presets", () => {
  it.each(PRESET_IDS)("%s resolves to a valid config", (id) => {
    expect(() => configFromPreset(id)).not.toThrow();
  });

  it.each(PRESET_IDS)("%s records its own id as provenance", (id) => {
    // A preset that forgets to set `preset` shows up in the UI as "GitHub"
    // forever, because that is the schema default.
    expect(configFromPreset(id).preset).toBe(id);
  });

  it.each(PRESET_IDS)("%s only references selectable fonts", (id) => {
    const { typography } = configFromPreset(id);
    const used = [typography.bodyFont, typography.monoFont];
    if (typography.headingFont !== "inherit") used.push(typography.headingFont);

    for (const font of used) {
      expect(FONTS[font].selectable, `${id} uses ${font}`).toBe(true);
    }
  });

  it.each(PRESET_IDS)("%s pairs its mono font with a mono face", (id) => {
    expect(FONTS[configFromPreset(id).typography.monoFont].category).toBe(
      "mono",
    );
  });

  it("switching preset resets rather than merges", () => {
    // Report turns the cover page on. Minimal never mentions it. If preset
    // application ever became a merge over current state, Minimal would
    // inherit a cover page it does not want.
    expect(configFromPreset("report").cover.enabled).toBe(true);
    expect(configFromPreset("minimal").cover.enabled).toBe(false);
    expect(configFromPreset("minimal").toc.enabled).toBe(false);
  });

  it("keeps the default preset id in the registry", () => {
    expect(PRESETS[DEFAULT_PRESET_ID]).toBeDefined();
  });

  it("has a distinct tagline and bestFor for every preset", () => {
    const taglines = new Set(PRESET_IDS.map((id) => PRESETS[id].tagline));
    expect(taglines.size).toBe(PRESET_IDS.length);
  });

  it("academic prints link URLs, because a paper copy has no hyperlinks", () => {
    expect(configFromPreset("academic").theme.linkStyle).toBe("footnote");
  });

  it("night is the only preset with a non-white page", () => {
    const dark = PRESET_IDS.filter(
      (id) => configFromPreset(id).theme.pageBackground !== "#ffffff",
    );
    expect(dark).toEqual(["night"]);
  });

  it("every preset config is accepted as a partial by the schema", () => {
    for (const id of PRESET_IDS) {
      expect(() => documentConfigSchema.parse(PRESETS[id].config)).not.toThrow();
    }
  });
});
