/**
 * The characters chatbots actually put in their answers, gathered from real
 * ChatGPT, Claude and Gemini output. Tests render this to prove each one is
 * drawn by a font Typeset ships: the serverless Chromium that prints PDFs has
 * no other font to fall back on, so anything missing here is an empty box in
 * a user's PDF.
 *
 * Chinese, Japanese and Korean are deliberately absent: those fonts are not
 * shipped yet, and the renderer reports their characters as missing instead.
 */
export const CHATBOT_SAMPLE = `# 🚀 Getting started → a quick guide

A typical answer → with ✅ and ❌ marks, ⚠️ warnings, “smart quotes” and ellipses…

## Arrows
→ ← ↑ ↓ ↔ ↕ ⇒ ⇐ ⇔ ⟶ ⟵ ➜ ➔ ➡️ ⬅️ ↳ ↪ ↩ ⤴️ ⤵️ ⇄ ⇅ ↗ ↘

## Checks and crosses
✓ ✔ ✔️ ✗ ✘ ✕ ✖ ☐ ☑ ☒ ✅ ❌ ❎ ⭕ 🚫

## Emoji
⚠️ 🚀 💡 📌 🔥 👉 🎯 📊 ✨ ⭐ 🔍 📝 👍 👍🏽 🇮🇳 👨‍💻 👩🏾‍🔬 1️⃣ #️⃣ 🟢 🟡 🔴 ℹ️ ❗ ❓ 💯 🤖 🧠 👪

## Bullets and shapes
• ◦ ▪ ▫ ▸ ▹ ► ▶ ● ○ ■ □ ◆ ◇ ★ ☆ ♦ ♥ ◉ ◎ ▲ ▼ △ ▽

## Maths and units
≤ ≥ ≠ ≈ ≡ ± × ÷ ∞ √ ∑ ∏ ∫ ∂ ∆ ∇ π λ μ σ θ Ω ° ∈ ∉ ⊂ ⊆ ∪ ∩ ∀ ∃ ¬ ∧ ∨ ⊕ ∝ ‰ ′ ″

## Typography
— – … § ¶ † ‡ ™ © ® x² x³ ¹ ⁿ ½ ¼ ¾ ₹ € £ ¥ ¢ «quotes»

## Keys and misc
⌘ ⌥ ⇧ ⏎ ⌫ ⎋ ⇥ ① ② ③ ⓘ ♪ ☀ ☁ ⚡ ☕ ⏱ ⏳ ⌛ ✎ ✉ ☎ ⚙

## Scripts
नमस्ते · નમસ્તે · নমস্কার · ਸਤ ਸ੍ਰੀ ਅਕਾਲ · வணக்கம் · నమస్కారం · ನಮಸ್ಕಾರ · നമസ്കാരം · ନମସ୍କାର · مرحبا · שלום · สวัสดี · αβγδ · Привет · Tiếng Việt

\`\`\`text
project/
├── src/
│   ├── index.ts      → entry point ✓
│   └── utils.ts      ✗ deprecated
└── README.md
╔══════╗
║ box  ║
╚══════╝
▁▂▃▄▅▆▇█ ░▒▓
\`\`\`

Inline code: \`a → b\`, \`✓ done\`, \`├──\`, \`🚀 ship\`.

| Feature | Status | Note |
| --- | :---: | --- |
| Arrows | ✅ | → ⇒ |
| Emoji | ❌ | 🚀 |
| Ticks | ✔️ | ✓ ✗ |

> ⚠️ **Warning:** quotes → also need symbols ✓
`;
