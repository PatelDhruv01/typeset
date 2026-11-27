import { describe, expect, it } from "vitest";

import {
  cleanChatbotText,
  clipboardToMarkdown,
  findClosingOffer,
  hasRichStructure,
  htmlToMarkdown,
  looksLikeMarkdown,
} from "@/lib/paste/clipboard";

/**
 * Trimmed-down copies of what each chat app actually puts on the clipboard
 * when an answer is selected and copied - the shapes that matter, not every
 * Tailwind class.
 */
const CHATGPT = `<div class="markdown prose w-full break-words dark:prose-invert light">
<h3>Setup</h3>
<p>Install it <strong>first</strong> → then run:</p>
<pre class="!overflow-visible"><div class="contain-inline-size rounded-md"><div class="flex items-center text-token-text-secondary px-4 py-2 text-xs font-sans justify-between h-9">bash</div><div class="sticky top-9"><div class="absolute bottom-0 right-2 flex h-9 items-center"><span data-state="closed"><button class="flex gap-1 items-center select-none py-1" aria-label="Copy"><svg width="24" height="24"><path d="M0 0"></path></svg>Copy code</button></span></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span>npm install typeset
</span></code></div></div></pre>
<ul><li>✅ Fast</li><li>❌ Slow</li></ul>
<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>a</td><td>1</td></tr></tbody></table>
<p>Energy: <span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></mrow><annotation encoding="application/x-tex">E = mc^2</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base">E=mc2</span></span></span> holds.</p>
<span class="katex-display"><span class="katex"><span class="katex-mathml"><math display="block"><semantics><mrow></mrow><annotation encoding="application/x-tex">\\int_0^1 x\\,dx</annotation></semantics></math></span><span class="katex-html" aria-hidden="true">∫01xdx</span></span></span>
<p>See the docs.citeturn0search1</p>
</div>`;

const CLAUDE = `<div class="font-claude-message"><p>Here is the code:</p><div class="relative flex flex-col rounded-lg"><div class="text-text-300 absolute pl-3 pt-2.5 text-xs">python</div><div class="pointer-events-none sticky flex items-center justify-end top-0"><div class="pointer-events-auto rounded-md p-0.5"><button class="flex flex-row items-center gap-1 rounded-md p-1 text-xs"><svg></svg><span class="pr-0.5">Copy</span></button></div></div><div><pre class="code-block__code !my-0 !rounded-lg"><code class="language-python"><span>def hello():
</span><span>    print("hi")</span></code></pre></div></div><p>Done.</p></div>`;

const GEMINI = `<message-content><div class="markdown"><p>Example:</p><code-block><div class="code-block"><div class="code-block-decoration header-formatted gds-title-s"><span>Python</span><div class="buttons"><button mat-icon-button=""><mat-icon fonticon="content_copy" class="mat-icon notranslate google-symbols">content_copy</mat-icon></button></div></div><div class="formatted-code-block-internal-container"><div class="animated-opacity"><pre><code role="text" class="code-container formatted">x = 1</code></pre></div></div></div></code-block><p>That's it.</p></div></message-content>`;

describe("htmlToMarkdown", () => {
  describe("ChatGPT", () => {
    const markdown = htmlToMarkdown(CHATGPT);

    it("keeps headings, emphasis and symbols", () => {
      expect(markdown).toContain("### Setup");
      expect(markdown).toContain("Install it **first** → then run:");
    });

    it("recovers the code block and its language, without the title bar", () => {
      expect(markdown).toContain("```bash\nnpm install typeset\n```");
      expect(markdown).not.toMatch(/copy code/i);
      expect(markdown).not.toMatch(/^bash$/m);
    });

    it("keeps lists with their emoji, and tables", () => {
      expect(markdown).toContain("- ✅ Fast");
      expect(markdown).toContain("- ❌ Slow");
      expect(markdown).toMatch(/\| Name \| Value \|\n\| -+ \| -+ \|\n\| a \| 1 \|/);
    });

    it("turns KaTeX back into TeX, inline and display", () => {
      expect(markdown).toContain("Energy: $E = mc^2$ holds.");
      expect(markdown).toContain("$$\n\\int_0^1 x\\,dx\n$$");
      expect(markdown).not.toContain("E=mc2");
    });

    it("drops citation markers", () => {
      expect(markdown).toContain("See the docs.");
      expect(markdown).not.toMatch(/[-]|turn0search/);
    });
  });

  it("handles Claude's code blocks, whose title bar sits outside the <pre>", () => {
    const markdown = htmlToMarkdown(CLAUDE);
    expect(markdown).toBe(
      'Here is the code:\n\n```python\ndef hello():\n    print("hi")\n```\n\nDone.',
    );
  });

  it("handles Gemini's code blocks, taking the language from the title bar", () => {
    const markdown = htmlToMarkdown(GEMINI);
    expect(markdown).toBe("Example:\n\n```python\nx = 1\n```\n\nThat's it.");
  });

  it("reads only the fragment from Windows clipboard HTML", () => {
    const html =
      "<html><body><!--StartFragment--><h2>Hi</h2><p>there</p><!--EndFragment--></body></html>";
    expect(htmlToMarkdown(html)).toBe("## Hi\n\nthere");
  });

  it("does not bold a whole Google Docs paste", () => {
    const html =
      '<b style="font-weight:normal;" id="docs-internal-guid-1234"><p dir="ltr"><span>Hello</span></p></b>';
    expect(htmlToMarkdown(html)).toBe("Hello");
  });

  it("writes lists the way people do, nesting included", () => {
    expect(
      htmlToMarkdown("<ol><li>One<ul><li>Sub</li></ul></li><li>Two</li></ol>"),
    ).toBe("1. One\n   - Sub\n2. Two");
    expect(htmlToMarkdown('<ol start="3"><li>Three</li></ol>')).toBe("3. Three");
  });

  it("keeps a real paragraph that happens to precede a code block", () => {
    const markdown = htmlToMarkdown("<p>python</p><pre><code>x = 1</code></pre>");
    expect(markdown).toBe("python\n\n```\nx = 1\n```");
  });
});

describe("clipboardToMarkdown", () => {
  it("prefers the plain text when it is already Markdown", () => {
    const text = "## Title\n\nSome **bold** text.";
    const result = clipboardToMarkdown({ text, html: "<h2>Title</h2><p>Some <b>bold</b> text.</p>" });
    expect(result).toEqual({ markdown: text, converted: false });
  });

  it("converts the HTML when the text is a flattened rendering", () => {
    const result = clipboardToMarkdown({
      text: "Title\nSome bold text.",
      html: "<h2>Title</h2><p>Some <b>bold</b> text.</p>",
    });
    expect(result).toEqual({ markdown: "## Title\n\nSome **bold** text.", converted: true });
  });

  it("leaves code-editor HTML alone and uses the text", () => {
    const result = clipboardToMarkdown({
      text: "const x = 1;",
      html: '<div style="color: #d4d4d4;"><div><span style="color: #569cd6;">const</span> x = 1;</div></div>',
    });
    expect(result).toEqual({ markdown: "const x = 1;", converted: false });
  });

  it("cleans the plain text too", () => {
    const result = clipboardToMarkdown({ text: "Fact.citeturn0news4 More.【4†source】" });
    expect(result.markdown).toBe("Fact. More.");
  });
});

describe("findClosingOffer", () => {
  it("finds the assistant's closing offer, with the rule above it", () => {
    const answer =
      "## Setup\n\nRun the installer.\n\n---\n\n💡 *Want me to add a CI workflow that runs the tests?*\n";
    const offer = findClosingOffer(answer);
    expect(offer?.text).toBe("💡 *Want me to add a CI workflow that runs the tests?*");
    expect(offer?.without).toBe("## Setup\n\nRun the installer.\n");
  });

  it.each([
    "Let me know if you'd like a version for Windows.",
    "If you want, I can also turn this into a checklist.",
    "Would you like me to explain the second step?",
    "Hope this helps!",
  ])("recognises %j", (closing) => {
    expect(findClosingOffer(`Some answer.\n\n${closing}`)?.text).toBe(closing);
  });

  it("leaves ordinary endings, lists and lone paragraphs alone", () => {
    expect(findClosingOffer("Intro.\n\nThat is the whole method.")).toBeNull();
    expect(findClosingOffer("Intro.\n\n- Would you like fries with that?")).toBeNull();
    expect(findClosingOffer("Would you like to know more?")).toBeNull();
    expect(findClosingOffer("Intro.\n\n## Should I use Docker?")).toBeNull();
  });
});

describe("helpers", () => {
  it("recognises Markdown by syntax only an author writes", () => {
    expect(looksLikeMarkdown("# Heading")).toBe(true);
    expect(looksLikeMarkdown("```js\nx\n```")).toBe(true);
    expect(looksLikeMarkdown("| a | b |\n|---|---|")).toBe(true);
    expect(looksLikeMarkdown("Just a sentence.\nAnother line.")).toBe(false);
  });

  it("tells document HTML from styled spans", () => {
    expect(hasRichStructure("<h1>x</h1>")).toBe(true);
    expect(hasRichStructure('<div><span style="color:red">x</span></div>')).toBe(false);
  });

  it("keeps Markdown hard breaks while trimming stray whitespace", () => {
    expect(cleanChatbotText("a  \nb \nc\r\n\n\n\nd")).toBe("a  \nb\nc\n\nd");
  });
});
