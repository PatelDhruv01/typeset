import manifest from "./font-files.generated.json";

import { findEmoji } from "@/lib/text/emoji";

/**
 * The font registry.
 *
 * `font-files.generated.json` is produced by scripts/sync-fonts.mjs and knows
 * about files, weights and - read from each file's own cmap - exactly which
 * characters each file draws. This module adds the things a human needs: a
 * display name, a one-line description for the picker, and the fallback chain
 * that stands behind every face.
 *
 * The fallback chain is the reason a PDF prints arrows, ticks and emoji at
 * all. The serverless Chromium that renders it has one system font, so a
 * character the chosen face lacks would otherwise print as an empty box. And
 * because the preview uses the same chain rather than the viewer's system
 * fonts, what the preview shows is what the PDF prints.
 */

export type FontCategory = "sans" | "serif" | "mono";

/**
 * face   - a font the user can pick.
 * script - another writing system: Devanagari, Gujarati, Arabic...
 * symbol - arrows, maths, dingbats, box drawing.
 * emoji  - colour emoji.
 */
export type FontRole = "face" | "script" | "symbol" | "emoji";

export type FontId = keyof typeof FONT_METADATA;

type FontMeta = {
  category: FontCategory;
  /** Shown under the font name in the picker. Say what it is *for*. */
  description: string;
  /** Generic CSS families appended last, for glyphs nothing we ship carries. */
  fallbacks: readonly string[];
  /** Fallback fonts are never shown in the picker; they load automatically. */
  role?: Exclude<FontRole, "face">;
};

const SANS_FALLBACK = ["ui-sans-serif", "system-ui", "sans-serif"] as const;
const SERIF_FALLBACK = ["Georgia", "ui-serif", "serif"] as const;
const MONO_FALLBACK = [
  "ui-monospace",
  "SFMono-Regular",
  "Menlo",
  "monospace",
] as const;

const script = (category: FontCategory, name: string): FontMeta => ({
  category,
  description: `${name} fallback.`,
  fallbacks: [],
  role: "script",
});

const symbol = (category: FontCategory, description: string): FontMeta => ({
  category,
  description,
  fallbacks: [],
  role: "symbol",
});

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
  "noto-sans-devanagari": script("sans", "Devanagari"),
  "noto-serif-devanagari": script("serif", "Devanagari"),
  "noto-sans-gujarati": script("sans", "Gujarati"),
  "noto-sans-bengali": script("sans", "Bengali"),
  "noto-sans-gurmukhi": script("sans", "Gurmukhi"),
  "noto-sans-oriya": script("sans", "Odia"),
  "noto-sans-tamil": script("sans", "Tamil"),
  "noto-sans-telugu": script("sans", "Telugu"),
  "noto-sans-kannada": script("sans", "Kannada"),
  "noto-sans-malayalam": script("sans", "Malayalam"),
  "noto-sans-arabic": script("sans", "Arabic"),
  "noto-sans-hebrew": script("sans", "Hebrew"),
  "noto-sans-thai": script("sans", "Thai"),

  // --- symbol fallbacks ---
  "noto-sans-math": symbol("sans", "Arrows and mathematical operators."),
  "noto-sans-symbols-2": symbol("sans", "Dingbats, ticks, crosses and shapes."),
  "noto-sans-symbols": symbol("sans", "Technical and miscellaneous symbols."),
  "dejavu-sans": symbol("sans", "Wide symbol coverage; the last text resort."),
  "dejavu-sans-mono": symbol(
    "mono",
    "Box drawing and symbols at monospace width, so trees in code line up.",
  ),

  // --- emoji ---
  "noto-color-emoji": {
    category: "sans",
    description: "Colour emoji.",
    fallbacks: [],
    role: "emoji",
  },
} as const satisfies Record<string, FontMeta>;

export type FontFace = {
  url: string;
  /** The @fontsource subset the file came from. Styles of one subset share it. */
  subset: string;
  style: string;
  weight: string;
  /** Exactly the characters the file draws, read from its cmap. */
  unicodeRange: string;
};

export type FontDefinition = {
  id: FontId;
  /** CSS family name, e.g. "Source Serif 4". */
  family: string;
  category: FontCategory;
  role: FontRole;
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

    const role: FontRole = meta.role ?? "face";

    out[id] = {
      id,
      family: entry.family,
      category: meta.category,
      role,
      description: meta.description,
      fallbacks: meta.fallbacks,
      selectable: role === "face",
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

// ---------------------------------------------------------------------------
// The fallback chain
// ---------------------------------------------------------------------------

const SCRIPTS_AFTER_DEVANAGARI: readonly FontId[] = [
  "noto-sans-gujarati",
  "noto-sans-bengali",
  "noto-sans-gurmukhi",
  "noto-sans-oriya",
  "noto-sans-tamil",
  "noto-sans-telugu",
  "noto-sans-kannada",
  "noto-sans-malayalam",
  "noto-sans-arabic",
  "noto-sans-hebrew",
  "noto-sans-thai",
];

/** Serif documents get a serif Devanagari; everything else is sans. */
const SCRIPT_FALLBACKS: Record<FontCategory, readonly FontId[]> = {
  sans: ["noto-sans-devanagari", ...SCRIPTS_AFTER_DEVANAGARI],
  serif: ["noto-serif-devanagari", ...SCRIPTS_AFTER_DEVANAGARI],
  mono: ["noto-sans-devanagari", ...SCRIPTS_AFTER_DEVANAGARI],
};

/**
 * Order matters: the first font in the chain that has a character draws it.
 * Noto Sans Math leads because its arrows and operators are designed to sit
 * in running text. Code gets DejaVu Sans Mono first, whose box-drawing and
 * arrows have the same 0.6em advance as the mono faces, so a file tree in a
 * code block stays aligned.
 */
const TEXT_SYMBOLS: readonly FontId[] = [
  "noto-sans-math",
  "noto-sans-symbols-2",
  "noto-sans-symbols",
  "dejavu-sans",
];

const SYMBOL_FALLBACKS: Record<FontCategory, readonly FontId[]> = {
  sans: TEXT_SYMBOLS,
  serif: TEXT_SYMBOLS,
  mono: ["dejavu-sans-mono", ...TEXT_SYMBOLS],
};

export const EMOJI_FONT: FontId = "noto-color-emoji";

/** Every font, in the order the browser will try them, for text set in `id`. */
export function fontChain(id: FontId): FontId[] {
  const font = FONTS[id];
  if (font.role !== "face") return [id];
  return [
    id,
    ...SCRIPT_FALLBACKS[font.category],
    ...SYMBOL_FALLBACKS[font.category],
    EMOJI_FONT,
  ];
}

function quote(family: string): string {
  return /^[A-Za-z][A-Za-z0-9-]*$/.test(family) ? family : `"${family}"`;
}

/**
 * The full `font-family` value for a font, fallback chain included.
 *
 * The chain costs nothing when unused: every @font-face rule carries a
 * unicode-range, so a file is only fetched - or, for the PDF, only inlined -
 * when a character it draws actually appears.
 */
export function fontStack(id: FontId): string {
  const families = fontChain(id).map((fontId) => quote(FONTS[fontId].family));
  return [...families, ...FONTS[id].fallbacks].join(", ");
}

/** The family list for an emoji span: the colour font first, then `context`. */
export function emojiStack(context: string): string {
  return `${quote(FONTS[EMOJI_FONT].family)}, ${context}`;
}

/** Every font id the document might need, fallback chains included. */
export function resolveFontDependencies(ids: readonly FontId[]): FontId[] {
  const needed = new Set<FontId>();
  for (const id of ids) for (const fontId of fontChain(id)) needed.add(fontId);
  return [...needed];
}

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

/** Parsed unicode-range: sorted, non-overlapping [start, end] pairs. */
const rangeCache = new Map<string, Uint32Array>();

function rangesOf(face: FontFace): Uint32Array {
  const cached = rangeCache.get(face.unicodeRange);
  if (cached) return cached;

  const pairs: number[] = [];
  for (const part of face.unicodeRange.split(",")) {
    const [start = "", end] = part.trim().replace(/^U\+/i, "").split("-");
    const a = parseInt(start, 16);
    pairs.push(a, end ? parseInt(end, 16) : a);
  }

  const ranges = Uint32Array.from(pairs);
  rangeCache.set(face.unicodeRange, ranges);
  return ranges;
}

function faceCovers(face: FontFace, codepoint: number): boolean {
  const ranges = rangesOf(face);
  let low = 0;
  let high = ranges.length / 2 - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const start = ranges[mid * 2] as number;
    const end = ranges[mid * 2 + 1] as number;
    if (codepoint < start) high = mid - 1;
    else if (codepoint > end) low = mid + 1;
    else return true;
  }
  return false;
}

/**
 * Characters that are never drawn on their own: controls, format characters,
 * variation selectors, joiners, and the like. A font is never chosen for them,
 * and no font lacking them is a missing glyph.
 */
const NOT_DRAWN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]/u;

type TextProfile = {
  /** Codepoints drawn through the ordinary font stacks. */
  plain: number[];
  /** Emoji sequences, each drawn from the emoji font as one cluster. */
  emoji: string[];
};

function profileText(text: string): TextProfile {
  const emoji = [...new Set(findEmoji(text))];

  // Emoji are cut out before counting plain characters. Otherwise the parts
  // of 👩🏾‍🔬 would each pull in whichever emoji file holds them on its own,
  // when the one file that holds the whole sequence already draws all three.
  let rest = text;
  for (const sequence of emoji) rest = rest.split(sequence).join("");

  const plain = new Set<number>();
  for (const char of rest) {
    if (NOT_DRAWN.test(char)) continue;
    plain.add(char.codePointAt(0) as number);
  }

  return { plain: [...plain], emoji };
}

/**
 * The emoji face Chromium will draw `sequence` from: among faces holding every
 * part of it, the one declared last - for overlapping unicode-ranges the last
 * rule wins. When no single face holds it all, the parts are drawn separately,
 * so the face holding its first character is the best that can be done.
 */
function emojiFaceFor(sequence: string): FontFace | null {
  const faces = FONTS[EMOJI_FONT].faces;
  const parts = [...sequence]
    .map((char) => char.codePointAt(0) as number)
    .filter((cp) => !NOT_DRAWN.test(String.fromCodePoint(cp)) || cp === 0x200d);

  for (let i = faces.length - 1; i >= 0; i -= 1) {
    const face = faces[i] as FontFace;
    if (parts.every((cp) => faceCovers(face, cp))) return face;
  }

  const first = parts[0];
  if (first === undefined) return null;
  for (let i = faces.length - 1; i >= 0; i -= 1) {
    const face = faces[i] as FontFace;
    if (faceCovers(face, first)) return face;
  }
  return null;
}

export type FaceSelection = {
  faces: Map<FontId, Set<FontFace>>;
  /** Characters - or emoji sequences - that no font in the chain can draw. */
  missing: string[];
};

/**
 * Exactly the font files a document needs, by walking each chain the way the
 * browser does: a character is drawn by the first font that has it, so the
 * fonts behind that one are never asked for it.
 *
 * Within one font, every style of a subset is kept together: whether a run of
 * Greek is italic is not known from the text alone, and a few kilobytes of
 * unused italic beat a synthesised slant.
 */
export function selectFaces(ids: readonly FontId[], text: string): FaceSelection {
  const { plain, emoji } = profileText(text);
  const faces = new Map<FontId, Set<FontFace>>();
  const take = (id: FontId, face: FontFace) => {
    let set = faces.get(id);
    if (!set) faces.set(id, (set = new Set()));
    set.add(face);
  };

  const uncovered = new Set<number>(plain);

  for (const id of new Set(ids)) {
    let remaining = plain;

    for (const fontId of fontChain(id)) {
      if (remaining.length === 0) break;
      const font = FONTS[fontId];
      const next: number[] = [];

      for (const cp of remaining) {
        let chosen: FontFace | undefined;
        for (const face of font.faces) if (faceCovers(face, cp)) chosen = face;

        if (!chosen) {
          next.push(cp);
          continue;
        }

        uncovered.delete(cp);
        const subset = chosen.subset;
        for (const face of font.faces) if (face.subset === subset) take(fontId, face);
      }

      remaining = next;
    }
  }

  const missing = [...uncovered].map((cp) => String.fromCodePoint(cp));

  for (const sequence of emoji) {
    const face = emojiFaceFor(sequence);
    if (face) take(EMOJI_FONT, face);
    else missing.push(sequence);
  }

  return { faces, missing };
}

/** Characters in `text` that no font in the chains for `ids` can draw. */
export function findMissingCharacters(ids: readonly FontId[], text: string): string[] {
  return selectFaces(ids, text).missing;
}

// ---------------------------------------------------------------------------
// @font-face
// ---------------------------------------------------------------------------

function faceRule(font: FontDefinition, face: FontFace, url: string): string {
  return [
    "@font-face {",
    `  font-family: ${quote(font.family)};`,
    `  font-style: ${face.style};`,
    `  font-weight: ${face.weight};`,
    "  font-display: block;",
    `  src: url(${url}) format("woff2");`,
    `  unicode-range: ${face.unicodeRange};`,
    "}",
  ].join("\n");
}

/**
 * `@font-face` rules for the given fonts and their fallback chains.
 *
 * Given the document's `text`, only the files that text needs are emitted.
 * That matters most for the PDF, which inlines every emitted file as a data:
 * URI: a document with one emoji carries one emoji file, not twelve. Without
 * `text`, every file in every chain is emitted.
 *
 * `resolveUrl` exists because the two consumers need different URLs: the
 * preview iframe can use a same-origin path, but headless Chromium renders
 * detached HTML with no origin to resolve against, so it inlines each file as
 * a data: URI instead.
 */
export function fontFaceCss(
  ids: readonly FontId[],
  resolveUrl: (url: string) => string = (url) => url,
  text?: string,
): string {
  const selection = text === undefined ? null : selectFaces(ids, text);

  return resolveFontDependencies(ids)
    .flatMap((id) => {
      const font = FONTS[id];
      const wanted = selection?.faces.get(id);
      if (selection && !wanted) return [];
      // Manifest order, not selection order: for overlapping ranges the last
      // declared rule wins, and selectFaces predicted the winner on that basis.
      return font.faces
        .filter((face) => !wanted || wanted.has(face))
        .map((face) => faceRule(font, face, resolveUrl(face.url)));
    })
    .join("\n\n");
}
