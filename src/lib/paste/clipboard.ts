import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

/**
 * Clipboard -> Markdown.
 *
 * The app exists to turn chatbot answers into PDFs, and how an answer reaches
 * the clipboard decides what survives:
 *
 *   - The chat app's own Copy button puts Markdown on the clipboard as plain
 *     text. That is the author's source - use it as it is.
 *   - Selecting the answer and pressing Ctrl+C puts *rendered* HTML on the
 *     clipboard, and a plain-text version with every heading, table, code
 *     fence and formula flattened away. Pasting that text loses the document,
 *     so the HTML is converted back to Markdown instead.
 *
 * Chat UIs wrap their output in furniture that must not end up in a PDF:
 * "Copy code" buttons, language labels above code blocks, icon ligatures
 * ("content_copy"), KaTeX's duplicated visual markup, and ChatGPT's private-use
 * citation markers. Each is removed here, and maths is recovered from KaTeX's
 * TeX annotation so it renders as maths again.
 */

// ---------------------------------------------------------------------------
// Plain text
// ---------------------------------------------------------------------------

/** ChatGPT's inline citations: U+E200 "cite" U+E202 "turn0search1" ... U+E201. */
const CITATION_MARKER = /[^]{0,400}/g;
/** Any private-use character left over, which no font can draw anyway. */
const PRIVATE_USE = /[-]/g;
/** Older ChatGPT browsing citations: 【4†source】, 【7:0†report.pdf】. */
const BRACKET_CITATION = /【[^】\n]{0,80}†[^】\n]{0,120}】/g;

/** True when plain text carries chatbot artefacts worth cleaning on paste. */
export function hasChatbotArtefacts(text: string): boolean {
  return /[-]|【[^】\n]{0,80}†/.test(text);
}

/** Removes chatbot artefacts that would otherwise print as boxes or noise. */
export function cleanChatbotText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(CITATION_MARKER, "")
    .replace(BRACKET_CITATION, "")
    .replace(PRIVATE_USE, "")
    .replace(/[ \t]+\n/g, (match) => (match.startsWith("  ") ? "  \n" : "\n"))
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * Plain text that is already Markdown, judged by syntax that only an author
 * writes - a rendered page's text never contains `## ` or a table rule.
 */
const MARKDOWN_SIGNALS: readonly RegExp[] = [
  /^#{1,6}\s+\S/m,
  /^\s*(?:```|~~~)/m,
  /\*\*[^*\n]+\*\*/,
  /^\s*\|.*\|\s*\n\s*\|?\s*:?-{3,}/m,
  /\[[^\]\n]+\]\((?:https?:|mailto:|#|\/)[^)\s]*\)/,
  /^\s*[-*+]\s+\[[ xX]\]\s/m,
  /^\s*>\s+\S/m,
  /\$\$[\s\S]+?\$\$/,
];

export function looksLikeMarkdown(text: string): boolean {
  return MARKDOWN_SIGNALS.some((pattern) => pattern.test(text));
}

/**
 * HTML worth converting: real document structure, not the coloured spans a
 * code editor puts on the clipboard (VS Code pastes <div>s and <span>s only).
 */
export function hasRichStructure(html: string): boolean {
  return /<(?:h[1-6]|ul|ol|li|table|pre|blockquote|strong|b|em|i|code|hr)\b/i.test(html);
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

type TurndownNode = TurndownService.Node;

function classOf(node: Element): string {
  return node.getAttribute?.("class") ?? "";
}

function hasClass(node: Element, name: string): boolean {
  return classOf(node).split(/\s+/).includes(name);
}

function isElement(node: Node | null): node is Element {
  return Boolean(node && node.nodeType === 1);
}

function languageFromClass(node: Element | null): string | null {
  if (!node) return null;
  const match = /(?:^|\s)(?:language|lang|hljs-lang)-([\w#+.-]+)/.exec(classOf(node));
  return match?.[1]?.toLowerCase() ?? null;
}

const HEADER_TEXT =
  /^(?:copy(?: code)?|[\w#+.-]{1,24}(?:\s*(?:copy(?: code)?|content_copy|download|edit|run))*)$/i;

const STRUCTURAL = "pre, p, ul, ol, table, blockquote, h1, h2, h3, h4, h5, h6";

/** The <pre> that `node` sits directly above, within a few siblings. */
function followingPre(node: Element): Element | null {
  let sibling = node.nextElementSibling;
  for (let step = 0; sibling && step < 3; step += 1) {
    if (sibling.nodeName === "PRE") return sibling;
    const nested = sibling.querySelector?.("pre");
    if (nested) return nested;
    sibling = sibling.nextElementSibling;
  }
  return null;
}

/**
 * A code block's title bar in a chat UI: a short label such as "python" or
 * "Python content_copy", in a div or span, immediately above the code. Real
 * prose before a code block is a <p>, so it never matches.
 */
function isCodeHeader(node: Element): boolean {
  if (node.nodeName !== "DIV" && node.nodeName !== "SPAN") return false;
  if (node.querySelector?.(STRUCTURAL)) return false;
  const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
  if (text === "" || text.length > 48) return false;
  return HEADER_TEXT.test(text) && followingPre(node) !== null;
}

/** The language named by a chat UI's title bar above `pre`, if there is one. */
function headerLanguage(pre: Element): string | null {
  let level: Element | null = pre;
  for (let depth = 0; level && depth < 4; depth += 1) {
    let sibling = level.previousElementSibling;
    for (let step = 0; sibling && step < 3; step += 1) {
      if (isElement(sibling) && isCodeHeader(sibling)) {
        const word = (sibling.textContent ?? "").trim().split(/\s+/)[0] ?? "";
        const language = word.replace(/content_copy$/i, "").toLowerCase();
        return /^[\w#+.-]{1,24}$/.test(language) && !/^copy/.test(language)
          ? language
          : null;
      }
      sibling = sibling.previousElementSibling;
    }
    level = level.parentElement;
  }
  return null;
}

function texOf(node: Element): string | null {
  const annotation = node.querySelector?.('annotation[encoding="application/x-tex"]');
  const tex = annotation?.textContent ?? node.getAttribute?.("data-math") ?? null;
  return tex?.trim() || null;
}

function isDisplayMath(node: Element): boolean {
  const parent = node.parentElement;
  return (
    hasClass(node, "katex-display") ||
    (parent !== null && hasClass(parent, "katex-display")) ||
    /\bmath-(?:block|display)\b/.test(classOf(node)) ||
    node.querySelector?.('math[display="block"]') != null
  );
}

let service: TurndownService | null = null;

function converter(): TurndownService {
  if (service) return service;

  const turndown = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    fence: "```",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
  });

  turndown.use(gfm);

  // Stock Turndown pads every marker to four columns ("-   item"). Valid, but
  // it is not how anyone writes Markdown, and the user edits this text next.
  // Continuation lines are indented to the content column, as CommonMark needs
  // for nested lists and multi-paragraph items.
  turndown.addRule("listItem", {
    filter: "li",
    replacement: (content, node, options) => {
      const parent = node.parentNode as Element | null;
      let prefix = `${options.bulletListMarker ?? "-"} `;
      if (parent?.nodeName === "OL") {
        const start = Number(parent.getAttribute("start") ?? 1);
        const index = Array.prototype.indexOf.call(parent.children, node);
        prefix = `${(Number.isFinite(start) ? start : 1) + index}. `;
      }
      const body = content
        .replace(/^\n+/, "")
        .replace(/\n+$/, "\n")
        .replace(/\n(?=.)/g, `\n${" ".repeat(prefix.length)}`);
      const trailing = node.nextSibling && !body.endsWith("\n") ? "\n" : "";
      return `${prefix}${body}${trailing}`;
    },
  });

  // Interface furniture: buttons ("Copy code"), icons, and anything never shown.
  turndown.remove(["button", "script", "style", "noscript", "template", "canvas"]);
  turndown.addRule("icons", {
    filter: (node) => {
      const name = node.nodeName.toLowerCase();
      return (
        name === "svg" ||
        name === "mat-icon" ||
        /\bmaterial-(?:symbols|icons)/.test(classOf(node))
      );
    },
    replacement: () => "",
  });

  turndown.addRule("codeHeader", {
    filter: (node) => isCodeHeader(node),
    replacement: () => "",
  });

  // Every <pre>, wherever its <code> sits. ChatGPT nests the code three divs
  // deep inside the <pre>, next to its own title bar, which the stock rule -
  // "a <pre> whose first child is <code>" - does not recognise.
  turndown.addRule("codeBlock", {
    filter: "pre",
    replacement: (_content, node) => {
      const pre = node as unknown as Element;
      const code = pre.querySelector?.("code") ?? pre;
      const language =
        languageFromClass(code) ??
        languageFromClass(pre) ??
        pre.getAttribute?.("data-language")?.toLowerCase() ??
        headerLanguage(pre) ??
        "";
      const text = (code.textContent ?? "").replace(/\n+$/, "");
      const fence = /^`{3,}/m.test(text) ? "````" : "```";
      return `\n\n${fence}${language}\n${text}\n${fence}\n\n`;
    },
  });

  // KaTeX renders each formula twice - MathML for screen readers, HTML for the
  // eye - and keeps the TeX it came from in an annotation. Taking the TeX
  // turns a formula back into a formula instead of two garbled copies of it.
  turndown.addRule("katex", {
    filter: (node) =>
      (node.nodeName === "SPAN" || node.nodeName === "DIV") &&
      (hasClass(node, "katex") || node.hasAttribute?.("data-math")),
    replacement: (content, node) => {
      const element = node as unknown as Element;
      const tex = texOf(element);
      if (!tex) return content;
      return isDisplayMath(element) ? `\n\n$$\n${tex}\n$$\n\n` : `$${tex}$`;
    },
  });

  // Bare MathML (Gemini, some exports) carries the same annotation.
  turndown.addRule("mathml", {
    filter: (node) => node.nodeName === "MATH",
    replacement: (content, node) => {
      const element = node as unknown as Element;
      const tex = texOf(element);
      if (!tex) return content;
      return element.getAttribute?.("display") === "block"
        ? `\n\n$$\n${tex}\n$$\n\n`
        : `$${tex}$`;
    },
  });

  // Google Docs wraps the whole clipboard in one <b style="font-weight:normal">,
  // which would otherwise make the entire paste bold.
  turndown.addRule("googleDocsWrapper", {
    filter: (node) =>
      node.nodeName === "B" && (node.getAttribute("id") ?? "").startsWith("docs-internal-guid"),
    replacement: (content) => content,
  });

  service = turndown;
  return turndown;
}

export function htmlToMarkdown(html: string): string {
  // Turndown only understands the <body>; Windows clipboard HTML also carries
  // <!--StartFragment--> markers and a <head> of its own.
  const fragment = /<!--StartFragment-->([\s\S]*?)<!--EndFragment-->/.exec(html)?.[1] ?? html;
  const markdown = converter().turndown(fragment as unknown as TurndownNode);
  return cleanChatbotText(markdown).trim();
}

export type ClipboardResult = {
  markdown: string;
  /** True when rich HTML was converted, rather than plain text used as-is. */
  converted: boolean;
};

/**
 * The best Markdown for what is on the clipboard: the plain text when it is
 * already Markdown, the HTML converted when the text is a flattened rendering
 * of a richer document, and the plain text otherwise.
 */
export function clipboardToMarkdown({
  html,
  text,
}: {
  html?: string | null;
  text?: string | null;
}): ClipboardResult {
  const plain = text ?? "";

  if (plain.trim() !== "" && looksLikeMarkdown(plain)) {
    return { markdown: cleanChatbotText(plain), converted: false };
  }

  if (html && hasRichStructure(html)) {
    const markdown = htmlToMarkdown(html);
    if (markdown !== "") return { markdown, converted: true };
  }

  return { markdown: cleanChatbotText(plain), converted: false };
}

/** Reads the system clipboard (asks permission where the browser requires it). */
export async function readClipboard(): Promise<ClipboardResult> {
  if (navigator.clipboard && "read" in navigator.clipboard) {
    try {
      const items = await navigator.clipboard.read();
      let html: string | null = null;
      let text: string | null = null;
      for (const item of items) {
        if (!html && item.types.includes("text/html")) {
          html = await (await item.getType("text/html")).text();
        }
        if (!text && item.types.includes("text/plain")) {
          text = await (await item.getType("text/plain")).text();
        }
      }
      return clipboardToMarkdown({ html, text });
    } catch {
      // Fall through to the text-only API, which more browsers allow.
    }
  }

  const text = await navigator.clipboard.readText();
  return clipboardToMarkdown({ text });
}
