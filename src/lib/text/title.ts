/**
 * A document's title, read straight from its Markdown.
 *
 * One rule, shared by the document list, the header, the PDF's metadata and
 * its file name - so the name the app shows is the name the file gets.
 * Chatbot answers rarely open with a `#` heading (they start at `##`, or with
 * a sentence), which is why "first h1" alone left most of them called
 * "document".
 */

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** Markdown inline syntax stripped to readable text. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]+/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cut at a word boundary; "…" only when asked, since file names don't want one. */
export function truncateWords(text: string, max: number, ellipsis = false): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const atWord = cut.slice(0, Math.max(cut.lastIndexOf(" "), Math.floor(max * 0.6))).trimEnd();
  return ellipsis ? `${atWord}…` : atWord;
}

export function stripFrontMatter(source: string): string {
  return source.replace(FRONT_MATTER, "");
}

/** Front matter `title:`, if there is one. */
export function frontMatterTitle(source: string): string | null {
  const block = FRONT_MATTER.exec(source)?.[1];
  if (!block) return null;
  const title = /^title:\s*["']?(.+?)["']?\s*$/m.exec(block)?.[1];
  return title ? plainText(title) || null : null;
}

/** The first heading of any level. */
export function firstHeading(source: string): string | null {
  let fenced = false;
  for (const line of stripFrontMatter(source).split(/\r?\n/)) {
    if (/^\s*(?:```|~~~)/.test(line)) fenced = !fenced;
    if (fenced) continue;
    const heading = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)?.[1];
    if (heading && plainText(heading)) return plainText(heading);
  }
  return null;
}

/** The first line of prose: not a fence, a table row, a rule or a bare marker. */
export function firstLine(source: string): string | null {
  let fenced = false;
  for (const raw of stripFrontMatter(source).split(/\r?\n/)) {
    if (/^\s*(?:```|~~~)/.test(raw)) {
      fenced = !fenced;
      continue;
    }
    if (fenced || /^\s*(?:\||-{3,}|\*{3,}|_{3,}|<)/.test(raw)) continue;
    const text = plainText(raw.replace(/^\s*(?:#{1,6}\s+|[-*+>]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/, ""));
    if (text) return text;
  }
  return null;
}

/** The title shown in the app: front matter, else first heading, else first line. */
export function deriveTitle(source: string): string {
  const title = frontMatterTitle(source) ?? firstHeading(source) ?? firstLine(source);
  return title ? truncateWords(title, 80, true) : "Untitled";
}
