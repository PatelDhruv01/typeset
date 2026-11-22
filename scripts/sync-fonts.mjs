/**
 * Copies the woff2 files we ship from the installed @fontsource packages into
 * public/fonts/, and emits a manifest describing the @font-face rules to write.
 *
 * Why not just `import "@fontsource/inter"`? Because these fonts are for the
 * *document*, not the app. The document CSS is generated as a string, embedded
 * in an <iframe> for preview and handed to headless Chromium for the PDF -
 * neither of which goes through the bundler. We need real, stable URLs.
 *
 * Three kinds of font ship:
 *
 *   - Faces the user picks (Inter, Source Serif 4, JetBrains Mono...), with
 *     every subset the package offers: Greek, Cyrillic and Vietnamese cost
 *     nothing until a document uses them, because each file is gated by
 *     unicode-range.
 *   - Script fallbacks (Devanagari, Gujarati, Arabic...), appended to every
 *     stack so a document in another script still renders.
 *   - Symbol and emoji fallbacks. Chatbot output is full of arrows, ticks,
 *     crosses, box-drawing and emoji. The serverless Chromium that prints the
 *     PDF has exactly one system font (Open Sans), so anything the chosen faces
 *     lack has to come from fonts we ship, or it prints as an empty box.
 *
 * Each face's unicode-range is read from the font's own cmap rather than
 * trusted from metadata, so the renderer knows exactly which file draws which
 * character: it inlines only the files a document needs, and can report a
 * character that nothing draws instead of silently printing a box.
 *
 * The colour emoji font is the exception to "copied from npm": see
 * scripts/build-emoji-font.py for why it is pre-split and vendored.
 *
 * Run: npm run fonts (also runs automatically before dev, build and test)
 */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  formatUnicodeRange,
  parseUnicodeRange,
  readFontCodepoints,
} from "./lib/font-codepoints.mjs";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "fonts");
const MANIFEST = path.join(ROOT, "src", "lib", "fonts", "font-files.generated.json");
const EMOJI_DIR = path.join(ROOT, "vendor", "fonts", "noto-color-emoji");

/**
 * Bump when the manifest's shape or the range rules change. Together with the
 * package list below it forms a fingerprint, so editing either one rebuilds
 * public/fonts instead of trusting a copy made under the old rules.
 */
const GENERATOR_VERSION = 2;

/**
 * role:
 *   "face"   - selectable; ships every subset the package has.
 *   "script" - ships only the listed subsets.
 *   "symbol" - ships every file, but its unicode-range is cut down to what the
 *              selectable faces cannot draw, and never claims a character
 *              whose default presentation is emoji (that belongs to the
 *              colour emoji font).
 */
const REGULAR = { weights: [400], styles: ["normal"] };

const FONT_PACKAGES = [
  // --- sans ---
  { id: "inter", pkg: "@fontsource-variable/inter", role: "face" },
  { id: "ibm-plex-sans", pkg: "@fontsource-variable/ibm-plex-sans", role: "face" },
  { id: "source-sans-3", pkg: "@fontsource-variable/source-sans-3", role: "face" },
  { id: "figtree", pkg: "@fontsource-variable/figtree", role: "face" },
  { id: "noto-sans", pkg: "@fontsource-variable/noto-sans", role: "face" },

  // --- serif ---
  { id: "source-serif-4", pkg: "@fontsource-variable/source-serif-4", role: "face" },
  { id: "literata", pkg: "@fontsource-variable/literata", role: "face" },
  { id: "lora", pkg: "@fontsource-variable/lora", role: "face" },
  { id: "merriweather", pkg: "@fontsource-variable/merriweather", role: "face" },
  { id: "newsreader", pkg: "@fontsource-variable/newsreader", role: "face" },
  { id: "crimson-pro", pkg: "@fontsource-variable/crimson-pro", role: "face" },
  { id: "eb-garamond", pkg: "@fontsource/eb-garamond", role: "face", weights: [400, 700] },
  { id: "noto-serif", pkg: "@fontsource-variable/noto-serif", role: "face" },

  // --- mono ---
  { id: "jetbrains-mono", pkg: "@fontsource-variable/jetbrains-mono", role: "face" },
  { id: "fira-code", pkg: "@fontsource-variable/fira-code", role: "face" },
  { id: "source-code-pro", pkg: "@fontsource-variable/source-code-pro", role: "face" },
  { id: "ibm-plex-mono", pkg: "@fontsource/ibm-plex-mono", role: "face", weights: [400, 700] },

  // --- script fallbacks ---
  { id: "noto-sans-devanagari", pkg: "@fontsource-variable/noto-sans-devanagari", role: "script", subsets: ["devanagari"] },
  { id: "noto-serif-devanagari", pkg: "@fontsource-variable/noto-serif-devanagari", role: "script", subsets: ["devanagari"] },
  { id: "noto-sans-gujarati", pkg: "@fontsource-variable/noto-sans-gujarati", role: "script", subsets: ["gujarati"] },
  { id: "noto-sans-bengali", pkg: "@fontsource-variable/noto-sans-bengali", role: "script", subsets: ["bengali"] },
  { id: "noto-sans-gurmukhi", pkg: "@fontsource-variable/noto-sans-gurmukhi", role: "script", subsets: ["gurmukhi"] },
  { id: "noto-sans-oriya", pkg: "@fontsource-variable/noto-sans-oriya", role: "script", subsets: ["oriya"] },
  { id: "noto-sans-tamil", pkg: "@fontsource-variable/noto-sans-tamil", role: "script", subsets: ["tamil"] },
  { id: "noto-sans-telugu", pkg: "@fontsource-variable/noto-sans-telugu", role: "script", subsets: ["telugu"] },
  { id: "noto-sans-kannada", pkg: "@fontsource-variable/noto-sans-kannada", role: "script", subsets: ["kannada"] },
  { id: "noto-sans-malayalam", pkg: "@fontsource-variable/noto-sans-malayalam", role: "script", subsets: ["malayalam"] },
  { id: "noto-sans-arabic", pkg: "@fontsource-variable/noto-sans-arabic", role: "script", subsets: ["arabic"] },
  { id: "noto-sans-hebrew", pkg: "@fontsource-variable/noto-sans-hebrew", role: "script", subsets: ["hebrew"] },
  { id: "noto-sans-thai", pkg: "@fontsource-variable/noto-sans-thai", role: "script", subsets: ["thai"] },

  // --- symbol fallbacks ---
  //
  // Regular weight, upright only. A symbol in bold or italic text is rare
  // enough that Chromium's synthesised bold and slant are the right trade
  // against shipping - and inlining - four copies of every range.
  { id: "noto-sans-math", pkg: "@fontsource/noto-sans-math", role: "symbol", ...REGULAR },
  { id: "noto-sans-symbols-2", pkg: "@fontsource/noto-sans-symbols-2", role: "symbol", ...REGULAR },
  { id: "noto-sans-symbols", pkg: "@fontsource/noto-sans-symbols", role: "symbol", ...REGULAR },
  { id: "dejavu-sans", pkg: "@fontsource/dejavu-sans", role: "symbol", ...REGULAR },
  { id: "dejavu-sans-mono", pkg: "@fontsource/dejavu-mono", role: "symbol", ...REGULAR },
];

const EMOJI_ID = "noto-color-emoji";

const FINGERPRINT = createHash("sha256")
  .update(JSON.stringify({ GENERATOR_VERSION, FONT_PACKAGES }))
  .digest("hex")
  .slice(0, 16);

/** Default-emoji characters, which a text symbol font must never claim. */
const EMOJI_PRESENTATION = /\p{Emoji_Presentation}/u;

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function packageDir(pkg) {
  return path.dirname(require.resolve(`${pkg}/package.json`));
}

/**
 * Pick the files to ship for one package.
 *
 * Variable packages expose `<id>-<subset>-wght-<style>.woff2` - a single file
 * covering the whole weight axis. Static packages expose one file per weight.
 *
 * We probe the filesystem rather than trusting `metadata.variable`: some
 * packages (EB Garamond) describe a variable axis in metadata but only ship
 * static instances, because the variable build lives in a sibling package.
 */
function resolveFaces(dir, meta, entry) {
  const filesDir = path.join(dir, "files");
  const available = new Set(fs.readdirSync(filesDir));
  const styles = (entry.styles ?? meta.styles ?? ["normal"]).filter((style) =>
    (meta.styles ?? ["normal"]).includes(style),
  );
  const subsets = entry.subsets ?? meta.subsets;
  const faces = [];

  for (const subset of subsets) {
    if (!meta.subsets.includes(subset)) {
      throw new Error(`${entry.pkg} has no "${subset}" subset.`);
    }

    for (const style of styles) {
      const variableFile = `${meta.id}-${subset}-wght-${style}.woff2`;

      if (available.has(variableFile) && meta.variable?.wght) {
        const { min, max } = meta.variable.wght;
        faces.push({ file: variableFile, subset, style, weight: `${min} ${max}` });
        continue;
      }

      for (const weight of entry.weights ?? [400, 700]) {
        const file = `${meta.id}-${subset}-${weight}-${style}.woff2`;
        if (!available.has(file)) continue;
        faces.push({ file, subset, style, weight: String(weight) });
      }
    }
  }

  return faces;
}

function emojiManifest() {
  const file = path.join(EMOJI_DIR, "manifest.json");
  if (!fs.existsSync(file)) {
    throw new Error(
      `${path.relative(ROOT, file)} is missing. It is committed to the repository; ` +
        "restore it, or rebuild it with scripts/build-emoji-font.py.",
    );
  }
  return readJson(file);
}

/**
 * Skip the copy when the manifest already matches what is installed and every
 * file it references is on disk. Without this, `predev` would wipe and rewrite
 * public/fonts on every dev server start and send Next's watcher into a spin.
 */
function isUpToDate() {
  if (!fs.existsSync(MANIFEST)) return false;

  let generated;
  try {
    generated = readJson(MANIFEST);
  } catch {
    return false;
  }
  if (generated.fingerprint !== FINGERPRINT) return false;

  const manifest = generated.fonts ?? {};
  const expected = new Set([...FONT_PACKAGES.map((entry) => entry.id), EMOJI_ID]);
  const actual = new Set(Object.keys(manifest));
  if (expected.size !== actual.size) return false;
  for (const id of expected) if (!actual.has(id)) return false;

  for (const entry of FONT_PACKAGES) {
    const installed = readJson(path.join(packageDir(entry.pkg), "package.json"));
    if (manifest[entry.id].version !== installed.version) return false;
  }
  if (manifest[EMOJI_ID].version !== emojiManifest().version) return false;

  for (const record of Object.values(manifest)) {
    for (const face of record.faces) {
      if (!fs.existsSync(path.join(ROOT, "public", face.url.replace(/^\/fonts\//, "fonts/")))) {
        return false;
      }
    }
  }

  return true;
}

function main() {
  if (!process.argv.includes("--force") && isUpToDate()) {
    console.log("fonts: up to date");
    return;
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Pass 1: resolve every package and read each file's real coverage.
  const resolved = FONT_PACKAGES.map((entry) => {
    const dir = packageDir(entry.pkg);
    const meta = readJson(path.join(dir, "metadata.json"));
    const unicode = readJson(path.join(dir, "unicode.json"));
    const pkgJson = readJson(path.join(dir, "package.json"));

    const faces = resolveFaces(dir, meta, entry).map((face) => {
      const source = path.join(dir, "files", face.file);
      return { ...face, source, codepoints: readFontCodepoints(fs.readFileSync(source)) };
    });

    if (faces.length === 0) throw new Error(`No usable font files found for ${entry.pkg}`);
    return { entry, meta, unicode, pkgJson, faces };
  });

  // What every selectable face can draw. A symbol fallback only ever sits
  // behind one of these, so it never needs to claim any of it - and if it did,
  // a document's plain Latin text would make the renderer inline it for nothing.
  let common = null;
  for (const { entry, faces } of resolved) {
    if (entry.role !== "face") continue;
    const union = new Set();
    for (const face of faces) for (const cp of face.codepoints) union.add(cp);
    common = common === null ? union : new Set([...common].filter((cp) => union.has(cp)));
  }

  // Pass 2: settle each face's unicode-range and copy the file.
  const manifest = {};
  let fileCount = 0;
  let byteCount = 0;

  for (const { entry, meta, unicode, pkgJson, faces } of resolved) {
    const destDir = path.join(OUT_DIR, entry.id);
    fs.mkdirSync(destDir, { recursive: true });

    const kept = [];
    for (const face of faces) {
      let codepoints;

      if (entry.role === "symbol") {
        // Symbol packages' metadata ranges are unreliable (Noto Sans Math
        // labels its whole repertoire "latin"), so their own cmap decides.
        codepoints = [...face.codepoints].filter(
          (cp) => !common.has(cp) && !EMOJI_PRESENTATION.test(String.fromCodePoint(cp)),
        );
      } else {
        // Keep Google's partition between subsets, so a space or a digit is
        // never claimed by the Vietnamese file as well as the Latin one.
        const declared = unicode[face.subset];
        const allowed = declared ? parseUnicodeRange(declared) : null;
        codepoints = [...face.codepoints].filter((cp) => !allowed || allowed.has(cp));
      }

      if (codepoints.length === 0) continue;

      const dest = path.join(destDir, face.file);
      fs.copyFileSync(face.source, dest);
      byteCount += fs.statSync(dest).size;
      fileCount += 1;

      kept.push({
        url: `/fonts/${entry.id}/${face.file}`,
        subset: face.subset,
        style: face.style,
        weight: face.weight,
        unicodeRange: formatUnicodeRange(codepoints),
      });
    }

    manifest[entry.id] = {
      family: meta.family,
      category: meta.category,
      package: entry.pkg,
      version: pkgJson.version,
      license: meta.license?.type ?? pkgJson.license ?? "unknown",
      attribution: meta.license?.attribution ?? "",
      faces: kept,
    };
  }

  // The colour emoji font: pre-split, committed, copied as-is.
  const emoji = emojiManifest();
  const emojiOut = path.join(OUT_DIR, EMOJI_ID);
  fs.mkdirSync(emojiOut, { recursive: true });
  const emojiFaces = emoji.files.map((record) => {
    const source = path.join(EMOJI_DIR, record.file);
    const dest = path.join(emojiOut, record.file);
    fs.copyFileSync(source, dest);
    byteCount += fs.statSync(dest).size;
    fileCount += 1;
    return {
      url: `/fonts/${EMOJI_ID}/${record.file}`,
      subset: record.file.replace(/\.woff2$/, ""),
      style: "normal",
      weight: "400",
      unicodeRange: formatUnicodeRange(readFontCodepoints(fs.readFileSync(source))),
    };
  });
  manifest[EMOJI_ID] = {
    family: emoji.family,
    category: "emoji",
    package: emoji.package,
    version: emoji.version,
    license: emoji.license,
    attribution: "",
    faces: emojiFaces,
  };

  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  fs.writeFileSync(
    MANIFEST,
    `${JSON.stringify(
      {
        $comment: "GENERATED by scripts/sync-fonts.mjs - do not edit by hand.",
        fingerprint: FINGERPRINT,
        fonts: manifest,
      },
      null,
      2,
    )}\n`,
  );

  const kb = Math.round(byteCount / 1024);
  console.log(
    `fonts: ${Object.keys(manifest).length} families, ${fileCount} files, ${kb} KB -> public/fonts/`,
  );
}

main();
