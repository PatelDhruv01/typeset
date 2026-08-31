import { defaultSchema } from "hast-util-sanitize";
import type { Schema } from "hast-util-sanitize";

/**
 * Sanitisation policy for raw HTML embedded in Markdown.
 *
 * Markdown here can arrive from a pasted document, an uploaded file, or (once
 * the API exists) an arbitrary HTTP client, and the result is rendered inside a
 * browser. So the allowlist is the real security boundary, not a formality.
 *
 * What it refuses, unconditionally:
 *   - script, iframe, object, embed, form, input - anything that executes or
 *     phones home
 *   - every `on*` event handler attribute
 *   - javascript: and vbscript: URLs, via the protocol allowlist below
 *
 * What it deliberately keeps, unlike the default schema:
 *   - `className` everywhere. remark-math marks maths with
 *     `class="math-inline"` *before* rehype-katex converts it, so stripping
 *     class here silently breaks every equation in the document.
 *   - `id`, so heading anchors and footnote links survive.
 *   - table `colspan` / `rowspan` / `align`, which real documents use.
 *
 * `style` is allowed only in "allow" mode. It cannot execute code in a modern
 * browser, but it can position elements arbitrarily, and that is not something
 * to hand to untrusted input by default.
 */

const BASE_ATTRIBUTES = defaultSchema.attributes ?? {};

function withStyle(allowStyle: boolean): string[] {
  return allowStyle ? ["style"] : [];
}

export function buildSanitizeSchema(mode: "sanitise" | "allow"): Schema {
  const allowStyle = mode === "allow";

  return {
    ...defaultSchema,

    // Anything not listed here is unwrapped: its children survive, the element
    // does not. That is the right failure mode for a document renderer.
    tagNames: [
      ...(defaultSchema.tagNames ?? []),
      "figure",
      "figcaption",
      "mark",
      "abbr",
      "kbd",
      "samp",
      "var",
      "small",
      "sub",
      "sup",
      "details",
      "summary",
      "section",
      "aside",
      "u",
      "s",
      "time",
      "wbr",
      "colgroup",
      "col",
      "caption",
    ],

    attributes: {
      ...BASE_ATTRIBUTES,
      "*": [
        ...(BASE_ATTRIBUTES["*"] ?? []),
        "className",
        "id",
        "title",
        "lang",
        "dir",
        ...withStyle(allowStyle),
      ],
      a: [...(BASE_ATTRIBUTES.a ?? []), "href", "target", "rel"],
      img: [
        ...(BASE_ATTRIBUTES.img ?? []),
        "src",
        "alt",
        "width",
        "height",
        "loading",
      ],
      td: [...(BASE_ATTRIBUTES.td ?? []), "colSpan", "rowSpan", "align"],
      th: [...(BASE_ATTRIBUTES.th ?? []), "colSpan", "rowSpan", "align", "scope"],
      col: ["span", "width"],
      colgroup: ["span"],
      time: ["dateTime"],
      details: ["open"],
      input: ["type", "checked", "disabled"],
    },

    // Task-list checkboxes are the only input we ever emit, and remark-gfm
    // already renders them disabled.
    required: {
      ...defaultSchema.required,
      input: { type: "checkbox", disabled: true },
    },

    protocols: {
      ...defaultSchema.protocols,
      href: ["http", "https", "mailto", "tel", "#"],
      src: ["http", "https", "data"],
    },

    // Class values are checked per element. `false` here would drop them all;
    // listing the wildcard keeps any class, which is what maths, syntax
    // highlighting and callouts all need.
    clobber: ["name", "id"],
    clobberPrefix: "user-content-",
  };
}
