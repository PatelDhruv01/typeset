import manifest from "./font-files.generated.json";

/**
 * The font registry.
 *
 * `font-files.generated.json` is produced by scripts/sync-fonts.mjs and knows
 * about files, weights and unicode ranges. This module adds the things a human
 * needs: a display name, a one-line description for the picker, and a fallback
 * stack for when a glyph is missing.
 */

export type FontCategory = "sans" | "serif" | "mono";

export type FontId = keyof typeof FONT_METADATA;

type FontMeta = {
  category: FontCategory;
  /** Shown under the font name in the picker. Say what it is *for*. */
  description: string;
  /** Appended after the webfont, for glyphs it does not carry. */
  fallbacks: readonly string[];
  /** Hidden from the picker - loaded automatically as a script fallback. */
  selectable?: false;
};

const SANS_FALLBACK = ["ui-sans-serif", "system-ui", "sans-serif"] as const;
const SERIF_FALLBACK = ["Georgia", "ui-serif", "serif"] as const;
const MONO_FALLBACK = [
  "ui-monospace",
  "SFMono-Regular",
  "Menlo",
  "monospace",
] as const;

const FONT_METADATA = {
  // --- sans ---
  inter: {
    category: "sans",
    description: "Neutral and highly legible at small sizes. A safe default.",
    fallbacks: SANS_FALLBACK,
  },
  "ibm-plex-sans": {
    category: "sans",
    description: "Engineered and slightly technical. Pairs with IBM Plex Mono.",
    fallbacks: SANS_FALLBACK,
  },
  "source-sans-3": {
    category: "sans",
    description: "Calm and open. Holds up well across long stretches of text.",
    fallbacks: SANS_FALLBACK,
  },
  figtree: {
    category: "sans",
    description: "Rounded and friendly. Good for lighter, less formal documents.",
    fallbacks: SANS_FALLBACK,
  },
  "noto-sans": {
    category: "sans",
    description: "Widest script coverage. Use for multilingual documents.",
    fallbacks: SANS_FALLBACK,
  },

  // --- serif ---
  "source-serif-4": {
    category: "serif",
    description: "Sturdy on screen and in print. The best all-round serif here.",
    fallbacks: SERIF_FALLBACK,
  },
  literata: {
    category: "serif",
    description: "Designed for e-readers. Comfortable over many pages.",
    fallbacks: SERIF_FALLBACK,
  },
  lora: {
    category: "serif",
    description: "Contemporary with brushed contrast. Warm without being soft.",
    fallbacks: SERIF_FALLBACK,
  },
  merriweather: {
    category: "serif",
    description: "Large x-height, very dark on the page. Survives poor printing.",
    fallbacks: SERIF_FALLBACK,
  },
  newsreader: {
    category: "serif",
    description: "Editorial and slightly journalistic. Strong italics.",
    fallbacks: SERIF_FALLBACK,
  },
  "crimson-pro": {
    category: "serif",
    description: "Old-style book face. Elegant, best at generous sizes.",
    fallbacks: SERIF_FALLBACK,
  },
  "eb-garamond": {
    category: "serif",
    description: "Classical Garamond revival. The academic default.",
    fallbacks: SERIF_FALLBACK,
  },
  "noto-serif": {
    category: "serif",
    description: "Serif counterpart to Noto Sans. For multilingual documents.",
    fallbacks: SERIF_FALLBACK,
  },

  // --- mono ---
  "jetbrains-mono": {
    category: "mono",
    description: "Tall lowercase, designed for reading code. Great default.",
    fallbacks: MONO_FALLBACK,
  },
  "fira-code": {
    category: "mono",
    description: "Even colour and clear punctuation. Ligature-capable.",
    fallbacks: MONO_FALLBACK,
  },
  "source-code-pro": {
    category: "mono",
    description: "Narrow, so more code fits per line before wrapping.",
    fallbacks: MONO_FALLBACK,
  },
  "ibm-plex-mono": {
    category: "mono",
    description: "Typewriter-adjacent. Distinctive without being noisy.",
    fallbacks: MONO_FALLBACK,
  },

  // --- script fallbacks: never shown in the picker, appended automatically ---
  "noto-sans-devanagari": {
    category: "sans",
    description: "Devanagari fallback.",
    fallbacks: [],
    selectable: false,
  },
  "noto-serif-devanagari": {
    category: "serif",
    description: "Devanagari fallback.",
    fallbacks: [],
    selectable: false,
  },
} as const satisfies Record<string, FontMeta>;

export type FontFace = {
  url: string;
  style: string;
  weight: string;
  unicodeRange: string;
};

export type FontDefinition = {
  id: FontId;
  /** CSS family name, e.g. "Source Serif 4". */
  family: string;
  category: FontCategory;
  description: string;
  fallbacks: readonly string[];
  selectable: boolean;
  faces: readonly FontFace[];
  license: string;
  attribution: string;
};

function buildRegistry(): Record<FontId, FontDefinition> {
  const out = {} as Record<FontId, FontDefinition>;
  const files = manifest.fonts as Record<string, unknown>;

  for (const id of Object.keys(FONT_METADATA) as FontId[]) {
    const meta: FontMeta = FONT_METADATA[id];
    const entry = files[id] as
      | {
          family: string;
          license: string;
          attribution: string;
          faces: FontFace[];
        }
      | undefined;

    if (!entry) {
      throw new Error(
        `Font "${id}" is in the registry but not in font-files.generated.json. ` +
          "Add it to FONT_PACKAGES in scripts/sync-fonts.mjs and run `npm run fonts`.",
      );
    }

    out[id] = {
      id,
      family: entry.family,
      category: meta.category,
      description: meta.description,
      fallbacks: meta.fallbacks,
      selectable: meta.selectable !== false,
      faces: entry.faces,
      license: entry.license,
      attribution: entry.attribution,
    };
  }

  return out;
}

export const FONTS: Record<FontId, FontDefinition> = buildRegistry();

export const FONT_IDS = Object.keys(FONTS) as [FontId, ...FontId[]];

export const SELECTABLE_FONTS: FontDefinition[] = Object.values(FONTS).filter(
  (font) => font.selectable,
);

export function fontsByCategory(category: FontCategory): FontDefinition[] {
  return SELECTABLE_FONTS.filter((font) => font.category === category);
}

/** The Devanagari face that matches a given font's category. */
function scriptFallbackFor(font: FontDefinition): FontDefinition | null {
  if (font.category === "mono") return null;
  return font.category === "serif"
    ? FONTS["noto-serif-devanagari"]
    : FONTS["noto-sans-devanagari"];
}

function quote(family: string): string {
  return /^[A-Za-z][A-Za-z0-9-]*$/.test(family) ? family : `"${family}"`;
}

/**
 * The full `font-family` value for a font, including its script fallback.
 *
 * Devanagari is always appended. It costs nothing when unused: the @font-face
 * rule carries a unicode-range, so the browser only fetches the file if a
 * Devanagari codepoint actually appears in the document.
 */
export function fontStack(id: FontId): string {
  const font = FONTS[id];
  const families = [font.family];

  const fallback = scriptFallbackFor(font);
  if (fallback) families.push(fallback.family);

  return [...families.map(quote), ...font.fallbacks].join(", ");
}

/** Every font id the document will actually need, including script fallbacks. */
export function resolveFontDependencies(ids: readonly FontId[]): FontId[] {
  const needed = new Set<FontId>();

  for (const id of ids) {
    needed.add(id);
    const fallback = scriptFallbackFor(FONTS[id]);
    if (fallback) needed.add(fallback.id);
  }

  return [...needed];
}

/**
 * `@font-face` rules for the given fonts.
 *
 * `resolveUrl` exists because the two consumers need different URLs: the
 * preview iframe can use a same-origin path, but headless Chromium renders
 * detached HTML with no origin to resolve against, so it inlines each file as
 * a data: URI instead.
 */
export function fontFaceCss(
  ids: readonly FontId[],
  resolveUrl: (url: string) => string = (url) => url,
): string {
  return resolveFontDependencies(ids)
    .flatMap((id) => {
      const font = FONTS[id];
      return font.faces.map((face) =>
        [
          "@font-face {",
          `  font-family: ${quote(font.family)};`,
          `  font-style: ${face.style};`,
          `  font-weight: ${face.weight};`,
          "  font-display: block;",
          `  src: url(${resolveUrl(face.url)}) format("woff2");`,
          `  unicode-range: ${face.unicodeRange};`,
          "}",
        ].join("\n"),
      );
    })
    .join("\n\n");
}
