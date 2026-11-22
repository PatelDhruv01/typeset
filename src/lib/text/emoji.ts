/**
 * Finding emoji in text.
 *
 * Emoji are drawn from the colour font Typeset ships, never from whatever the
 * viewer's system happens to have. That font only wins if it is asked first:
 * placed behind the text faces in a font stack, a text symbol font that also
 * has a black-and-white ⚠ would claim "⚠️" before the emoji font got the
 * chance. So every emoji sequence is wrapped in its own span, whose font stack
 * starts with the emoji font.
 *
 * "Emoji sequence" means Unicode's RGI_Emoji: a character whose default
 * presentation is emoji (✅), a text-default character followed by U+FE0F
 * (⚠️), and keycap, flag, tag, skin-tone and ZWJ sequences (1️⃣ 🇮🇳 👩🏾‍🔬).
 * A bare text-default character such as → or ✓ is deliberately *not* an
 * emoji - Unicode says it draws as text, and that is what users see in the
 * chat window they copied it from.
 */

/**
 * Engines with the `v` flag (Node 20+, Chrome 112+, Safari 17+, Firefox 116+)
 * know the exact RGI list and match the longest sequence first.
 */
function exactPattern(): RegExp | null {
  try {
    return new RegExp("\\p{RGI_Emoji}", "gv");
  } catch {
    return null;
  }
}

/**
 * For older browsers, an approximation from properties every Unicode-aware
 * engine has. Only the live preview can ever take this path: the PDF is always
 * rendered by Node, which has the exact pattern.
 */
const APPROXIMATE_PATTERN =
  /\p{Regional_Indicator}{2}|[#*0-9]️?⃣|(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}️)\p{Emoji_Modifier}?️?(?:‍(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}️?)\p{Emoji_Modifier}?️?)*(?:[\u{E0020}-\u{E007E}]+\u{E007F})?/gu;

const EMOJI_PATTERN: RegExp = exactPattern() ?? APPROXIMATE_PATTERN;

/** Every emoji sequence in `text`, in order, duplicates included. */
export function findEmoji(text: string): string[] {
  return text.match(new RegExp(EMOJI_PATTERN)) ?? [];
}

export type TextRun = { text: string; emoji: boolean };

/** `text` cut into alternating runs of plain text and emoji sequences. */
export function splitEmoji(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const pattern = new RegExp(EMOJI_PATTERN);
  let cursor = 0;

  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > cursor) {
      runs.push({ text: text.slice(cursor, match.index), emoji: false });
    }
    runs.push({ text: match[0], emoji: true });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) runs.push({ text: text.slice(cursor), emoji: false });
  return runs;
}

export const EMOJI_CLASS = "emoji";

/**
 * Wraps each emoji sequence in already-escaped HTML text. Only for strings
 * that contain no markup of their own - the cover and the contents page,
 * which are built from plain text rather than from the Markdown tree.
 */
export function wrapEmojiInHtml(escaped: string): string {
  return escaped.replace(
    new RegExp(EMOJI_PATTERN),
    (sequence) => `<span class="${EMOJI_CLASS}">${sequence}</span>`,
  );
}
