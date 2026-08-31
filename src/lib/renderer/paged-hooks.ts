/**
 * Code that runs against a document Paged.js has already laid out.
 *
 * Two very different callers share this file, which is why it looks the way it
 * does:
 *
 *   - The PDF renderer passes these functions to `page.evaluate`, which
 *     serialises them with `Function.prototype.toString` and evaluates them
 *     inside Chromium. So there can be no imports, no closure over module
 *     scope, and nothing that needs a TypeScript runtime helper.
 *   - The live preview calls them directly from the parent frame, against the
 *     preview iframe's document. So the document cannot be assumed to be the
 *     ambient global either.
 *
 * Hence the `doc` parameter with a default: `page.evaluate(fn, offset)` gets the
 * page's own document, and the preview passes the iframe's.
 */

/**
 * Fill in the contents page numbers.
 *
 * The obvious approach is CSS: `content: target-counter(attr(href), page)`.
 * It works, and it is unusably slow - Paged.js resolves each occurrence with
 * extra layout passes, and the cost grows with the number of entries. On a
 * 27-page document with 60 entries it took the render from 6 seconds to 38,
 * past the timeout and into the fallback path.
 *
 * Reading the finished layout instead is a single pass. It is only safe because
 * the stylesheet reserves a fixed-width slot for the number: writing text into
 * a box whose size is already settled cannot reflow the page and invalidate the
 * very number being written.
 *
 * `pageOffset` accounts for `structure.startPageNumber`, since Paged.js reports
 * the physical page index rather than the printed counter.
 */
export function fillTocPageNumbers(
  pageOffset: number,
  doc: Document = document,
): number {
  const pageOfId = new Map<string, string>();

  for (const box of doc.querySelectorAll(".pagedjs_page")) {
    const number = (box as HTMLElement).dataset.pageNumber;
    if (!number) continue;

    // First occurrence wins: an element split across pages starts on the
    // earlier one, which is where a reader would turn to.
    for (const element of box.querySelectorAll("[id]")) {
      const id = element.id;
      if (id && !pageOfId.has(id)) pageOfId.set(id, number);
    }
  }

  let filled = 0;

  for (const anchor of doc.querySelectorAll('.toc-entry a[href^="#"]')) {
    const slot = anchor.querySelector(".toc-page");
    if (!slot) continue;

    const href = anchor.getAttribute("href");
    if (!href) continue;

    let id = href.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {
      // A malformed escape is not a reason to abandon the whole contents page.
    }

    const number = pageOfId.get(id);
    if (!number) continue;

    slot.textContent = String(Number(number) + pageOffset);
    filled += 1;
  }

  return filled;
}

/** How many pages Paged.js produced. */
export function countPages(doc: Document = document): number {
  return doc.querySelectorAll(".pagedjs_page").length;
}
