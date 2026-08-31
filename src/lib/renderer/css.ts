import type { DocumentConfig } from "@/lib/config/schema";
import { resolvePageSize } from "@/lib/config/page-sizes";
import { fontFaceCss, fontStack, type FontId } from "@/lib/fonts";
import { CODE_THEME_CSS } from "@/lib/renderer/generated/code-themes";
import { KATEX_CSS } from "@/lib/renderer/generated/katex-css";

/**
 * DocumentConfig -> the document stylesheet.
 *
 * This is emitted as a plain string rather than compiled by Tailwind, because
 * its two consumers cannot run a bundler: the preview <iframe>, and headless
 * Chromium rendering detached HTML. Both receive this exact text, which is what
 * makes the preview and the PDF the same document rather than two renderings
 * that happen to look similar.
 *
 * It targets CSS Paged Media (@page, margin boxes, counter(page)). Paged.js
 * implements that spec in the browser, so running heads, page numbers and - in
 * Phase 5 - cross-referenced contents entries all come from the stylesheet
 * rather than from a separate header template that could drift out of sync.
 */

export type CssOptions = {
  /**
   * Rewrites font and asset URLs. Preview leaves them as same-origin paths;
   * the PDF renderer inlines them as data: URIs, because detached HTML in
   * Chromium has no origin to resolve a relative URL against.
   */
  resolveUrl?: (url: string) => string;
  /**
   * Emit the KaTeX stylesheet. Skipped when the document contains no maths,
   * since it is 23 KB plus twenty font files.
   */
  includeKatex?: boolean;
};

/** CSS-escape a string for use in a `content:` value. */
function cssString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
}

/** Trim trailing zeros so the output reads like handwritten CSS. */
function num(value: number, decimals = 3): string {
  return String(Number(value.toFixed(decimals)));
}

// ---------------------------------------------------------------------------
// Running heads and feet
// ---------------------------------------------------------------------------

/**
 * Turns a slot template into a CSS `content` value.
 *
 *   "{page} / {pages}"  ->  counter(page) " / " counter(pages)
 *   "Draft - {title}"   ->  "Draft - " "Quarterly Review"
 *
 * `{page}` and `{pages}` have to become real CSS counters rather than
 * substituted text: their value differs on every page, and only the layout
 * engine knows it.
 */
function slotContent(
  template: string,
  context: { title: string; subtitle: string; author: string; date: string; filename: string },
): string | null {
  if (template.trim() === "") return null;

  const parts: string[] = [];
  const pattern =
    /\{(page|pages|title|subtitle|author|date|section|subsection|filename)\}/g;
  let cursor = 0;

  for (let match = pattern.exec(template); match; match = pattern.exec(template)) {
    if (match.index > cursor) {
      parts.push(cssString(template.slice(cursor, match.index)));
    }

    switch (match[1]) {
      case "page":
        parts.push("counter(page)");
        break;
      case "pages":
        parts.push("counter(pages)");
        break;
      case "section":
        // `first` is the first value assigned on this page, falling back to the
        // one carried over. Without it the head keeps showing the previous
        // section on a page that opens a new one.
        parts.push("string(section-title, first)");
        break;
      case "subsection":
        parts.push("string(subsection-title, first)");
        break;
      case "title":
        parts.push(cssString(context.title));
        break;
      case "subtitle":
        parts.push(cssString(context.subtitle));
        break;
      case "author":
        parts.push(cssString(context.author));
        break;
      case "date":
        parts.push(cssString(context.date));
        break;
      case "filename":
        parts.push(cssString(context.filename));
        break;
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < template.length) parts.push(cssString(template.slice(cursor)));

  return parts.length > 0 ? parts.join(" ") : null;
}

type SlotContext = Parameters<typeof slotContent>[1];

function marginBoxes(
  slot: DocumentConfig["header"],
  edge: "top" | "bottom",
  context: SlotContext,
): string[] {
  if (!slot.enabled) return [];

  const rules: string[] = [];
  const positions = [
    ["left", slot.left],
    ["center", slot.center],
    ["right", slot.right],
  ] as const;

  for (const [position, template] of positions) {
    const content = slotContent(template, context);
    if (!content) continue;

    rules.push(
      [
        `  @${edge}-${position} {`,
        `    content: ${content};`,
        `    font-size: ${num(slot.fontSize)}pt;`,
        `    color: ${slot.colour};`,
        `    font-family: var(--doc-font-body);`,
        edge === "top" ? "    vertical-align: bottom;" : "    vertical-align: top;",
        "  }",
      ].join("\n"),
    );
  }

  return rules;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function buildDocumentCss(
  config: DocumentConfig,
  context: SlotContext,
  options: CssOptions = {},
): string {
  const { resolveUrl, includeKatex = true } = options;
  const { page, typography: type, theme, structure, watermark } = config;

  const size = resolvePageSize(
    page.size,
    page.orientation,
    { width: page.customWidth, height: page.customHeight },
  );

  const bodyFont: FontId = type.bodyFont;
  const monoFont: FontId = type.monoFont;
  const headingFont: FontId =
    type.headingFont === "inherit" ? bodyFont : type.headingFont;

  const usedFonts = [...new Set<FontId>([bodyFont, monoFont, headingFont])];

  // Modular scale. h4 sits at body size and each step up multiplies by the
  // ratio; h5/h6 are fixed below it. Anchoring at h4 rather than h6 keeps h1
  // from ballooning at higher ratios.
  const s = type.headingScale;
  const headingSizes: Record<string, number> = {
    h1: s ** 3,
    h2: s ** 2,
    h3: s,
    h4: 1,
    h5: 0.92,
    h6: 0.85,
  };

  const rules: string[] = [];

  // --- assets -------------------------------------------------------------
  rules.push("/* fonts */", fontFaceCss(usedFonts, resolveUrl));

  const codeTheme = CODE_THEME_CSS[theme.codeTheme];
  if (codeTheme) rules.push("/* syntax highlighting */", codeTheme);

  if (includeKatex) {
    const katex = resolveUrl
      ? KATEX_CSS.replace(/url\((\/katex\/fonts\/[^)]+)\)/g, (_m, url: string) =>
          `url(${resolveUrl(url)})`,
        )
      : KATEX_CSS;
    rules.push("/* maths */", katex);
  }

  // --- tokens -------------------------------------------------------------
  rules.push(`/* tokens */
:root {
  --doc-font-body: ${fontStack(bodyFont)};
  --doc-font-heading: ${fontStack(headingFont)};
  --doc-font-mono: ${fontStack(monoFont)};
  --doc-size-base: ${num(type.baseFontSize)}pt;
  --doc-leading: ${num(type.lineHeight)};
  --doc-para-gap: ${num(type.paragraphSpacing)}em;

  --doc-page-bg: ${theme.pageBackground};
  --doc-text: ${theme.text};
  --doc-heading: ${theme.heading};
  --doc-muted: ${theme.muted};
  --doc-link: ${theme.link};
  --doc-accent: ${theme.accent};
  --doc-border: ${theme.border};
  --doc-code-bg: ${theme.codeBackground};
}`);

  // --- page ---------------------------------------------------------------
  const boxes = [
    ...marginBoxes(config.header, "top", context),
    ...marginBoxes(config.footer, "bottom", context),
  ];

  rules.push(`/* page */
@page {
  size: ${num(size.width, 2)}mm ${num(size.height, 2)}mm;
  margin: ${num(page.margins.top, 2)}mm ${num(page.margins.right, 2)}mm ${num(page.margins.bottom, 2)}mm ${num(page.margins.left, 2)}mm;
${boxes.join("\n")}
}`);

  if (structure.startPageNumber !== 1) {
    rules.push(`@page :first { counter-reset: page ${structure.startPageNumber - 1}; }`);
  }

  const suppressFirst: string[] = [];
  if (config.header.enabled && !config.header.showOnFirstPage) {
    suppressFirst.push(
      "  @top-left { content: none; }",
      "  @top-center { content: none; }",
      "  @top-right { content: none; }",
    );
  }
  if (config.footer.enabled && !config.footer.showOnFirstPage) {
    suppressFirst.push(
      "  @bottom-left { content: none; }",
      "  @bottom-center { content: none; }",
      "  @bottom-right { content: none; }",
    );
  }
  if (suppressFirst.length > 0) {
    rules.push(`@page :first {\n${suppressFirst.join("\n")}\n}`);
  }

  // --- base ---------------------------------------------------------------
  rules.push(`/* base */
* { box-sizing: border-box; }

html {
  font-size: var(--doc-size-base);
  background: var(--doc-page-bg);
}

@page { background: var(--doc-page-bg); }

body {
  margin: 0;
  padding: 0;
  background: var(--doc-page-bg);
  color: var(--doc-text);
  font-family: var(--doc-font-body);
  font-size: 1rem;
  line-height: var(--doc-leading);
  letter-spacing: ${num(type.letterSpacing)}em;
  text-align: ${type.align === "justify" ? "justify" : "left"};
  hyphens: ${type.hyphenate ? "auto" : "manual"};
  -webkit-hyphens: ${type.hyphenate ? "auto" : "manual"};
  widows: ${structure.widows};
  orphans: ${structure.orphans};
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  font-variant-numeric: tabular-nums;
}`);

  // Screen fallback.
  //
  // Every margin in this stylesheet lives in `@page`, which only applies once
  // the document is actually paginated - when printing, or once Paged.js has
  // laid it out. In a plain scrolling preview `@page` is inert, so the text
  // would run to the very edge of the viewport with no margin at all.
  //
  // Mirroring the page box here makes the unpaginated preview look like the
  // page it will become. Paged.js adds `.paginated` to the root element before
  // it lays out, which switches the whole block off so the two never both
  // apply and double the margins.
  rules.push(`/* screen fallback - superseded by Paged.js pagination */
@media screen {
  :root:not(.paginated) {
    /* A neutral desk shade derived from the page colour, so this works for a
       dark page as well as a white one. */
    background: color-mix(in srgb, var(--doc-page-bg) 86%, #808080);
    padding: 24px 16px;
  }

  :root:not(.paginated) body {
    max-width: ${num(size.width, 2)}mm;
    min-height: ${num(size.height, 2)}mm;
    margin: 0 auto;
    padding: ${num(page.margins.top, 2)}mm ${num(page.margins.right, 2)}mm ${num(page.margins.bottom, 2)}mm ${num(page.margins.left, 2)}mm;
    box-shadow: 0 1px 3px rgb(0 0 0 / 12%), 0 8px 24px rgb(0 0 0 / 8%);
  }
}`);

  // Paged.js marks every element it splits across a page with
  // data-align-last-split-element="justify", so the visible last line of a
  // fragment stays justified. That is correct in itself, but text-align-last is
  // an *inherited* property and the body wrapper is split on every page - so the
  // marker leaks down and force-justifies the last line of every paragraph,
  // heading and table cell in the document. A two-word paragraph came out
  // stretched across the full measure.
  //
  // Re-assert the default on elements that actually hold text. Paged.js's own
  // attribute rule is more specific, so genuinely split elements keep their
  // justified fragment.
  rules.push(`/* undo Paged.js's inherited text-align-last */
p, li, dd, dt, blockquote, figcaption, td, th, pre, figure,
h1, h2, h3, h4, h5, h6 {
  text-align-last: auto;
}`);

  if (type.measure !== null) {
    rules.push(`.doc-body { max-width: ${num(type.measure, 2)}mm; margin-inline: auto; }`);
  }

  if (structure.columns === 2) {
    rules.push(`.doc-body {
  column-count: 2;
  column-gap: ${num(structure.columnGap, 2)}mm;
}
.doc-body h1, .doc-body h2 { column-span: all; }`);
  }

  // --- headings -----------------------------------------------------------
  const headingRules = Object.entries(headingSizes)
    .map(([tag, scale]) => `${tag} { font-size: ${num(scale)}em; }`)
    .join("\n");

  rules.push(`/* headings */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--doc-font-heading);
  font-weight: ${type.headingWeight};
  color: var(--doc-heading);
  line-height: 1.25;
  margin: 1.5em 0 0.5em;
  letter-spacing: -0.005em;
  /* A heading alone at the foot of a page is the single ugliest thing a
     paginator can do. Never allow it. */
  break-after: avoid-page;
  page-break-after: avoid;
  break-inside: avoid-page;
  text-align: left;
  hyphens: none;
}

h1:first-child, h2:first-child { margin-top: 0; }

${headingRules}

/* Running-head sources. {section} follows h1 and {subsection} follows h2.
   Having both write the same string made the head show whichever came last,
   so a page opening on a new h1 still displayed the previous h2. */
h1 { string-set: section-title content(text); }
h2 { string-set: subsection-title content(text); }

.heading-number {
  color: var(--doc-muted);
  font-variant-numeric: tabular-nums;
  /* The gap is mostly a real space in the markup, so content(text) picks it up
     and a running head reads "3.2 District variation" rather than
     "3.2District variation". This only adds a little air on top. */
  margin-right: 0.15em;
  font-weight: inherit;
}`);

  if (theme.headingRules !== "none") {
    const selector = theme.headingRules === "h1" ? "h1" : "h1, h2";
    rules.push(`${selector} {
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--doc-border);
}`);
  }

  if (structure.pageBreakBefore !== "none") {
    rules.push(`${structure.pageBreakBefore} {
  break-before: page;
  page-break-before: always;
}
${structure.pageBreakBefore}:first-child {
  break-before: avoid;
  page-break-before: avoid;
}`);
  }

  // --- flow content -------------------------------------------------------
  rules.push(`/* flow */
p, ul, ol, dl, blockquote, table, pre, figure, .callout {
  margin: 0 0 var(--doc-para-gap);
}

ul, ol { padding-left: 1.6em; }
li { margin-bottom: 0.25em; }
li > ul, li > ol { margin: 0.25em 0 0; }

li.task-list-item { list-style: none; margin-left: -1.6em; padding-left: 1.6em; }
li.task-list-item input { margin-right: 0.5em; }

hr {
  border: 0;
  border-top: 1px solid var(--doc-border);
  margin: 2em 0;
}

.page-break {
  break-after: page;
  page-break-after: always;
  height: 0;
}

sub, sup { line-height: 0; }
abbr[title] { text-decoration: underline dotted; }
mark { background: color-mix(in srgb, var(--doc-accent) 22%, transparent); }`);

  // --- links --------------------------------------------------------------
  const linkRules: Record<DocumentConfig["theme"]["linkStyle"], string> = {
    colour: "a { color: var(--doc-link); text-decoration: none; }",
    underline:
      "a { color: inherit; text-decoration: underline; text-underline-offset: 0.15em; }",
    plain: "a { color: inherit; text-decoration: none; }",
    footnote: `a { color: inherit; text-decoration: underline; text-underline-offset: 0.15em; }
/* On paper a hyperlink is dead ink, so print the target next to it. Internal
   anchors and mailto: are skipped - the first is meaningless on paper and the
   second already reads as an address. */
a[href^="http"]::after {
  /* The separating space is a margin, not part of the content string: CSS
     collapses leading whitespace in generated content, so " (" renders flush
     against the link text. */
  content: "(" attr(href) ")";
  margin-left: 0.3em;
  font-size: 0.82em;
  color: var(--doc-muted);
  word-break: break-all;
}`,
  };
  rules.push(`/* links */\n${linkRules[theme.linkStyle]}`);

  // --- code ---------------------------------------------------------------
  rules.push(`/* code */
code, kbd, samp, pre {
  font-family: var(--doc-font-mono);
  font-size: ${num(type.codeFontScale)}em;
  font-variant-ligatures: none;
}

:not(pre) > code {
  background: var(--doc-code-bg);
  border: 1px solid color-mix(in srgb, var(--doc-border) 60%, transparent);
  border-radius: 4px;
  padding: 0.12em 0.35em;
  white-space: break-spaces;
}

pre {
  background: var(--doc-code-bg);
  border: 1px solid var(--doc-border);
  border-radius: 6px;
  padding: 0.85em 1em;
  line-height: 1.45;
  overflow: visible;
  /* text-align is inherited, so a justified body would stretch the spaces in
     wrapped code lines and destroy the alignment the author wrote. */
  text-align: left;
  hyphens: none;
  ${
    type.wrapCode
      ? "white-space: pre-wrap;\n  overflow-wrap: break-word;\n  word-break: break-word;"
      : "white-space: pre;\n  overflow-x: hidden;"
  }
}

pre > code {
  background: none;
  border: 0;
  padding: 0;
  font-size: inherit;
  /* highlight.js themes set their own background on .hljs; the page decides
     that, not the theme. */
  background-color: transparent !important;
}`);

  // --- tables -------------------------------------------------------------
  const tableStyles: Record<DocumentConfig["theme"]["tableStyle"], string> = {
    grid: `th, td { border: 1px solid var(--doc-border); }
thead th { background: color-mix(in srgb, var(--doc-accent) 8%, var(--doc-code-bg)); }`,
    zebra: `th, td { border: 1px solid var(--doc-border); }
thead th { background: color-mix(in srgb, var(--doc-accent) 8%, var(--doc-code-bg)); }
tbody tr:nth-child(2n) { background: var(--doc-code-bg); }`,
    horizontal: `th, td { border: 0; border-bottom: 1px solid var(--doc-border); }
thead th { border-bottom: 2px solid var(--doc-accent); background: none; }
tbody tr:last-child td { border-bottom: 0; }`,
    minimal: `th, td { border: 0; }
thead th { border-bottom: 1px solid var(--doc-border); background: none; }`,
  };

  rules.push(`/* tables */
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.94em;
  /* A table split across a page break must repeat its header, or the second
     half is unreadable. */
  break-inside: auto;
}

thead { display: table-header-group; }
tfoot { display: table-footer-group; }
tr { break-inside: avoid; page-break-inside: avoid; }

th, td {
  padding: 0.45em 0.7em;
  text-align: left;
  vertical-align: top;
  hyphens: none;
}

th { font-weight: 600; color: var(--doc-heading); }

td[align="right"], th[align="right"] { text-align: right; }
td[align="center"], th[align="center"] { text-align: center; }

${tableStyles[theme.tableStyle]}`);

  // --- quotes -------------------------------------------------------------
  const quoteStyles: Record<DocumentConfig["theme"]["quoteStyle"], string> = {
    bar: `blockquote {
  padding: 0.1em 0 0.1em 1em;
  border-left: 3px solid var(--doc-border);
  color: var(--doc-muted);
}`,
    "bar-tinted": `blockquote {
  padding: 0.7em 1em;
  border-left: 3px solid var(--doc-accent);
  background: color-mix(in srgb, var(--doc-accent) 5%, transparent);
  color: var(--doc-text);
  border-radius: 0 4px 4px 0;
}`,
    indent: `blockquote {
  padding: 0 0 0 1.8em;
  border: 0;
  color: var(--doc-text);
}`,
    italic: `blockquote {
  padding: 0 1.6em;
  border: 0;
  font-style: italic;
  color: var(--doc-text);
}`,
  };
  rules.push(`/* quotes */
${quoteStyles[theme.quoteStyle]}
blockquote > :last-child { margin-bottom: 0; }`);

  // --- callouts -----------------------------------------------------------
  rules.push(`/* callouts */
.callout {
  padding: 0.75em 1em;
  border-left: 3px solid var(--doc-accent);
  border-radius: 0 4px 4px 0;
  background: color-mix(in srgb, var(--doc-accent) 6%, transparent);
}

.callout > :last-child { margin-bottom: 0; }

.callout-title {
  font-weight: 650;
  font-family: var(--doc-font-heading);
  color: var(--doc-accent);
  margin-bottom: 0.35em;
  font-size: 0.94em;
  letter-spacing: 0.01em;
}

.callout-warning, .callout-caution, .callout-danger { --doc-accent: #b45309; }
.callout-important { --doc-accent: #7c3aed; }
.callout-tip, .callout-success { --doc-accent: #15803d; }
.callout-example, .callout-quote { --doc-accent: var(--doc-muted); }`);

  // --- figures and images -------------------------------------------------
  rules.push(`/* figures */
img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}

figure { margin: 0 0 var(--doc-para-gap); text-align: center; }

figcaption {
  font-size: 0.88em;
  color: var(--doc-muted);
  margin-top: 0.5em;
  text-align: center;
  hyphens: none;
}`);

  // --- cover --------------------------------------------------------------
  if (config.cover.enabled) {
    // A named page, so the cover never inherits running heads or a page number.
    // Setting `content: none` on every margin box is the only reliable way:
    // @page :first would also match the first content page in documents where
    // the cover is switched off.
    rules.push(`/* cover */
@page cover {
  margin: ${num(page.margins.top, 2)}mm ${num(page.margins.right, 2)}mm ${num(page.margins.bottom, 2)}mm ${num(page.margins.left, 2)}mm;
  @top-left { content: none; }
  @top-center { content: none; }
  @top-right { content: none; }
  @bottom-left { content: none; }
  @bottom-center { content: none; }
  @bottom-right { content: none; }
}

.cover {
  page: cover;
  break-after: page;
  page-break-after: always;
  display: flex;
  flex-direction: column;
  /* Paged.js gives the page box a definite height, so a full-height cover can
     distribute its blocks vertically instead of piling up at the top. */
  min-height: 100%;
  text-align: left;
  hyphens: none;
}

.cover-logo {
  display: block;
  margin: 0 0 auto;
  max-width: 100%;
  height: auto;
}

.cover-headline { margin-top: auto; }

.cover-organisation {
  font-family: var(--doc-font-heading);
  font-size: 0.95em;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--doc-accent);
  margin-bottom: 1.2em;
}

.cover-title {
  font-family: var(--doc-font-heading);
  font-size: ${num(s ** 4, 3)}em;
  font-weight: ${type.headingWeight};
  line-height: 1.12;
  letter-spacing: -0.015em;
  color: var(--doc-heading);
  text-wrap: balance;
}

.cover-subtitle {
  font-family: var(--doc-font-heading);
  font-size: ${num(s, 3)}em;
  font-weight: 400;
  line-height: 1.3;
  color: var(--doc-muted);
  margin-top: 0.6em;
  text-wrap: balance;
}

.cover-abstract {
  margin-top: 2.4em;
  padding-top: 1.4em;
  border-top: 1px solid var(--doc-border);
  max-width: 34em;
  color: var(--doc-text);
}

.cover-abstract p { margin: 0 0 0.8em; }
.cover-abstract p:last-child { margin-bottom: 0; }

.cover-meta {
  margin-top: auto;
  padding-top: 2em;
  font-family: var(--doc-font-heading);
  font-size: 0.95em;
  color: var(--doc-muted);
  display: flex;
  flex-wrap: wrap;
  gap: 0.4em 2em;
}

.cover-author { color: var(--doc-text); font-weight: 500; }

/* --- layouts --- */

.cover-centred { text-align: center; align-items: center; }
.cover-centred .cover-abstract { text-align: left; }
.cover-centred .cover-meta { justify-content: center; }
.cover-centred .cover-logo { margin-inline: auto; }

.cover-banner .cover-headline {
  margin-top: 0;
  padding: 1.6em 0 1.4em;
  border-top: 4px solid var(--doc-accent);
  border-bottom: 1px solid var(--doc-border);
}
.cover-banner .cover-abstract { border-top: 0; padding-top: 0; }

.cover-minimal .cover-title { font-size: ${num(s ** 2, 3)}em; }
.cover-minimal .cover-organisation { color: var(--doc-muted); }
.cover-minimal .cover-abstract { border-top: 0; padding-top: 0; }`);
  }

  // --- table of contents --------------------------------------------------
  if (config.toc.enabled) {
    const toc = config.toc;

    rules.push(`/* contents */
.toc {
  ${toc.breakAfter ? "break-after: page; page-break-after: always;" : ""}
  hyphens: none;
  text-align: left;
}

.toc-title {
  font-family: var(--doc-font-heading);
  font-size: ${num(s ** 2, 3)}em;
  font-weight: ${type.headingWeight};
  color: var(--doc-heading);
  line-height: 1.25;
  margin: 0 0 1.2em;
}

.toc-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.toc-entry {
  margin: 0 0 0.35em;
  /* An entry split across a page break is unreadable on both halves. */
  break-inside: avoid;
}

.toc-entry a {
  display: flex;
  align-items: baseline;
  gap: 0.5em;
  text-decoration: none;
  color: var(--doc-text);
}

/* The page number. Only the layout engine knows it, so it is resolved from the
   link target after pagination rather than written into the markup. */
.toc-entry a::after {
  content: target-counter(attr(href), page);
  font-variant-numeric: tabular-nums;
  color: var(--doc-muted);
  white-space: nowrap;
}

.toc-number {
  font-variant-numeric: tabular-nums;
  color: var(--doc-muted);
  flex: none;
}

.toc-text { flex: none; }

.toc-leader {
  flex: 1 1 auto;
  min-width: 1.5em;
  align-self: stretch;
  ${
    toc.dotLeaders
      ? "border-bottom: 1px dotted var(--doc-border); margin-bottom: 0.28em;"
      : ""
  }
}

${
  toc.pageNumbers
    ? ""
    : ".toc-entry a::after { content: none; } .toc-leader { border-bottom: 0; }"
}

/* Depth is expressed as indentation and weight, not as nested lists - a flat
   list keeps every page number on the same right-hand edge. */
.toc-level-1 { font-weight: 600; margin-top: 0.9em; }
.toc-level-1:first-child { margin-top: 0; }
.toc-level-2 { padding-left: 1.4em; }
.toc-level-3 { padding-left: 2.8em; font-size: 0.95em; }
.toc-level-4 { padding-left: 4.2em; font-size: 0.95em; }
.toc-level-5,
.toc-level-6 { padding-left: 5.6em; font-size: 0.92em; }`);
  }

  // --- footnotes ----------------------------------------------------------
  rules.push(`/* footnotes */
.footnotes {
  font-size: 0.88em;
  color: var(--doc-muted);
  border-top: 1px solid var(--doc-border);
  margin-top: 2.5em;
  padding-top: 1em;
}
.footnotes h2 { font-size: 1em; margin: 0 0 0.5em; }
[data-footnote-ref] { text-decoration: none; }`);

  // --- break control ------------------------------------------------------
  const breakSelectors: Record<string, string> = {
    code: "pre",
    table: "table",
    figure: "figure, img",
    blockquote: "blockquote",
    list: "ul, ol",
    callout: ".callout",
  };
  const avoid = structure.avoidBreakInside
    .map((key) => breakSelectors[key])
    .filter((selector): selector is string => Boolean(selector));

  if (avoid.length > 0) {
    rules.push(`/* keep together across page breaks */
${avoid.join(",\n")} {
  break-inside: avoid;
  page-break-inside: avoid;
}`);
  }

  // --- watermark ----------------------------------------------------------
  if (watermark.enabled && watermark.text.trim() !== "") {
    rules.push(`/* watermark - drawn per paginated page, so it needs Paged.js */
.pagedjs_page_content { position: relative; }

.pagedjs_page::after {
  content: ${cssString(watermark.text)};
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(${num(watermark.rotation)}deg);
  font-family: var(--doc-font-heading);
  font-size: ${num(watermark.fontSize)}pt;
  font-weight: 700;
  color: ${watermark.colour};
  opacity: ${num(watermark.opacity)};
  white-space: nowrap;
  pointer-events: none;
  z-index: 1000;
}`);
  }

  return rules.filter(Boolean).join("\n\n");
}
