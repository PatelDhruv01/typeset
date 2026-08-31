import fs from "node:fs";
import path from "node:path";

import { PDFDocument } from "pdf-lib";
import type { Page } from "puppeteer-core";

import type { DocumentConfig } from "@/lib/config/schema";
import { resolvePageSize } from "@/lib/config/page-sizes";
import { renderDocument } from "@/lib/renderer/document";
import { inlineAssetOrKeep } from "@/lib/pdf/assets";
import { getBrowser } from "@/lib/pdf/browser";

/**
 * The PDF engine.
 *
 * Pagination is done by Paged.js running *inside* Chromium, not by Chromium's
 * own print pipeline. That is a deliberate trade.
 *
 * Chromium's `page.pdf()` cannot do CSS margin boxes. Running heads, running
 * section names and cross-referenced contents entries would have to move into a
 * separate `headerTemplate` - a second HTML document, with its own styles, that
 * is guaranteed to drift away from the first. Paged.js implements CSS Paged
 * Media properly, so `@top-center`, `string-set` and `target-counter()` all
 * work, and the preview can run the identical code path in the browser.
 *
 * The cost is time: Paged.js lays the whole document out in JavaScript before
 * anything is printed. PAGINATION_TIMEOUT_MS bounds that, and the caller can
 * fall back to Chromium's native pagination if it is exceeded.
 */

const PAGINATION_TIMEOUT_MS = 30_000;
const PAGE_LOAD_TIMEOUT_MS = 15_000;

export type PdfRenderOptions = {
  sourceName?: string;
  now?: Date;
  /**
   * Skip Paged.js and use Chromium's own pagination. Faster and far more
   * robust, but loses margin boxes - so running heads and page numbers
   * disappear. Used as a fallback, and by tests that only care about content.
   */
  nativePagination?: boolean;
};

export type PdfRenderResult = {
  pdf: Uint8Array;
  fileName: string;
  title: string;
  pageCount: number;
  /** How the document was paginated, so callers can report a degraded render. */
  paginatedBy: "pagedjs" | "chromium";
  durationMs: number;
};

/** Paged.js's browser bundle, read once and injected as inline script text. */
let pagedJsSource: string | null = null;

export const PAGEDJS_URL = "/pagedjs/paged.polyfill.min.js";

/**
 * Read the Paged.js bundle from public/, where scripts/sync-styles.mjs put it.
 *
 * Resolving it from node_modules at runtime does not work here. pagedjs
 * declares a conditions-only "exports" map, so `pagedjs/dist/...` is not a
 * reachable subpath; and inside a bundled route `require.resolve("pagedjs")`
 * returns a virtual module id such as
 * `[project]/node_modules/pagedjs/lib/index.cjs [app-route] (ecmascript)`,
 * which is not a filesystem path at all. Treating it as a public asset sidesteps
 * both problems, and lets the browser preview load the identical file by URL.
 */
function getPagedJsSource(): string {
  if (pagedJsSource !== null) return pagedJsSource;

  const file = path.join(process.cwd(), "public", ...PAGEDJS_URL.split("/"));

  if (!fs.existsSync(file)) {
    throw new Error(
      `Paged.js is missing from ${file}. Run \`npm run assets\` to restore it.`,
    );
  }

  pagedJsSource = fs.readFileSync(file, "utf8");
  return pagedJsSource;
}

declare global {
  interface Window {
    __typesetPaged?: { total: number } | { error: string };
  }
}

/**
 * Run Paged.js over the loaded document and wait for it to finish.
 *
 * `PagedConfig` has to be installed *before* the polyfill script evaluates,
 * because the polyfill reads it at module scope and starts laying out on
 * `readystatechange` otherwise.
 */
async function paginateWithPagedJs(page: Page): Promise<number> {
  await page.evaluate(() => {
    (window as unknown as { PagedConfig: unknown }).PagedConfig = {
      auto: true,
      before: () => {
        // The stylesheet's screen fallback mirrors the page box as body
        // padding, because @page is inert in an unpaginated document. Paged.js
        // is about to make it paginated, so that fallback must switch off
        // before layout - otherwise every margin is applied twice.
        document.documentElement.classList.add("paginated");
      },
      after: (flow: { total?: number } | undefined) => {
        window.__typesetPaged = { total: flow?.total ?? 0 };
      },
    };
  });

  await page.addScriptTag({ content: getPagedJsSource() });

  await page.waitForFunction(() => Boolean(window.__typesetPaged), {
    timeout: PAGINATION_TIMEOUT_MS,
  });

  const result = await page.evaluate(() => window.__typesetPaged);
  if (!result) throw new Error("Paged.js finished without reporting a result.");
  if ("error" in result) throw new Error(result.error);

  return result.total;
}

/**
 * Wait for webfonts before printing.
 *
 * `document.fonts.ready` resolves once every face the document actually uses
 * has loaded. Without it, Chromium happily prints a page mid-swap and the PDF
 * comes out in a fallback face - intermittently, which is the worst kind of
 * bug to chase.
 */
async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

/**
 * Chromium does not carry HTML `<meta>` into the PDF's document information
 * dictionary, so it is written afterwards. This is also where the outline and
 * any future encryption would go.
 */
async function applyMetadata(
  pdfBytes: Uint8Array,
  config: DocumentConfig,
  derived: { title: string; author: string },
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  // updateMetadata: false is load-time, not save-time, and it matters: with the
  // default, pdf-lib stamps its own Producer and a fresh ModDate the moment the
  // document is opened, overwriting whatever was set. Anything reading a PDF
  // back has to pass it too - including tests, or they measure their own write.
  const pdf = await PDFDocument.load(pdfBytes, { updateMetadata: false });

  const title = config.output.metadata.title ?? derived.title;
  const author = config.output.metadata.author ?? derived.author;

  if (title) pdf.setTitle(title);
  if (author) pdf.setAuthor(author);
  if (config.output.metadata.subject) {
    pdf.setSubject(config.output.metadata.subject);
  }
  if (config.output.metadata.keywords.length > 0) {
    pdf.setKeywords(config.output.metadata.keywords);
  }
  pdf.setProducer("Typeset");
  pdf.setCreator("Typeset");

  return {
    bytes: await pdf.save({ useObjectStreams: true }),
    pageCount: pdf.getPageCount(),
  };
}

export async function renderPdf(
  source: string,
  config: DocumentConfig,
  options: PdfRenderOptions = {},
): Promise<PdfRenderResult> {
  const startedAt = Date.now();

  // Assets are inlined as data: URIs. Chromium renders this HTML detached, with
  // no origin, so a relative /fonts/... URL would never resolve.
  const rendered = renderDocument(source, config, {
    sourceName: options.sourceName,
    now: options.now,
    resolveUrl: inlineAssetOrKeep,
  });

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // `domcontentloaded` rather than `networkidle0`: everything is already
    // inline, so there is no network to go idle and waiting for it just burns
    // the timeout.
    await page.setContent(rendered.html, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });

    await waitForFonts(page);

    let paginatedBy: PdfRenderResult["paginatedBy"] = "chromium";

    if (!options.nativePagination) {
      await paginateWithPagedJs(page);
      paginatedBy = "pagedjs";
      // Paged.js swaps the whole body for its own page boxes; give layout and
      // any late font swaps one frame to settle before printing.
      await waitForFonts(page);
    }

    const size = resolvePageSize(config.page.size, config.page.orientation, {
      width: config.page.customWidth,
      height: config.page.customHeight,
    });

    const raw = await page.pdf({
      printBackground: true,
      scale: config.page.scale,
      // Paged.js has already drawn the margins into its page boxes, so the
      // print margin must be zero or they are applied twice.
      margin:
        paginatedBy === "pagedjs"
          ? { top: 0, right: 0, bottom: 0, left: 0 }
          : {
              top: `${config.page.margins.top}mm`,
              right: `${config.page.margins.right}mm`,
              bottom: `${config.page.margins.bottom}mm`,
              left: `${config.page.margins.left}mm`,
            },
      width: `${size.width}mm`,
      height: `${size.height}mm`,
      preferCSSPageSize: paginatedBy === "pagedjs",
      outline: config.output.outline,
      tagged: config.output.tagged,
      timeout: PAGINATION_TIMEOUT_MS,
    });

    const { bytes, pageCount } = await applyMetadata(raw, config, {
      title: rendered.title,
      author: config.cover.author ?? "",
    });

    return {
      pdf: bytes,
      fileName: rendered.fileName,
      title: rendered.title,
      pageCount,
      paginatedBy,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    // The page is always closed; the browser is deliberately left running for
    // the next request.
    await page.close().catch(() => {});
  }
}

/**
 * Render, falling back to Chromium's own pagination if Paged.js fails.
 *
 * A document that loses its running heads is a far better outcome than an error
 * page, and Paged.js is the one component here with a real chance of choking on
 * unusual input.
 */
export async function renderPdfWithFallback(
  source: string,
  config: DocumentConfig,
  options: PdfRenderOptions = {},
): Promise<PdfRenderResult & { fallbackReason?: string }> {
  try {
    return await renderPdf(source, config, options);
  } catch (error) {
    if (options.nativePagination) throw error;

    const reason = error instanceof Error ? error.message : String(error);
    const result = await renderPdf(source, config, {
      ...options,
      nativePagination: true,
    });

    return { ...result, fallbackReason: reason };
  }
}
