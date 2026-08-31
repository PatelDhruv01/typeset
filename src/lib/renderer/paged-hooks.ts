/**
 * Code that runs *inside* the browser, after Paged.js has laid the document out.
 *
 * Everything here must be self-contained: no imports, no closure over module
 * scope, no TypeScript that needs a runtime helper. These functions are
 * serialised with `Function.prototype.toString` and evaluated in the page, both
 * by the PDF renderer and (from Phase 3) by the live preview.
 */

/**
 * Fill in the contents page numbers.
 *
 * The obvious approach is CSS: `content: target-counter(attr(href), page)`.
 * It works, and it is unusably slow - Paged.js resolves each one with extra
 * layout passes, and the cost grows with the number of entries. On a 27-page
 * document with 60 entries that took the render from 6 seconds to 38, past the
 * timeout and into the fallback path.
 *
 * Doing it here instead is one pass over the finished layout. It is only safe
 * because the stylesheet reserves a fixed-width slot for the number: writing
 * text into a box whose size is already settled cannot reflow the page and
 * invalidate the numbers being written.
 *
 * `pageOffset` accounts for `structure.startPageNumber`, since Paged.js reports
 * the physical page index rather than the printed counter.
 */
export function fillTocPageNumbers(pageOffset: number): number {
  const pageOfId = new Map<string, string>();

  for (const page of document.querySelectorAll(".pagedjs_page")) {
    const number = (page as HTMLElement).dataset.pageNumber;
    if (!number) continue;

    // First occurrence wins: an element split across pages starts on the
    // earlier one, which is where a reader would turn to.
    for (const element of page.querySelectorAll("[id]")) {
      const id = element.id;
      if (id && !pageOfId.has(id)) pageOfId.set(id, number);
    }
  }

  let filled = 0;

  for (const anchor of document.querySelectorAll('.toc-entry a[href^="#"]')) {
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
