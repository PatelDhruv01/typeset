"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useLatestRef } from "@/lib/hooks";
import { PAGEDJS_URL } from "@/lib/renderer/paged-constants";
import { countPages, fillTocPageNumbers } from "@/lib/renderer/paged-hooks";

/**
 * The live preview.
 *
 * The document is rendered into an iframe and paginated by the same Paged.js
 * bundle the PDF renderer uses, run the same way, against the same HTML and the
 * same stylesheet. That is the point of the project: before this the preview was
 * a scrolling approximation, and the two could - and did - disagree, which is
 * how the justification bug survived being looked at.
 *
 * Each layout gets its own iframe, created here rather than rendered by React.
 * Reusing one frame meant assigning `srcdoc` again for every edit, which races
 * two navigations against each other and intermittently left the document
 * unpaginated. A fresh element per run also guarantees no Paged.js state
 * survives from the previous document.
 *
 * The new frame is laid out hidden and swapped in only once it is ready, so the
 * previous pages stay on screen instead of blanking on every edit.
 */

export type PreviewStatus =
  | { state: "idle" }
  | { state: "laying-out" }
  | { state: "ready"; pages: number; tocEntries: number; ms: number }
  | { state: "error"; message: string };

type Props = {
  /** A complete document from renderDocument(). */
  html: string;
  /** False renders the document as one scrolling column - instant, not exact. */
  paginate: boolean;
  /** structure.startPageNumber - 1. */
  pageOffset: number;
  /** 1 = actual size; "fit" scales the page to the pane's width. */
  zoom: number | "fit";
  /** Upper bound for "fit", so a wide monitor does not blow a page up. */
  maxFitZoom?: number;
  /** The scale actually applied - the number to show in a zoom control. */
  onEffectiveZoom?: (zoom: number) => void;
  /** Space kept clear below the last page, for a floating toolbar. */
  insetBottom?: number;
  onStatus?: (status: PreviewStatus) => void;
};

/**
 * Presentation-only styles for the preview frame, never part of the document
 * itself (the PDF renderer never sees them): the app's canvas shows through
 * behind the pages, and each page is a separate sheet with a gap and a shadow.
 * Without this the frame's page-coloured background ran every page into the
 * next, so a multi-page document read as one endless sheet.
 *
 * Added to the frame only after layout (see applyPreviewChrome): Paged.js
 * rewrites every stylesheet present when it starts, and drops screen-only
 * rules as it does - which is precisely what these are.
 */
const PREVIEW_CHROME = `
:root { color-scheme: light; }
/* Transparent, so the app's canvas shows around the sheets - but through an
   empty image rather than no background at all. An html element with no
   background hands the body's background to the whole canvas, and in the
   continuous view the body is the sheet: its page colour spread across the
   entire frame, a white slab either side of the page. Any background image,
   even a transparent one, keeps the body's background on the body. */
html { background: transparent linear-gradient(transparent, transparent) !important; }
/* Only paginated: there each .pagedjs_page is the sheet. In the continuous
   view the body *is* the sheet - making it transparent too showed the app's
   canvas through the page, dark text on near-black in dark mode. */
html.paginated body { background: transparent !important; margin: 0; }
.pagedjs_pages {
  display: flex !important;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  width: fit-content !important;
  margin: 0 auto;
  padding: 20px;
}
.pagedjs_page {
  margin: 0 !important;
  background-color: var(--doc-page-bg);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.10), 0 10px 28px -8px rgb(0 0 0 / 0.24);
}
:root:not(.paginated) body {
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.10), 0 10px 28px -8px rgb(0 0 0 / 0.24);
}
`;

function applyPreviewChrome(doc: Document) {
  if (doc.querySelector("style[data-preview-chrome]")) return;
  const style = doc.createElement("style");
  style.dataset.previewChrome = "";
  style.textContent = PREVIEW_CHROME;
  doc.head.append(style);
}

/** Paged.js can sit on a pathological document; do not hang the UI on it. */
const PAGINATION_TIMEOUT_MS = 25_000;

/**
 * Viewport height the layout frame is given while Paged.js works.
 *
 * This is not cosmetic. The frame used to be sized to its host, which after the
 * first layout is the height of the whole paginated document - thousands of
 * pixels. Laying out into a viewport that tall took Paged.js from 3 seconds to
 * past its 25 second timeout, so the first render succeeded and every
 * subsequent one failed. Pagination does not need a tall viewport: page boxes
 * are sized from @page, and content below the fold still has valid geometry.
 */
const LAYOUT_VIEWPORT_PX = 1200;

declare global {
  interface Window {
    PagedConfig?: unknown;
  }
}

export function PaginatedPreview({
  html,
  paginate,
  pageOffset,
  zoom,
  maxFitZoom = 1,
  onEffectiveZoom,
  insetBottom = 0,
  onStatus,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // The pane's usable width, for "fit". Tracked rather than read once: the
  // pane resizes with the window, the splitter, and the settings panel.
  const [paneWidth, setPaneWidth] = useState(0);

  useEffect(() => {
    const pane = scrollRef.current;
    if (!pane) return;
    const observer = new ResizeObserver(() => setPaneWidth(pane.clientWidth));
    observer.observe(pane);
    setPaneWidth(pane.clientWidth);
    return () => observer.disconnect();
  }, []);

  // The laid-out size in CSS pixels, measured after pagination. The frame has
  // to be as wide as the page box, not as wide as the pane: an A4 page is 794px
  // and a half-screen pane is narrower, so a width:100% frame clips the right
  // edge of every page.
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );

  // Kept in a ref so a changing callback identity cannot restart pagination.
  const statusRef = useLatestRef(onStatus);

  const report = useCallback(
    (status: PreviewStatus) => {
      statusRef.current?.(status);
    },
    [statusRef],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    const startedAt = performance.now();

    const frame = document.createElement("iframe");
    frame.title = "Document preview";
    // allow-same-origin is what lets this component drive Paged.js and reuse
    // the layout hooks. The content is our own renderer output, and any raw
    // HTML in it has already been through the sanitiser.
    frame.setAttribute("sandbox", "allow-same-origin allow-scripts");
    // Hidden while it lays out, so the previous frame stays visible. The height
    // is a fixed, modest value rather than 100% of the host - see
    // LAYOUT_VIEWPORT_PX.
    // color-scheme matches the document's own: when an iframe's scheme differs
    // from its document's, Chrome paints an opaque backdrop behind it - a white
    // slab around the pages whenever the app itself is in dark mode.
    //
    // pointer-events:none makes the preview a picture of the document rather
    // than a second browser: a click on a link in it used to navigate the
    // frame away, a file dropped on it bypassed the app's own drop handling,
    // and a click moved keyboard focus inside, out of reach of the shortcuts.
    // Wheel and touch scrolling fall through to the pane, which scrolls.
    frame.tabIndex = -1;
    frame.style.cssText =
      `position:absolute;top:0;left:0;display:block;width:100%;height:${LAYOUT_VIEWPORT_PX}px;border:0;visibility:hidden;color-scheme:light;pointer-events:none`;
    host.append(frame);

    const settle = (doc: Document) => {
      if (cancelled) return;

      // Measured inside the frame, so the parent's zoom transform does not
      // affect the numbers.
      //
      // A paginated page is trusted on its own bounding rect, not blended with
      // scrollWidth: `.pagedjs_page` is a fixed-size box (sized from `@page`),
      // so its rect is the true page width regardless of how wide the iframe's
      // own viewport happened to be during layout - and unlike scrollWidth, it
      // is never inflated by <body>'s own default block-level sizing filling
      // whatever pane the iframe was given. Blending in scrollWidth here used
      // to stretch the whole preview to the pane's width instead of the page's
      // the moment the pane was wider than a single page - a wide gutter of
      // the iframe's own blank background to the right of every visible page.
      // Unpaginated (Continuous) has no page box to measure, so it still needs
      // scrollWidth - that mode's max-width is the document's own body rule,
      // and scrollWidth is the only way to read it back.
      // The pages' container is fit-content wide (see PREVIEW_CHROME), so its
      // rect is the page width plus the gutter its shadow needs.
      const pages = doc.querySelector(".pagedjs_pages");
      const width = Math.ceil(
        pages
          ? pages.getBoundingClientRect().width
          : doc.documentElement.scrollWidth,
      );
      const height = Math.ceil(doc.documentElement.scrollHeight);

      // The frame is sized to precisely fit its own content above, so it
      // should never need to scroll itself - the outer `overflow-auto` host
      // is the only scrollbar this preview is meant to have. Without this,
      // a few pixels of rounding slop between the measurement above and the
      // frame's final layout (moving from `position: absolute` to `static`,
      // fonts settling, sub-pixel line heights) is sometimes just enough to
      // make the frame's own document think it overflows itself, drawing a
      // second, redundant scrollbar right against the page's own edge - not
      // at the pane's edge where the real one belongs.
      doc.documentElement.style.overflow = "hidden";
      doc.body.style.overflow = "hidden";

      // Pages arriving for the first time ease in; later layouts (every pause
      // in typing) swap in place, because a fade on each would flicker.
      const firstAppearance = ![...host.children].some(
        (child) => child !== frame && (child as HTMLElement).style.visibility === "visible",
      );

      for (const child of [...host.children]) {
        if (child !== frame) child.remove();
      }

      frame.style.position = "static";
      frame.style.visibility = "visible";
      frame.style.width = "100%";
      frame.style.height = "100%";

      if (firstAppearance && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        frame.animate(
          [
            { opacity: 0, transform: "translateY(10px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 420, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
        );
      }

      setSize({ width, height });
    };

    const onLoad = async () => {
      if (cancelled) return;

      const win = frame.contentWindow;
      const doc = frame.contentDocument;
      if (!win || !doc) return;

      // A new iframe fires `load` for its initial about:blank before the srcdoc
      // content arrives. Acting on that would paginate an empty document and
      // report zero pages. Every rendered document contains .doc-body.
      if (!doc.querySelector(".doc-body")) return;

      // Clicking a page moves keyboard focus into this frame, whose key
      // presses never reach the app's window - so Ctrl+S, Ctrl+K and the rest
      // went dead until the user clicked back out. Forward shortcuts up, and
      // honour the app's preventDefault so Ctrl+S doesn't also open the
      // browser's own Save dialog.
      win.addEventListener("keydown", (event) => {
        if (!event.ctrlKey && !event.metaKey && event.key !== "?") return;
        const forwarded = new KeyboardEvent("keydown", {
          key: event.key,
          code: event.code,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          bubbles: true,
          cancelable: true,
        });
        window.dispatchEvent(forwarded);
        if (forwarded.defaultPrevented) event.preventDefault();
      });

      try {
        if (!paginate) {
          applyPreviewChrome(doc);
          settle(doc);
          report({
            state: "ready",
            pages: 0,
            tocEntries: 0,
            ms: Math.round(performance.now() - startedAt),
          });
          return;
        }

        await runPagedJs(win, doc);
        if (cancelled) return;

        applyPreviewChrome(doc);
        const tocEntries = fillTocPageNumbers(pageOffset, doc);
        const pages = countPages(doc);

        // Paged.js stacks the pages inside the frame, so the frame has to grow
        // to the whole stack - it is the surrounding pane that scrolls.
        settle(doc);

        report({
          state: "ready",
          pages,
          tocEntries,
          ms: Math.round(performance.now() - startedAt),
        });
      } catch (error) {
        if (cancelled) return;

        // Destroy the frame rather than showing it.
        //
        // A rejected promise does not stop Paged.js: on timeout its chunker is
        // still looping, and it will keep looping for as long as the document
        // exists. Leaving that frame in the DOM starved the main thread and made
        // every *later* layout time out too - one failure and the preview never
        // recovered. Removing the frame is the only way to end the loop.
        //
        // The previous frame is left in place, so the pane keeps showing the
        // last good pages while the status bar explains what happened.
        frame.remove();

        report({
          state: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    };

    report({ state: "laying-out" });
    frame.addEventListener("load", onLoad);
    frame.srcdoc = preparePreviewHtml(html);

    return () => {
      cancelled = true;
      frame.removeEventListener("load", onLoad);
      // A superseded frame must go, or its Paged.js loop keeps running. Only a
      // frame that has already been made visible is kept, and the next run's
      // settle() removes that one once it has something to replace it with.
      if (frame.style.visibility === "hidden") frame.remove();
    };
  }, [html, paginate, pageOffset, report]);

  const effectiveZoom =
    zoom === "fit"
      ? size && paneWidth > 0
        ? Math.max(0.2, Math.min(maxFitZoom, paneWidth / size.width))
        : 1
      : zoom;

  const zoomRef = useLatestRef(onEffectiveZoom);
  useEffect(() => {
    zoomRef.current?.(effectiveZoom);
  }, [effectiveZoom, zoomRef]);

  return (
    <div ref={scrollRef} className="h-full overflow-auto overscroll-contain">
      {/* Two boxes: the outer one occupies the *scaled* size so the scroll
          container measures it correctly, while the inner one keeps its real
          pixel size and is transformed. A transform does not change layout
          size, so without the outer box a zoomed page would either overflow or
          leave a gap. */}
      <div
        style={{
          width: size ? size.width * effectiveZoom : "100%",
          height: size ? size.height * effectiveZoom : "100%",
          margin: `0 auto ${insetBottom}px`,
        }}
      >
        <div
          ref={hostRef}
          className="relative"
          style={{
            width: size ? size.width : "100%",
            height: size ? size.height : "100%",
            // Scaling the frame rather than the document keeps page geometry in
            // real millimetres; only the presentation is zoomed.
            transform: effectiveZoom === 1 ? undefined : `scale(${effectiveZoom})`,
            transformOrigin: "top left",
          }}
        />
      </div>
    </div>
  );
}

/**
 * Give the preview document a real base URL, and the preview-only chrome.
 *
 * The base tag is belt and braces rather than the fix: a srcdoc iframe has
 * `document.baseURI === "about:srcdoc"`, but Paged.js resolves stylesheet URLs
 * against `window.location.href`, not baseURI - which is why the stylesheet's
 * asset URLs are made absolute instead (see lib/renderer/asset-urls.ts). The
 * base tag still matters for anything else that resolves relatively.
 */
function preparePreviewHtml(html: string): string {
  const base = `<base href="${window.location.origin}/">`;
  return html.includes("<head>")
    ? html.replace("<head>", `<head>${base}`)
    : `${base}${html}`;
}

/**
 * Load Paged.js into the frame and wait for it to finish.
 *
 * `PagedConfig` must exist before the polyfill evaluates: it reads the object at
 * module scope and begins laying out as soon as the document is ready.
 */
function runPagedJs(win: Window, doc: Document): Promise<void> {
  return new Promise((resolve, reject) => {
    // Paged.js reports failure by simply never calling `after`, which surfaces
    // as an unexplained timeout. Listening inside the frame turns that into the
    // actual error message.
    const onError = (event: ErrorEvent) => {
      finish();
      reject(new Error(`Paged.js: ${event.message}`));
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason: unknown = event.reason;
      finish();
      reject(
        new Error(
          `Paged.js: ${reason instanceof Error ? reason.message : String(reason)}`,
        ),
      );
    };

    const finish = () => {
      win.clearTimeout(timer);
      win.removeEventListener("error", onError);
      win.removeEventListener("unhandledrejection", onRejection);
    };

    const timer = win.setTimeout(() => {
      finish();
      reject(
        new Error(
          `Pagination took longer than ${PAGINATION_TIMEOUT_MS / 1000}s. ` +
            "Switch to Continuous while you edit.",
        ),
      );
    }, PAGINATION_TIMEOUT_MS);

    win.addEventListener("error", onError);
    win.addEventListener("unhandledrejection", onRejection);

    win.PagedConfig = {
      auto: true,
      before: () => {
        // The stylesheet's screen fallback mirrors the page box as body
        // padding, because @page is inert until a document is paginated.
        // Paged.js is about to paginate it, so the fallback has to switch off
        // first or every margin is applied twice.
        doc.documentElement.classList.add("paginated");
      },
      after: () => {
        finish();
        resolve();
      },
    };

    const script = doc.createElement("script");
    script.src = PAGEDJS_URL;
    script.onerror = () => {
      finish();
      reject(new Error(`Could not load ${PAGEDJS_URL}. Run \`npm run assets\`.`));
    };
    doc.head.append(script);
  });
}
