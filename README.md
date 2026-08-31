# Typeset

**Markdown in. Typeset PDF out.**

Turn Markdown into a typeset, print-ready PDF — with a live paginated preview,
real typography controls, and no sign-up.

> **Status: in development.** Phases 0-3 of 7 complete: a real editor, a page-accurate live preview and paginated PDF export. See the roadmap below.

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
`X-Typeset-Duration-Ms`, and `X-Typeset-Fallback` when a render was degraded.

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
  app/                  Next.js routes and the application shell
  lib/
    config/             DocumentConfig schema, page geometry, style presets
    fonts/              Font registry (+ generated file manifest)
    renderer/           markdown -> HTML, config -> CSS, document assembly
      generated/        Baked-in code themes and KaTeX CSS
    pdf/                Browser launch, asset inlining, the PDF engine
  components/           Editor and preview (both client-only)
    settings/           Form primitives and the customisation panel
scripts/
  sync-fonts.mjs        Copies woff2 out of @fontsource into public/fonts
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

### Generated assets

`public/fonts/`, `public/katex/` and `src/lib/renderer/generated/` are produced
by the two sync scripts and regenerated automatically before `dev` and `build`.
Adding a font is one line in `FONT_PACKAGES`; everything else — weight axes,
unicode ranges, licensing metadata — is read from the package's own
`metadata.json`.

## License

MIT — see [LICENSE](LICENSE).
