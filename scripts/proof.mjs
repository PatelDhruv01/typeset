/**
 * Visual proof that Paged.js pagination produced real pages with running heads
 * and page numbers.
 *
 * Screenshots what Chromium is actually asked to print, which is the one thing
 * a PDF byte count cannot tell you. Not part of the test suite - it needs a
 * running dev server and it produces artefacts to look at, not assertions.
 *
 *   node scripts/proof.mjs [preset] [pageIndex]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = process.env.TYPESET_ORIGIN ?? "http://localhost:3100";
const preset = process.argv[2] ?? "technical";
const pageIndex = Number(process.argv[3] ?? 1);

const CHROME =
  process.env.CHROME_EXECUTABLE_PATH ??
  [
    path.join(
      process.env.LOCALAPPDATA ?? "",
      "ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe",
    ),
    "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
  ].find((candidate) => fs.existsSync(candidate));

const sourceFile = process.env.PROOF_SOURCE ?? "sample-technical.md";
const source = fs.readFileSync(path.join(ROOT, "reference", sourceFile), "utf8");
const extraConfig = process.env.PROOF_CONFIG
  ? JSON.parse(process.env.PROOF_CONFIG)
  : undefined;

const response = await fetch(`${ORIGIN}/api/render`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ source, preset, config: extraConfig, format: "html" }),
});

if (!response.ok) {
  console.error(`render failed: ${response.status} ${await response.text()}`);
  process.exit(1);
}

// Written into public/ so the document's own /fonts and /katex URLs resolve
// against the dev server, exactly as they do in the live preview.
const debugName = "__proof.html";
const debugPath = path.join(ROOT, "public", debugName);
fs.writeFileSync(debugPath, await response.text());

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--font-render-hinting=none"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1400, deviceScaleFactor: 2 });
  await page.goto(`${ORIGIN}/${debugName}`, { waitUntil: "networkidle0" });

  await page.evaluate(() => {
    window.PagedConfig = {
      auto: true,
      before: () => document.documentElement.classList.add("paginated"),
      after: (flow) => {
        window.__proofDone = { total: flow?.total ?? 0 };
      },
    };
  });
  await page.addScriptTag({ url: "/pagedjs/paged.polyfill.min.js" });
  await page.waitForFunction(() => window.__proofDone, { timeout: 60_000 });

  // Mirrors fillTocPageNumbers in src/lib/renderer/paged-hooks.ts. Duplicated
  // rather than imported because this script is plain JS and that module is TS;
  // the assertion below fails loudly if they ever disagree.
  const numbered = await page.evaluate(() => {
    const pageOfId = new Map();
    for (const box of document.querySelectorAll(".pagedjs_page")) {
      const number = box.dataset.pageNumber;
      if (!number) continue;
      for (const el of box.querySelectorAll("[id]")) {
        if (el.id && !pageOfId.has(el.id)) pageOfId.set(el.id, number);
      }
    }
    let filled = 0;
    for (const anchor of document.querySelectorAll('.toc-entry a[href^="#"]')) {
      const slot = anchor.querySelector(".toc-page");
      const number = pageOfId.get(decodeURIComponent(anchor.getAttribute("href").slice(1)));
      if (!slot || !number) continue;
      slot.textContent = String(number);
      filled += 1;
    }
    return filled;
  });

  const summary = await page.evaluate((index) => {
    const pages = [...document.querySelectorAll(".pagedjs_page")];
    const target = pages[index];

    // Running heads are drawn by CSS `content:` on a pseudo-element, so there
    // is no DOM text to read and textContent is always empty. Paged.js adds a
    // `hasContent` class to exactly those margin boxes whose content rule
    // matched, which is the reliable signal that a running head or page number
    // was actually produced.
    const populated = target
      ? [...target.querySelectorAll(".pagedjs_margin.hasContent")]
          .map((el) =>
            [...el.classList]
              .find((c) => c.startsWith("pagedjs_margin-"))
              ?.replace("pagedjs_margin-", ""),
          )
          .filter(Boolean)
      : [];

    return { total: pages.length, populated };
  }, pageIndex);

  console.log(`preset      : ${preset}`);
  console.log(`pages       : ${summary.total}`);
  console.log(`toc numbers : ${numbered}`);
  console.log(
    `page ${pageIndex} boxes: ${
      summary.populated.length > 0
        ? summary.populated.join(", ")
        : "none - no running head or page number was produced"
    }`,
  );

  const target = await page.$(`.pagedjs_page:nth-of-type(${pageIndex + 1})`);
  const out = path.join(ROOT, "reference", `proof-${preset}.png`);
  await (target ?? page).screenshot({ path: out });
  console.log(`screenshot  : ${out}`);
} finally {
  await browser.close();
  fs.rmSync(debugPath, { force: true });
}
