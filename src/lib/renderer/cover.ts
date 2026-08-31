import type { CoverConfig } from "@/lib/config/schema";

/**
 * The cover page.
 *
 * Built as markup rather than folded into the Markdown, because a cover is
 * document metadata, not content: it must not appear in the table of contents,
 * must not be numbered as a section, and must not become the running head. Note
 * the title is a `div`, not an `h1` - an `h1` here would set `section-title` and
 * make every page of chapter one carry the document title as its running head.
 */

export type CoverContext = {
  title: string;
  subtitle: string;
  author: string;
  date: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Blank-line-separated plain text to paragraphs. The abstract is not Markdown. */
function toParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, " ")}</p>`)
    .join("\n");
}

function line(className: string, value: string): string {
  return value.trim() === ""
    ? ""
    : `<div class="${className}">${escapeHtml(value.trim())}</div>`;
}

/**
 * Returns the cover markup, or an empty string when there is nothing to show.
 *
 * A cover with no title is worse than no cover: it prints a blank sheet the user
 * then has to explain. Configured fields win; anything left null falls back to
 * what the document and the render context already worked out.
 */
export function renderCover(
  cover: CoverConfig,
  context: CoverContext,
): string {
  if (!cover.enabled) return "";

  const title = cover.title ?? context.title;
  const subtitle = cover.subtitle ?? context.subtitle;
  const author = cover.author ?? context.author;
  const organisation = cover.organisation ?? "";
  const date = cover.date ?? context.date;

  if (title.trim() === "") return "";

  const logo =
    cover.logo && cover.logo.trim() !== ""
      ? `<img class="cover-logo" src="${escapeHtml(cover.logo)}" alt="" style="width:${cover.logoWidth}mm">`
      : "";

  const meta = [
    line("cover-author", author),
    line("cover-date", date),
  ]
    .filter(Boolean)
    .join("\n");

  const abstract =
    cover.abstract.trim() === ""
      ? ""
      : `<div class="cover-abstract">${toParagraphs(cover.abstract)}</div>`;

  return [
    `<section class="cover cover-${cover.layout}">`,
    logo,
    '<div class="cover-headline">',
    line("cover-organisation", organisation),
    `<div class="cover-title">${escapeHtml(title.trim())}</div>`,
    line("cover-subtitle", subtitle),
    "</div>",
    abstract,
    meta ? `<div class="cover-meta">\n${meta}\n</div>` : "",
    "</section>",
  ]
    .filter(Boolean)
    .join("\n");
}
