# Typeset

**Markdown in. Typeset PDF out.**

Turn Markdown into a typeset, print-ready PDF — with a live paginated preview,
real typography controls, and no sign-up.

> **Status: in development.** Phase 0 of 7 complete. See the roadmap below.

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
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run check` | Typecheck + lint (what CI runs) |

## Roadmap

- [x] **Phase 0** — Scaffold, repo, CI
- [ ] **Phase 1** — `DocumentConfig` schema, renderer core, theme system
- [ ] **Phase 2** — Chromium PDF engine and download
- [ ] **Phase 3** — Editor, preset cards, live paginated preview
- [ ] **Phase 4** — Full customisation drawer
- [ ] **Phase 5** — Cover page, table of contents, section numbering, watermark
- [ ] **Phase 6** — Math (KaTeX), Mermaid, callouts, image handling
- [ ] **Phase 7** — Saved presets, config sharing, batch conversion, deploy

## Repository layout

```
src/
  app/            Next.js routes and the application shell
  components/     UI components
  lib/            Framework-free logic — renderer, config schema, PDF engine
reference/
  convert.legacy.js      The original single-purpose script this grew from
  sample-technical.md    A deliberately hostile test document
```

## License

MIT — see [LICENSE](LICENSE).
