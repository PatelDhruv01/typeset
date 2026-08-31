/**
 * Shared between the server renderer and the browser preview.
 *
 * Its own module because the PDF engine imports node:fs and puppeteer-core;
 * pulling this constant from there would drag both into the client bundle.
 */

/** Where scripts/sync-styles.mjs puts the Paged.js browser bundle. */
export const PAGEDJS_URL = "/pagedjs/paged.polyfill.min.js";
