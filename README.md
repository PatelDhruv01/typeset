# Typeset

**Markdown in. Typeset PDF out.**

Turn Markdown — or an answer copied from ChatGPT, Claude or Gemini — into a
typeset, print-ready PDF, with a live paginated preview, real typography
controls, and no sign-up.

> **Status: in development.** Phases 0-4 of 7 complete, most of 5. See the roadmap below.

## Using it

- **Paste a chatbot answer.** The start screen asks for one: press Ctrl/⌘+V
  anywhere, drop a file, pick a sample, or just start typing. Rich text copied
  from a chat window is converted back to Markdown — headings, lists, tables,
  code blocks (with their language), KaTeX maths and emoji — and the chat UI's
  clutter ("Copy code" buttons, language labels, citation markers) is dropped.
  Text that is already Markdown is used as it is. Ctrl/⌘+Shift+V pastes
  exactly what was copied.
- **Leave out the sign-off.** When an answer ends with the assistant's
  follow-up ("Want me to…?", "Let me know if…"), Typeset offers to remove it.
- **The pages appear when there is something on them**, beside the editor.
- **Pick a style** in the Design panel — including **Pocket**, phone-sized
  pages for reading saved answers offline — then fine-tune page, type,
  colours and structure.
- **Download** a PDF (Ctrl/⌘+S), a self-contained HTML page that works
  offline, or the Markdown source.
- **Everything is saved in your browser** as you type, with a list of recent
  documents. Nothing is uploaded except to render a PDF.
- **Works on any screen.** Phones get one pane at a time with a bottom tab
  bar and settings in a bottom sheet; tablets switch panes from the header;
  desktops get a resizable editor, the live pages, and a docked settings panel.
- **Keyboard:** Ctrl/⌘+K opens a command menu for everything; `?` lists the
  shortcuts. Light and dark appearance follow the system or your choice.

---

## Why this exists

Most "markdown to PDF" tools give you one of two bad outcomes: a screenshot of a
web page with a scrollbar baked in, or a wall of options with no preview so you
convert, look, tweak, and convert again.

This one is built around a single idea: **the preview and the PDF are rendered
from the same HTML and the same stylesheet.** What you see is what you download.

## Architecture

```
                markdown + DocumentConfig
                            │
                            ▼
              ┌───────────────────────────┐
              │  src/lib/renderer         │   pure, deterministic
              │  remark → rehype → HTML   │   no DOM, no network
              │  + theme CSS              │
              └─────────────┬─────────────┘
                            │  one HTML string
              ┌─────────────┴─────────────┐
              ▼                           ▼
      preview <iframe>             headless Chromium
      + Paged.js, same bundle      /api/render + Paged.js
              │                           │
        what you SEE                what you DOWNLOAD
```

### Why Paged.js rather than Chromium's own pagination

Chromium's `page.pdf()` cannot render CSS margin boxes. Running heads, running
section names and cross-referenced contents entries would have to live in a
separate `headerTemplate` — a second HTML document with its own styles, certain
to drift from the first. Paged.js implements CSS Paged Media properly, so
`@top-center`, `string-set` and `target-counter()` all work, and the browser
preview can run the identical bundle.

The cost is time: Paged.js lays the whole document out in JavaScript before
anything is printed. `renderPdfWithFallback` bounds that and falls back to
Chromium's native pagination if it fails — a document without running heads
beats an error page. The response reports which was used in
`X-Typeset-Paginator`.

Everything the user can change lives in one serializable `DocumentConfig`
object, validated by a Zod schema shared between client and server. That single
decision is what gives us presets, shareable configuration links, and a public
API for free.

### Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) | Vercel-native, one repo for UI + render API |
| Markdown | unified / remark / rehype | AST access — required for auto-TOC, section numbering and figure captions |
| Preview pagination | Paged.js | Real CSS Paged Media page boxes in the browser |
| PDF engine | `puppeteer-core` + `@sparticuz/chromium` | Chrome's own print engine: native page numbers, PDF outline, correct CSS |
| Post-processing | `pdf-lib` | Metadata, encryption, page-level tweaks |
| Config validation | Zod | One schema, trusted on both sides of the network |
| Styling | Tailwind v4 | App chrome only — document theming is a separate system |
| UI primitives | Radix UI, cmdk, Sonner, Lucide | Accessible menus, sheets and dialogs (focus, Escape, screen readers) without reinventing them |
| Rich paste | Turndown + GFM plugin | Chat-window HTML back to Markdown, with custom rules for code blocks, KaTeX and chat UI furniture |

## Getting started

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000.

### Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm test` | Vitest, once |
| `npm run test:watch` | Vitest, watching |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run check` | Typecheck + lint + test (what CI runs) |
| `npm run assets` | Regenerate bundled fonts, stylesheets and Paged.js |

Browser-dependent tests skip automatically when no Chrome, Chromium, Brave or
Edge is installed. Set `CHROME_EXECUTABLE_PATH` in `.env.local` to choose one.

## API

```bash
curl -X POST http://localhost:3000/api/render -H 'Content-Type: application/json' -d '{"source":"# Hello","preset":"report"}' -o out.pdf
```

| Field | Type | Notes |
| --- | --- | --- |
| `source` | string | The Markdown. Required. |
| `preset` | string | One of the preset ids. Resolved first. |
| `config` | object | Partial `DocumentConfig`, deep-merged over the preset. |
| `sourceName` | string | Original filename, used to derive the output name. |
| `format` | `pdf` or `html` | `html` returns the rendered document instead. |

Responses carry `X-Typeset-Pages`, `X-Typeset-Paginator`,
`X-Typeset-Duration-Ms`, `X-Typeset-Fallback` when a render was degraded, and
`X-Typeset-Missing-Glyphs` (URI-encoded, space-separated) when the document
contains characters no bundled font can draw.

The output filename is derived, not fixed: explicit config, then front matter
`title`, then the first `# heading`, then the uploaded filename.

## Roadmap

- [x] **Phase 0** — Scaffold, repo, CI
- [x] **Phase 1** — `DocumentConfig` schema, renderer core, theme system
- [x] **Phase 2** — Chromium PDF engine and download
- [x] **Phase 3** — Editor, preset cards, live paginated preview
- [x] **Phase 4** — Full customisation drawer
- [~] **Phase 5** — Cover page, contents and section numbering done; watermark pending
- [ ] **Phase 6** — Mermaid diagrams, image handling (maths and callouts landed early, in Phase 1)
- [ ] **Phase 7** — Saved presets, config sharing, batch conversion, deploy

## Repository layout

```
src/
  app/                  Next.js routes; page.tsx composes the workspace
  lib/
    app/                Saved documents, autosave, theme, layout queries, exports
    paste/              Clipboard (chat HTML, plain text) -> clean Markdown
    text/               Emoji segmentation shared by renderer and font picker
    config/             DocumentConfig schema, page geometry, style presets
    fonts/              Font registry, fallback chains, coverage (+ manifest)
    renderer/           markdown -> HTML, config -> CSS, document assembly
      generated/        Baked-in code themes and KaTeX CSS
    pdf/                Browser launch, asset inlining, the PDF engine
  components/
    app/                Header, panes, style gallery, menus, command palette
    ui/                 Buttons, menus, popovers, sheets (Radix underneath)
    settings/           Form primitives and the customisation panel
    markdown-editor.tsx CodeMirror binding, formatting commands, smart paste
    paginated-preview.tsx  Paged.js preview frame, fit-to-width zoom
vendor/
  fonts/noto-color-emoji/  Pre-split COLRv1 colour emoji (see below)
scripts/
  sync-fonts.mjs        Copies woff2 out of @fontsource into public/fonts
  lib/font-codepoints.mjs  Reads a font's cmap (WOFF2 or TTF), no dependencies
  build-emoji-font.py   Rebuilds vendor/fonts/noto-color-emoji (maintainers only)
  sync-styles.mjs       Bakes code themes and KaTeX CSS in, copies Paged.js
  proof.mjs             Screenshots a paginated page, to check running heads
  diagnose-justify.mjs  Reports the alignment Chromium actually applied
reference/
  convert.legacy.js     The original single-purpose script this grew from
  sample-technical.md   A deliberately hostile test document (1164 lines)
```

### Known issue: preview re-layout

The first pagination is reliable. Re-laying out after a settings change has
failed to complete in testing, and the cause is not yet established — the
browser session it was measured in had been driving Paged.js documents for
hours, so the measurements are not trustworthy either way. When a layout does
fail the pane falls back to the continuous view rather than showing stale pages,
and the failed frame is destroyed so it cannot starve later attempts.

### Asset URLs

The stylesheet names fonts by same-origin path (`/fonts/...`). Neither consumer
can use that as it stands, and they need opposite fixes:

- Headless Chromium renders detached HTML with no origin, so nothing relative
  resolves. Each file is **inlined as a `data:` URI**.
- The preview iframe uses `srcdoc`, whose `window.location.href` is
  `about:srcdoc`. Paged.js resolves stylesheet URLs against *that*, not
  `document.baseURI`, and `new URL("/fonts/x", "about:srcdoc")` throws — which
  aborts pagination before a single page is laid out. A `<base>` tag does not
  help, because it is not what Paged.js reads. The URLs are made **absolute**
  instead.

Both go through the same `CssOptions.resolveUrl` seam.

### Glyph coverage: arrows, ticks, emoji and other scripts

Chatbot answers are full of characters body fonts do not carry: → ✓ ✗ ⚠️ ✅,
box-drawing file trees, maths, and emoji. The Chromium that prints PDFs on
Vercel has exactly one system font (Open Sans), so anything the chosen face
lacks used to print as an empty box — while the preview, drawing on the
viewer's own system fonts, looked fine.

Every font stack now ends in a chain of bundled fallbacks, used identically by
the preview and the PDF (`src/lib/fonts/index.ts`):

1. the chosen face, with every subset it has (Greek, Cyrillic, Vietnamese…);
2. script fonts — Devanagari, Gujarati, Bengali, Gurmukhi, Odia, Tamil,
   Telugu, Kannada, Malayalam, Arabic, Hebrew, Thai;
3. symbol fonts — Noto Sans Math, Noto Sans Symbols 2, Noto Sans Symbols,
   DejaVu Sans (code blocks get DejaVu Sans Mono first, so trees stay aligned);
4. Noto Color Emoji.

Each file's `unicode-range` is read from its own cmap
(`scripts/lib/font-codepoints.mjs`), so the renderer knows exactly which file
draws which character. It ships only the files a document needs — a PDF with
one emoji inlines one small emoji file — and reports anything nothing can draw
(currently Chinese, Japanese and Korean) instead of printing a box.

Emoji sequences are wrapped in `<span class="emoji">` so the colour font is
asked before any text font with a monochrome glyph for the same character.
Bare text-default characters such as → and ✓ stay text, as Unicode intends.

`src/lib/pdf/render.test.ts` asks Chromium, via the DevTools protocol, which
font drew every node of a chatbot-style sample, and fails if any came from the
system. That is what makes a pass on a developer's machine mean something on
Vercel.

### The emoji font is vendored

`vendor/fonts/noto-color-emoji/` is committed, not generated at build time.
The `@fontsource/noto-color-emoji` subsets are OpenType-SVG, which Chrome does
not render (blank emoji); its single COLRv1 file is 5.6 MB; and harfbuzzjs is
built without colour-table support. `scripts/build-emoji-font.py` splits the
COLRv1 master along Google's sequence-preserving groups with fontTools. Run it
only when upgrading the emoji font:

```bash
python -m pip install fonttools brotli
npm install --no-save @fontsource/noto-color-emoji
python scripts/build-emoji-font.py
```

### Generated assets

`public/fonts/`, `public/katex/` and `src/lib/renderer/generated/` are produced
by the two sync scripts and regenerated automatically before `dev` and `build`.
Adding a font is one line in `FONT_PACKAGES`; everything else — weight axes,
unicode ranges, licensing metadata — is read from the package itself.

## License

MIT — see [LICENSE](LICENSE).
