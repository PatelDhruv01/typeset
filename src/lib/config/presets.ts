import {
  documentConfigSchema,
  type DocumentConfig,
  type PartialDocumentConfig,
} from "@/lib/config/schema";

/**
 * Style presets.
 *
 * A preset is just a partial DocumentConfig. Applying one runs it through the
 * schema, so anything it does not mention falls back to the documented default
 * rather than to whatever the previous preset happened to leave behind.
 *
 * Each one is a real editorial position, not a colour swap. If two presets
 * differ only in accent colour, one of them should not exist.
 */

export type PresetId =
  | "github"
  | "technical"
  | "report"
  | "academic"
  | "book"
  | "minimal"
  | "night";

export type StylePreset = {
  id: PresetId;
  name: string;
  /** One line for the preset card. */
  tagline: string;
  /** What this is actually for. Shown on hover or in the drawer. */
  bestFor: string;
  config: PartialDocumentConfig;
};

const PRESET_LIST: StylePreset[] = [
  {
    id: "github",
    name: "GitHub",
    tagline: "The familiar README look, tuned for paper.",
    bestFor:
      "READMEs, documentation, anything you already read on GitHub. Safe default.",
    config: {
      preset: "github",
      typography: {
        bodyFont: "inter",
        monoFont: "jetbrains-mono",
        baseFontSize: 11,
        lineHeight: 1.65,
      },
      theme: {
        text: "#1f2328",
        heading: "#1f2328",
        muted: "#57606a",
        link: "#0969da",
        accent: "#0969da",
        border: "#d0d7de",
        codeBackground: "#f6f8fa",
        codeTheme: "github",
        headingRules: "h1-h2",
        tableStyle: "zebra",
        quoteStyle: "bar",
      },
      footer: { enabled: true, right: "{page} / {pages}" },
    },
  },

  {
    id: "technical",
    name: "Technical",
    tagline: "Dense, code-first, built to survive long listings.",
    bestFor:
      "Study notes, engineering docs, anything with more code and tables than prose.",
    config: {
      preset: "technical",
      page: { margins: { top: 20, right: 16, bottom: 20, left: 16 } },
      typography: {
        bodyFont: "ibm-plex-sans",
        monoFont: "jetbrains-mono",
        baseFontSize: 10.5,
        lineHeight: 1.55,
        headingScale: 1.2,
        headingWeight: 600,
        // Smaller code so wide listings and tables fit before wrapping.
        codeFontScale: 0.8,
      },
      theme: {
        text: "#1a1d21",
        heading: "#0b0d0f",
        muted: "#5c6570",
        link: "#1d4ed8",
        accent: "#1d4ed8",
        border: "#dbe0e6",
        codeBackground: "#f7f8fa",
        codeTheme: "atom-one-light",
        headingRules: "h1",
        tableStyle: "grid",
        quoteStyle: "bar-tinted",
      },
      structure: {
        avoidBreakInside: ["code", "figure", "blockquote", "callout"],
      },
      header: { enabled: true, left: "{title}", rule: true },
      footer: { enabled: true, right: "{page} / {pages}" },
    },
  },

  {
    id: "report",
    name: "Report",
    tagline: "Cover page, contents, numbered sections. The formal treatment.",
    bestFor:
      "Policy documents, research reports, anything that gets circulated or filed.",
    config: {
      preset: "report",
      page: { margins: { top: 25, right: 22, bottom: 25, left: 22 } },
      typography: {
        bodyFont: "source-serif-4",
        headingFont: "source-sans-3",
        monoFont: "ibm-plex-mono",
        baseFontSize: 11,
        lineHeight: 1.65,
        headingScale: 1.22,
        headingWeight: 600,
      },
      theme: {
        text: "#1a1a1a",
        heading: "#12263f",
        muted: "#5a6472",
        link: "#1c3f6e",
        accent: "#1c3f6e",
        border: "#d6d9dd",
        codeBackground: "#f5f6f8",
        codeTheme: "vs",
        headingRules: "none",
        tableStyle: "horizontal",
        quoteStyle: "bar-tinted",
      },
      cover: { enabled: true, layout: "left" },
      toc: { enabled: true, maxDepth: 3, pageNumbers: true, dotLeaders: true },
      structure: { numberHeadings: true, numberDepth: 3, pageBreakBefore: "h1" },
      header: { enabled: true, left: "{title}", right: "{section}", rule: true },
      footer: { enabled: true, center: "{page}", showOnFirstPage: false },
    },
  },

  {
    id: "academic",
    name: "Academic",
    tagline: "Garamond, justified, numbered figures. Prints in black and white.",
    bestFor:
      "Papers, theses, literature reviews. Anything destined for a journal or a printer.",
    config: {
      preset: "academic",
      page: { margins: { top: 28, right: 28, bottom: 28, left: 28 } },
      typography: {
        bodyFont: "eb-garamond",
        monoFont: "source-code-pro",
        baseFontSize: 11.5,
        lineHeight: 1.5,
        headingScale: 1.18,
        headingWeight: 700,
        align: "justify",
        hyphenate: true,
      },
      theme: {
        text: "#111111",
        heading: "#000000",
        muted: "#4a4a4a",
        link: "#000000",
        accent: "#333333",
        border: "#bbbbbb",
        codeBackground: "#f4f4f4",
        // Papers get printed in black and white; a colour theme turns into mud.
        codeTheme: "grayscale",
        // Keeps a printed copy usable: link text stays inline, URL prints as a note.
        linkStyle: "footnote",
        headingRules: "none",
        tableStyle: "horizontal",
        quoteStyle: "indent",
      },
      toc: { enabled: true, maxDepth: 3 },
      structure: {
        numberHeadings: true,
        numberDepth: 3,
        numberFigures: true,
        numberTables: true,
      },
      footer: { enabled: true, center: "{page}" },
    },
  },

  {
    id: "book",
    name: "Book",
    tagline: "B5 trim, asymmetric margins, chapters start on a new page.",
    bestFor: "Long-form reading. Manuals, handbooks, anything bound.",
    config: {
      preset: "book",
      page: {
        size: "b5",
        margins: { top: 22, right: 18, bottom: 24, left: 26 },
      },
      typography: {
        bodyFont: "literata",
        monoFont: "ibm-plex-mono",
        baseFontSize: 10.5,
        lineHeight: 1.62,
        headingScale: 1.2,
        align: "justify",
        hyphenate: true,
      },
      theme: {
        text: "#26221e",
        heading: "#171310",
        muted: "#6b6259",
        link: "#7a5230",
        accent: "#7a5230",
        border: "#ddd6cc",
        codeBackground: "#f7f4ef",
        codeTheme: "nnfx-light",
        headingRules: "none",
        tableStyle: "horizontal",
        quoteStyle: "italic",
      },
      toc: { enabled: true, maxDepth: 2 },
      structure: { pageBreakBefore: "h1", widows: 3, orphans: 3 },
      header: { enabled: true, center: "{section}", showOnFirstPage: false },
      footer: { enabled: true, center: "{page}", showOnFirstPage: false },
    },
  },

  {
    id: "minimal",
    name: "Minimal",
    tagline: "No rules, no running heads, no page numbers. Just the text.",
    bestFor:
      "Drafts, handouts, one-pagers. When any chrome at all would be noise.",
    config: {
      preset: "minimal",
      page: { margins: { top: 30, right: 30, bottom: 30, left: 30 } },
      typography: {
        bodyFont: "source-sans-3",
        monoFont: "source-code-pro",
        baseFontSize: 11,
        lineHeight: 1.7,
        headingScale: 1.18,
        headingWeight: 600,
      },
      theme: {
        text: "#2b2b2b",
        heading: "#111111",
        muted: "#6b6b6b",
        link: "#2b2b2b",
        accent: "#8a8a8a",
        border: "#e4e4e4",
        codeBackground: "#f7f7f7",
        codeTheme: "grayscale",
        linkStyle: "underline",
        headingRules: "none",
        tableStyle: "minimal",
        quoteStyle: "indent",
      },
      header: { enabled: false },
      footer: { enabled: false },
    },
  },

  {
    id: "night",
    name: "Night",
    tagline: "Dark page for reading on screen. Do not print this one.",
    bestFor:
      "PDFs meant to be read on a laptop or tablet, never sent to a printer.",
    config: {
      preset: "night",
      typography: {
        bodyFont: "inter",
        monoFont: "jetbrains-mono",
        baseFontSize: 11,
        lineHeight: 1.7,
      },
      theme: {
        pageBackground: "#0d1117",
        text: "#e6edf3",
        heading: "#ffffff",
        muted: "#8b949e",
        link: "#58a6ff",
        accent: "#58a6ff",
        border: "#30363d",
        codeBackground: "#161b22",
        codeTheme: "github-dark",
        headingRules: "h1-h2",
        tableStyle: "horizontal",
        quoteStyle: "bar",
      },
      footer: { enabled: true, right: "{page} / {pages}", colour: "#8b949e" },
    },
  },
];

export const PRESETS: Record<PresetId, StylePreset> = Object.fromEntries(
  PRESET_LIST.map((preset) => [preset.id, preset]),
) as Record<PresetId, StylePreset>;

export const PRESET_IDS = PRESET_LIST.map((preset) => preset.id);

export const DEFAULT_PRESET_ID: PresetId = "github";

export function isPresetId(value: string): value is PresetId {
  return value in PRESETS;
}

/**
 * A preset as a complete, validated config.
 *
 * Note this resolves against schema defaults, not against the config currently
 * on screen. Switching preset is a reset, not a diff - otherwise "Minimal"
 * would silently keep the cover page that "Report" turned on.
 */
export function configFromPreset(id: PresetId): DocumentConfig {
  return documentConfigSchema.parse(PRESETS[id].config);
}
