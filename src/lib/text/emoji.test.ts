import { describe, expect, it } from "vitest";

import { findEmoji, splitEmoji, wrapEmojiInHtml } from "@/lib/text/emoji";

describe("findEmoji", () => {
  it("finds characters whose default presentation is emoji", () => {
    expect(findEmoji("done ✅ blocked ❌ fast ⚡")).toEqual(["✅", "❌", "⚡"]);
  });

  it("treats a text-default character as emoji only with U+FE0F", () => {
    expect(findEmoji("⚠️ careful")).toEqual(["⚠️"]);
    expect(findEmoji("⚠ careful")).toEqual([]);
    expect(findEmoji("✔️ and ✔")).toEqual(["✔️"]);
  });

  it("never claims plain arrows, ticks, digits or symbols", () => {
    expect(findEmoji("a → b ✓ ✗ ★ © ® ™ 1 # * ↔ ▶")).toEqual([]);
  });

  it("keeps whole sequences together", () => {
    expect(findEmoji("👩🏾‍🔬 🇮🇳 1️⃣ #️⃣ 👍🏽 🏳️‍🌈 ❤️‍🔥 🏴󠁧󠁢󠁳󠁣󠁴󠁿")).toEqual([
      "👩🏾‍🔬",
      "🇮🇳",
      "1️⃣",
      "#️⃣",
      "👍🏽",
      "🏳️‍🌈",
      "❤️‍🔥",
      "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    ]);
  });
});

describe("splitEmoji", () => {
  it("alternates text and emoji runs, losing nothing", () => {
    const text = "Ship it 🚀 now ✅";
    const runs = splitEmoji(text);
    expect(runs).toEqual([
      { text: "Ship it ", emoji: false },
      { text: "🚀", emoji: true },
      { text: " now ", emoji: false },
      { text: "✅", emoji: true },
    ]);
    expect(runs.map((run) => run.text).join("")).toBe(text);
  });

  it("returns a single text run when there is no emoji", () => {
    expect(splitEmoji("plain → text")).toEqual([{ text: "plain → text", emoji: false }]);
  });
});

describe("wrapEmojiInHtml", () => {
  it("wraps each sequence without touching escaped markup", () => {
    expect(wrapEmojiInHtml("R&amp;D 🚀 &lt;fast&gt; ✅")).toBe(
      'R&amp;D <span class="emoji">🚀</span> &lt;fast&gt; <span class="emoji">✅</span>',
    );
  });
});
