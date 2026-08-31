/**
 * Why does justified text look wrong in the PDF but fine in the preview?
 *
 * Reports the computed alignment properties Chromium actually applied, and
 * measures whether `hyphens: auto` does anything in this browser at all.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = process.env.TYPESET_ORIGIN ?? "http://localhost:3100";

const CHROME =
  process.env.CHROME_EXECUTABLE_PATH ??
  [
    path.join(
      process.env.LOCALAPPDATA ?? "",
      "ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe",
    ),
    "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
  ].find((c) => fs.existsSync(c));

const source = fs.readFileSync(
  path.join(ROOT, "reference", "sample-technical.md"),
  "utf8",
);

const response = await fetch(`${ORIGIN}/api/render`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ source, preset: "academic", format: "html" }),
});

const debugPath = path.join(ROOT, "public", "__diag.html");
fs.writeFileSync(debugPath, await response.text());

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--font-render-hinting=none"],
});

try {
  const page = await browser.newPage();
  await page.goto(`${ORIGIN}/__diag.html`, { waitUntil: "networkidle0" });

  // Measure the *paginated* document: Paged.js injects its own stylesheet, so
  // computed values before it runs are not what ends up in the PDF.
  await page.evaluate(() => {
    window.PagedConfig = {
      auto: true,
      before: () => document.documentElement.classList.add("paginated"),
      after: () => {
        window.__diagDone = true;
      },
    };
  });
  await page.addScriptTag({ url: "/pagedjs/paged.polyfill.min.js" });
  await page.waitForFunction(() => window.__diagDone, { timeout: 90_000 });

  const result = await page.evaluate(() => {
    const report = {};

    const body = getComputedStyle(document.body);
    report.body = {
      textAlign: body.textAlign,
      textAlignLast: body.textAlignLast,
      hyphens: body.hyphens || body.webkitHyphens,
      lang: document.documentElement.lang,
    };

    // A short paragraph is a single line, which is therefore the LAST line of
    // its block. With text-align-last: auto it must not be stretched.
    const p = [...document.querySelectorAll("p")].find(
      (el) => (el.textContent ?? "").trim().split(/\s+/).length <= 4,
    );
    if (p) {
      const cs = getComputedStyle(p);
      const range = document.createRange();
      range.selectNodeContents(p);
      const inkWidth = range.getBoundingClientRect().width;
      report.shortParagraph = {
        text: (p.textContent ?? "").trim().slice(0, 40),
        textAlign: cs.textAlign,
        textAlignLast: cs.textAlignLast,
        // If the text spans the whole column, its single line was justified.
        inkWidth: Math.round(inkWidth),
        columnWidth: Math.round(p.getBoundingClientRect().width),
      };
    }

    const pre = document.querySelector("pre");
    if (pre) {
      const cs = getComputedStyle(pre);
      report.pre = {
        textAlign: cs.textAlign,
        whiteSpace: cs.whiteSpace,
      };
    }

    const td = document.querySelector("td");
    if (td) {
      report.td = { textAlign: getComputedStyle(td).textAlign };
    }

    // Does `hyphens: auto` do anything here? Put a long hyphenatable word in a
    // box too narrow for it and see whether the content height grows: with
    // hyphenation the word breaks across two lines, without it overflows as one.
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:absolute;left:-9999px;width:60px;font-size:16px;line-height:20px;";
    probe.innerHTML =
      '<span id="on" style="display:block;hyphens:auto;-webkit-hyphens:auto">' +
      "incomprehensibility incomprehensibility</span>" +
      '<span id="off" style="display:block;hyphens:none;-webkit-hyphens:none">' +
      "incomprehensibility incomprehensibility</span>";
    document.body.append(probe);
    const on = document.getElementById("on").getBoundingClientRect().height;
    const off = document.getElementById("off").getBoundingClientRect().height;
    probe.remove();

    report.hyphenation = {
      heightWithAuto: on,
      heightWithNone: off,
      working: on > off,
    };

    return report;
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
  fs.rmSync(debugPath, { force: true });
}
