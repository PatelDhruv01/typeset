/**
 * Asset URL strategies for the two renderer consumers.
 *
 * The generated stylesheet refers to fonts and KaTeX glyphs by same-origin path
 * (`/fonts/...`). Neither consumer can use those as they stand:
 *
 *   - Headless Chromium renders detached HTML with no origin, so a relative URL
 *     never resolves. It inlines each file as a data: URI instead (see
 *     lib/pdf/assets.ts).
 *   - The preview iframe uses srcdoc, whose `window.location.href` is
 *     "about:srcdoc". Paged.js resolves stylesheet URLs against that rather than
 *     against document.baseURI, and `new URL("/fonts/x", "about:srcdoc")`
 *     throws - which aborts pagination before a single page is laid out. A
 *     <base> tag does not help, because it is not what Paged.js reads.
 *
 * Making them absolute solves it: an absolute URL ignores the base entirely.
 */

/** Rewrites same-origin paths to absolute URLs. No-op during server render. */
export function absoluteAssetUrl(url: string): string {
  if (typeof window === "undefined") return url;
  if (!url.startsWith("/")) return url;
  return new URL(url, window.location.origin).href;
}
