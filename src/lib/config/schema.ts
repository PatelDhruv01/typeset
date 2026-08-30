import { z } from "zod";

import { FONT_IDS } from "@/lib/fonts";
import { LENGTH_UNITS, PAGE_SIZE_IDS } from "@/lib/config/page-sizes";

/**
 * DocumentConfig - everything a user can change about the output.
 *
 * This is the single most load-bearing type in the project. It is the input to
 * the renderer, the body of the render API, the value of a style preset, and
 * the thing serialised into a shareable link. If it cannot be expressed here,
 * it cannot be customised.
 *
 * Three rules keep it honest:
 *
 *   1. Plain data only. No functions, no class instances, no undefined - so it
 *      round-trips through JSON without loss.
 *   2. Page geometry in millimetres, type sizes in points. See page-sizes.ts.
 *   3. Every leaf has a `.default()`. That is what lets a caller send a partial
 *      config - a preset, a URL fragment, an API request - and get a complete,
 *      valid one back.
 *
 * On nested objects, note `.prefault({})` rather than `.default({})`.
 * `.default({})` hands back the literal `{}` without running the inner
 * defaults; `.prefault({})` feeds `{}` through parsing so the leaves fill in.
 */

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex colour, e.g. #1f2328");

/** A length in millimetres. */
const mm = z.number().min(0).max(2000);

/** A type size in points. */
const pt = z.number().min(4).max(96);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export const pageSchema = z.object({
  size: z.enum([...PAGE_SIZE_IDS, "custom"]).default("a4"),
  /** Only meaningful when `size` is "custom". Portrait orientation. */
  customWidth: mm.default(210),
  customHeight: mm.default(297),
  orientation: z.enum(["portrait", "landscape"]).default("portrait"),
  margins: z
    .object({
      top: mm.default(25),
      right: mm.default(20),
      bottom: mm.default(25),
      left: mm.default(20),
    })
    .prefault({}),
  /** Chromium's own print scale. 1 = no scaling. */
  scale: z.number().min(0.5).max(2).default(1),
  /** Display preference only - never affects stored values. */
  displayUnit: z.enum(LENGTH_UNITS).default("mm"),
});

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const typographySchema = z.object({
  bodyFont: z.enum(FONT_IDS).default("inter"),
  /** "inherit" means headings use the body font. */
  headingFont: z.enum([...FONT_IDS, "inherit"]).default("inherit"),
  monoFont: z.enum(FONT_IDS).default("jetbrains-mono"),

  baseFontSize: pt.default(11),
  lineHeight: z.number().min(1).max(3).default(1.6),

  /**
   * One knob instead of six. Heading sizes come from a modular scale:
   * h6 is body size, and each level up multiplies by this ratio. 1.25 is a
   * major third; 1.2 is calmer, 1.333 more dramatic.
   */
  headingScale: z.number().min(1).max(1.6).default(1.25),
  headingWeight: z.number().int().min(400).max(900).default(600),

  /** Space after a paragraph, in em of the body size. */
  paragraphSpacing: z.number().min(0).max(3).default(0.85),
  /** Extra tracking, in em. Negative tightens. */
  letterSpacing: z.number().min(-0.05).max(0.2).default(0),

  align: z.enum(["left", "justify"]).default("left"),
  /**
   * Only meaningful with `align: "justify"` - unhyphenated justified text
   * opens rivers of whitespace, especially in narrow columns.
   */
  hyphenate: z.boolean().default(false),

  /**
   * Maximum line length in millimetres, or null for the full column.
   * Long measures are tiring to read; ~65-75 characters is the usual target.
   */
  measure: mm.nullable().default(null),

  /** Code size relative to body size. */
  codeFontScale: z.number().min(0.5).max(1.2).default(0.85),
  /** Wrap long code lines instead of letting them overflow the page. */
  wrapCode: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

export const CODE_THEMES = [
  "github",
  "atom-one-light",
  "a11y-light",
  "intellij-light",
  "xcode",
  "vs",
  "stackoverflow-light",
  "grayscale",
  "nnfx-light",
  "github-dark",
  "atom-one-dark",
] as const;

export const themeSchema = z.object({
  pageBackground: hexColor.default("#ffffff"),
  text: hexColor.default("#1f2328"),
  heading: hexColor.default("#1f2328"),
  muted: hexColor.default("#57606a"),
  link: hexColor.default("#0969da"),
  /** Rules, callout bars, TOC leaders, table header fill. */
  accent: hexColor.default("#0969da"),
  border: hexColor.default("#d0d7de"),
  codeBackground: hexColor.default("#f6f8fa"),

  codeTheme: z.enum(CODE_THEMES).default("github"),

  /**
   * A hyperlink is useless on paper. "footnote" keeps the link text inline and
   * prints the URL as a superscripted note, so a printed copy stays usable.
   */
  linkStyle: z.enum(["colour", "underline", "plain", "footnote"]).default("colour"),

  /** The horizontal rule under headings, as in the GitHub look. */
  headingRules: z.enum(["none", "h1", "h1-h2"]).default("h1-h2"),

  tableStyle: z.enum(["grid", "zebra", "horizontal", "minimal"]).default("zebra"),
  /** Tint behind blockquotes. */
  quoteStyle: z.enum(["bar", "bar-tinted", "indent", "italic"]).default("bar"),
});

// ---------------------------------------------------------------------------
// Running head and foot
// ---------------------------------------------------------------------------

/**
 * Header/footer slots accept template tokens, substituted per page:
 *   {title} {subtitle} {author} {date} {page} {pages} {section} {filename}
 * Anything else is literal text.
 */
const slotText = z.string().max(200);

function runningSlot(defaults: {
  enabled: boolean;
  left: string;
  center: string;
  right: string;
}) {
  return z
    .object({
      enabled: z.boolean().default(defaults.enabled),
      left: slotText.default(defaults.left),
      center: slotText.default(defaults.center),
      right: slotText.default(defaults.right),
      fontSize: pt.default(8),
      colour: hexColor.default("#57606a"),
      /** Hairline rule between the running text and the body. */
      rule: z.boolean().default(false),
      showOnFirstPage: z.boolean().default(true),
    })
    .prefault({});
}

export const headerSchema = runningSlot({
  enabled: false,
  left: "",
  center: "",
  right: "",
});

export const footerSchema = runningSlot({
  enabled: true,
  left: "",
  center: "",
  right: "{page} / {pages}",
});

// ---------------------------------------------------------------------------
// Front matter: cover page and table of contents
// ---------------------------------------------------------------------------

export const coverSchema = z.object({
  enabled: z.boolean().default(false),
  layout: z.enum(["centred", "left", "banner", "minimal"]).default("centred"),
  /** null means "derive from the document" - front matter, then first H1. */
  title: z.string().max(300).nullable().default(null),
  subtitle: z.string().max(300).nullable().default(null),
  author: z.string().max(300).nullable().default(null),
  organisation: z.string().max(300).nullable().default(null),
  /** Literal text, or null to use today's date at render time. */
  date: z.string().max(100).nullable().default(null),
  abstract: z.string().max(4000).default(""),
  /** data: URI. Kept in the config so a preset can carry a logo. */
  logo: z.string().max(2_000_000).nullable().default(null),
  logoWidth: mm.default(40),
});

export const tocSchema = z.object({
  enabled: z.boolean().default(false),
  title: z.string().max(100).default("Contents"),
  minDepth: z.number().int().min(1).max(6).default(1),
  maxDepth: z.number().int().min(1).max(6).default(3),
  pageNumbers: z.boolean().default(true),
  dotLeaders: z.boolean().default(true),
  breakAfter: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

export const structureSchema = z.object({
  /** Automatic 1. / 1.1 / 1.1.1 numbering on headings. */
  numberHeadings: z.boolean().default(false),
  /** Heading level that becomes "1." - usually h1, but h2 if h1 is the title. */
  numberFrom: z.number().int().min(1).max(6).default(1),
  numberDepth: z.number().int().min(1).max(6).default(3),

  numberFigures: z.boolean().default(false),
  numberTables: z.boolean().default(false),
  figureLabel: z.string().max(40).default("Figure"),
  tableLabel: z.string().max(40).default("Table"),

  pageBreakBefore: z.enum(["none", "h1", "h2"]).default("none"),
  avoidBreakInside: z
    .array(
      z.enum(["code", "table", "figure", "blockquote", "list", "callout"]),
    )
    .default(["code", "figure", "blockquote", "callout"]),

  columns: z.union([z.literal(1), z.literal(2)]).default(1),
  columnGap: mm.default(8),

  startPageNumber: z.number().int().min(0).max(9999).default(1),
  /** Minimum lines kept together at a page break. */
  widows: z.number().int().min(1).max(5).default(2),
  orphans: z.number().int().min(1).max(5).default(2),
});

// ---------------------------------------------------------------------------
// Markdown dialect
// ---------------------------------------------------------------------------

export const markdownSchema = z.object({
  /** Tables, task lists, strikethrough, autolinks. */
  gfm: z.boolean().default(true),
  /**
   * Turn every single newline into a line break.
   *
   * Off by default, deliberately. The legacy script had this on, which breaks
   * any Markdown written with hard-wrapped paragraphs - every wrapped line
   * became its own line in the PDF.
   */
  softBreaks: z.boolean().default(false),
  /** Curly quotes, em dashes, ellipses. */
  smartTypography: z.boolean().default(true),
  footnotes: z.boolean().default(true),
  /** $inline$ and $$display$$ maths via KaTeX. */
  math: z.boolean().default(true),
  /** ```mermaid fenced blocks rendered as diagrams. */
  mermaid: z.boolean().default(true),
  /** > [!NOTE] and ::: warning callouts. */
  admonitions: z.boolean().default(true),
  emoji: z.boolean().default(true),
  /**
   * Raw HTML inside Markdown. "sanitise" is the only safe default: this input
   * can come from an uploaded file or an API caller, and it is rendered in a
   * browser context.
   */
  rawHtml: z.enum(["strip", "sanitise", "allow"]).default("sanitise"),
  /** YAML front matter: use it for metadata, drop it, or print it. */
  frontMatter: z.enum(["parse", "ignore", "render"]).default("parse"),
});

// ---------------------------------------------------------------------------
// Watermark
// ---------------------------------------------------------------------------

export const watermarkSchema = z.object({
  enabled: z.boolean().default(false),
  text: z.string().max(60).default("DRAFT"),
  colour: hexColor.default("#000000"),
  opacity: z.number().min(0).max(1).default(0.07),
  rotation: z.number().min(-90).max(90).default(-30),
  fontSize: z.number().min(8).max(300).default(96),
  layout: z.enum(["single", "tiled"]).default("single"),
});

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export const outputSchema = z.object({
  /**
   * Output filename without extension, or null to derive it - front matter
   * title, then first H1, then the uploaded filename. This is the whole reason
   * the project exists, so it gets a real fallback chain rather than
   * "output.pdf".
   */
  fileName: z.string().max(200).nullable().default(null),
  /** PDF bookmarks generated from the heading structure. */
  outline: z.boolean().default(true),
  /** Tagged PDF - structure information for screen readers. */
  tagged: z.boolean().default(true),
  metadata: z
    .object({
      title: z.string().max(300).nullable().default(null),
      author: z.string().max(300).nullable().default(null),
      subject: z.string().max(500).nullable().default(null),
      keywords: z.array(z.string().max(60)).max(30).default([]),
    })
    .prefault({}),
});

// ---------------------------------------------------------------------------
// The whole thing
// ---------------------------------------------------------------------------

export const documentConfigSchema = z.object({
  /** Bumped when a change to this schema needs a migration. */
  version: z.literal(1).default(1),
  /** Which style preset this started from. Provenance, not behaviour. */
  preset: z.string().max(60).default("github"),

  page: pageSchema.prefault({}),
  typography: typographySchema.prefault({}),
  theme: themeSchema.prefault({}),
  header: headerSchema,
  footer: footerSchema,
  cover: coverSchema.prefault({}),
  toc: tocSchema.prefault({}),
  structure: structureSchema.prefault({}),
  markdown: markdownSchema.prefault({}),
  watermark: watermarkSchema.prefault({}),
  output: outputSchema.prefault({}),
});

export type DocumentConfig = z.infer<typeof documentConfigSchema>;
export type PageConfig = DocumentConfig["page"];
export type TypographyConfig = DocumentConfig["typography"];
export type ThemeConfig = DocumentConfig["theme"];
export type RunningSlotConfig = DocumentConfig["header"];
export type CoverConfig = DocumentConfig["cover"];
export type TocConfig = DocumentConfig["toc"];
export type StructureConfig = DocumentConfig["structure"];
export type MarkdownConfig = DocumentConfig["markdown"];
export type WatermarkConfig = DocumentConfig["watermark"];
export type OutputConfig = DocumentConfig["output"];

/** A config with every field filled in from defaults. */
export const DEFAULT_CONFIG: DocumentConfig = documentConfigSchema.parse({});

/**
 * A partial config, as sent by a preset, a shared link or an API caller.
 *
 * Optional all the way down, not just at the top level - `page.margins.top`
 * has to be settable without restating the other three sides. Arrays and null
 * are passed through whole; there is no meaningful "partial array" here.
 */
export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends null
    ? T
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

export type PartialDocumentConfig = DeepPartial<DocumentConfig>;
