import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { Browser } from "puppeteer-core";
import puppeteer from "puppeteer-core";

/**
 * Finding and launching a Chromium to print with.
 *
 * Two very different environments have to work:
 *
 *   - Serverless (Vercel, Linux): @sparticuz/chromium unpacks a Chromium build
 *     compiled for Lambda into /tmp and hands back the path.
 *   - Local development (Windows, macOS, Linux): that build will not run, so we
 *     use a browser already installed on the machine.
 *
 * Nothing here downloads a browser. `puppeteer-core` deliberately ships without
 * one, so `npm install` stays fast and CI does not pull 150 MB it will not use.
 *
 * Candidates are *tried*, not merely probed for existence. Some installs put a
 * launcher stub where the binary should be - Windows Edge is one - which exits
 * cleanly the moment it is started and never opens a debug port. Existence
 * checks pass, the launch fails with an empty error, and the only way to tell
 * the difference is to attempt it and move on.
 */

const IS_SERVERLESS =
  Boolean(process.env.AWS_LAMBDA_FUNCTION_VERSION) ||
  Boolean(process.env.VERCEL) ||
  process.env.NEXT_RUNTIME === "edge";

const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-dev-shm-usage",
  // Hinting makes glyph positions depend on the host's font settings, which is
  // exactly the kind of thing that makes a PDF differ between machines.
  "--font-render-hinting=none",
  "--disable-lcd-text",
];

/** Files matching `pattern` one level under each versioned directory in `base`. */
function versionedCandidates(base: string, tail: string[]): string[] {
  if (!fs.existsSync(base)) return [];

  try {
    return fs
      .readdirSync(base)
      .map((entry) => path.join(base, entry, ...tail))
      .filter((candidate) => fs.existsSync(candidate));
  } catch {
    return [];
  }
}

/**
 * Ordered best-first. Real Chrome and Chromium builds come first, then other
 * Chromium browsers, then browsers that tooling may have installed, and Edge
 * last because of the launcher-stub problem described above.
 */
function localCandidates(): string[] {
  const platform = os.platform();
  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA ?? "";
  const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
  const programFilesX86 =
    process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";

  const puppeteerCache = path.join(home, ".cache", "puppeteer", "chrome");
  const playwrightCache =
    platform === "win32"
      ? path.join(localAppData, "ms-playwright")
      : platform === "darwin"
        ? path.join(home, "Library", "Caches", "ms-playwright")
        : path.join(home, ".cache", "ms-playwright");

  if (platform === "win32") {
    return [
      path.join(programFiles, "Google\\Chrome\\Application\\chrome.exe"),
      path.join(programFilesX86, "Google\\Chrome\\Application\\chrome.exe"),
      path.join(localAppData, "Google\\Chrome\\Application\\chrome.exe"),
      path.join(programFiles, "Chromium\\Application\\chrome.exe"),
      path.join(
        programFiles,
        "BraveSoftware\\Brave-Browser\\Application\\brave.exe",
      ),
      ...versionedCandidates(playwrightCache, ["chrome-win64", "chrome.exe"]),
      ...versionedCandidates(puppeteerCache, ["chrome-win64", "chrome.exe"]),
      path.join(programFiles, "Microsoft\\Edge\\Application\\msedge.exe"),
      path.join(programFilesX86, "Microsoft\\Edge\\Application\\msedge.exe"),
    ];
  }

  if (platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      ...versionedCandidates(playwrightCache, [
        "chrome-mac",
        "Chromium.app",
        "Contents",
        "MacOS",
        "Chromium",
      ]),
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];
  }

  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
    "/usr/bin/brave-browser",
    ...versionedCandidates(playwrightCache, ["chrome-linux", "chrome"]),
    ...versionedCandidates(puppeteerCache, ["chrome-linux64", "chrome"]),
    "/usr/bin/microsoft-edge",
  ];
}

export class BrowserUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrowserUnavailableError";
  }
}

async function launchServerless(): Promise<Browser> {
  // Imported lazily: the package unpacks a ~50 MB binary on first touch, and
  // local development never needs it.
  const chromium = (await import("@sparticuz/chromium")).default;

  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

async function launchLocal(): Promise<Browser> {
  const explicit = process.env.CHROME_EXECUTABLE_PATH;

  if (explicit) {
    if (!fs.existsSync(explicit)) {
      throw new BrowserUnavailableError(
        `CHROME_EXECUTABLE_PATH is set to "${explicit}" but no file is there.`,
      );
    }
    return puppeteer.launch({
      executablePath: explicit,
      headless: true,
      args: LAUNCH_ARGS,
    });
  }

  const candidates = localCandidates().filter((candidate) =>
    fs.existsSync(candidate),
  );

  const failures: string[] = [];

  for (const executablePath of candidates) {
    try {
      return await puppeteer.launch({
        executablePath,
        headless: true,
        args: LAUNCH_ARGS,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`  ${executablePath}\n    ${message.split("\n")[0]}`);
    }
  }

  throw new BrowserUnavailableError(
    candidates.length === 0
      ? "No Chrome, Chromium, Brave or Edge installation was found. Install " +
        "Google Chrome, or set CHROME_EXECUTABLE_PATH in .env.local."
      : `Found ${candidates.length} browser(s) but none would launch:\n` +
        `${failures.join("\n")}\n` +
        "Set CHROME_EXECUTABLE_PATH in .env.local to a working browser.",
  );
}

/**
 * A single browser shared across requests.
 *
 * Launching Chromium costs 1-3 seconds. In development that would be paid on
 * every render; in a warm serverless container it would be paid on every
 * invocation. The instance is dropped when it disconnects, so a crashed browser
 * heals on the next request instead of poisoning the process.
 */
let browserPromise: Promise<Browser> | null = null;

export async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    try {
      const existing = await browserPromise;
      if (existing.connected) return existing;
    } catch {
      // Fall through and relaunch.
    }
    browserPromise = null;
  }

  browserPromise = (IS_SERVERLESS ? launchServerless() : launchLocal()).catch(
    (error: unknown) => {
      browserPromise = null;
      throw error;
    },
  );

  const browser = await browserPromise;
  browser.once("disconnected", () => {
    browserPromise = null;
  });

  return browser;
}

/** Used by tests and by graceful shutdown. */
export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const pending = browserPromise;
  browserPromise = null;
  try {
    const browser = await pending;
    await browser.close();
  } catch {
    // Already gone.
  }
}

export const browserEnvironment = {
  isServerless: IS_SERVERLESS,
  localCandidates,
  /** Whether any candidate exists at all - used to skip browser-dependent tests. */
  hasCandidate(): boolean {
    if (process.env.CHROME_EXECUTABLE_PATH) return true;
    return localCandidates().some((candidate) => fs.existsSync(candidate));
  },
};
