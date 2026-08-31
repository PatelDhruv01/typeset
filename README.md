# Typeset

**Markdown in. Typeset PDF out.**

Turn Markdown into a typeset, print-ready PDF — with a live paginated preview,
real typography controls, and no sign-up.

> **Status: in development.** Phases 0-1 of 7 complete: the renderer works, the PDF engine does not exist yet. See the roadmap below.

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
      Paged.js pagination          /api/render (Node runtime)
              │                           │
        what you SEE                what you DOWNLOAD
```

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
| `npm run assets` | Regenerate bundled fonts and stylesheets |

## Roadmap

- [x] **Phase 0** — Scaffold, repo, CI
- [x] **Phase 1** — `DocumentConfig` schema, renderer core, theme system
- [ ] **Phase 2** — Chromium PDF engine and download
- [ ] **Phase 3** — Editor, preset cards, live paginated preview
- [ ] **Phase 4** — Full customisation drawer
- [ ] **Phase 5** — Cover page, table of contents, section numbering, watermark
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
scripts/
  sync-fonts.mjs        Copies woff2 out of @fontsource into public/fonts
  sync-styles.mjs       Bakes highlight.js themes and KaTeX CSS into modules
reference/
  convert.legacy.js     The original single-purpose script this grew from
  sample-technical.md   A deliberately hostile test document (1164 lines)
```

### Generated assets

`public/fonts/`, `public/katex/` and `src/lib/renderer/generated/` are produced
by the two sync scripts and regenerated automatically before `dev` and `build`.
Adding a font is one line in `FONT_PACKAGES`; everything else — weight axes,
unicode ranges, licensing metadata — is read from the package's own
`metadata.json`.

## License

MIT — see [LICENSE](LICENSE).
