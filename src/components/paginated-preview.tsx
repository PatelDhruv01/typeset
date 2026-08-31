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
  /** 1 = actual size. */
  zoom: number;
  onStatus?: (status: PreviewStatus) => void;
};

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
  onStatus,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

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
    frame.style.cssText =
      `position:absolute;top:0;left:0;display:block;width:100%;height:${LAYOUT_VIEWPORT_PX}px;border:0;visibility:hidden`;
    host.append(frame);

    const settle = (doc: Document) => {
      if (cancelled) return;

      // Measured inside the frame, so the parent's zoom transform does not
      // affect the numbers.
      const page = doc.querySelector(".pagedjs_page");
      const width = Math.ceil(
        Math.max(
          page?.getBoundingClientRect().width ?? 0,
          doc.documentElement.scrollWidth,
        ),
      );
      const height = Math.ceil(doc.documentElement.scrollHeight);

      for (const child of [...host.children]) {
        if (child !== frame) child.remove();
      }

      frame.style.position = "static";
      frame.style.visibility = "visible";
      frame.style.width = "100%";
      frame.style.height = "100%";

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

      try {
        if (!paginate) {
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
    frame.srcdoc = withBaseHref(html);

    return () => {
      cancelled = true;
      frame.removeEventListener("load", onLoad);
      // A superseded frame must go, or its Paged.js loop keeps running. Only a
      // frame that has already been made visible is kept, and the next run's
      // settle() removes that one once it has something to replace it with.
      if (frame.style.visibility === "hidden") frame.remove();
    };
  }, [html, paginate, pageOffset, report]);

  return (
    <div className="h-full overflow-auto p-4">
      {/* Two boxes: the outer one occupies the *scaled* size so the scroll
          container measures it correctly, while the inner one keeps its real
          pixel size and is transformed. A transform does not change layout
          size, so without the outer box a zoomed page would either overflow or
          leave a gap. */}
      <div
        style={{
          width: size ? size.width * zoom : "100%",
          height: size ? size.height * zoom : "100%",
          margin: "0 auto",
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
            transform: zoom === 1 ? undefined : `scale(${zoom})`,
            transformOrigin: "top left",
          }}
        />
      </div>
    </div>
  );
}

/**
 * Give the preview document a real base URL.
 *
 * Belt and braces rather than the fix: a srcdoc iframe has
 * `document.baseURI === "about:srcdoc"`, but Paged.js resolves stylesheet URLs
 * against `window.location.href`, not baseURI - which is why the stylesheet's
 * asset URLs are made absolute instead (see lib/renderer/asset-urls.ts). The
 * base tag still matters for anything else that resolves relatively.
 */
function withBaseHref(html: string): string {
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
