/**
 * Copies the woff2 files we ship from the installed @fontsource packages into
 * public/fonts/, and emits a manifest describing the @font-face rules to write.
 *
 * Why not just `import "@fontsource/inter"`? Because these fonts are for the
 * *document*, not the app. The document CSS is generated as a string, embedded
 * in an <iframe> for preview and handed to headless Chromium for the PDF -
 * neither of which goes through the bundler. We need real, stable URLs.
 *
 * Everything here is read from each package's own metadata.json / unicode.json,
 * so adding a font is one line in FONT_PACKAGES below.
 *
 * Run: npm run fonts (also runs automatically before dev and build)
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "fonts");
const MANIFEST = path.join(ROOT, "src", "lib", "fonts", "font-files.generated.json");

/** Latin-script fonts ship latin + latin-ext; Devanagari fallbacks add devanagari. */
const LATIN = ["latin", "latin-ext"];

const FONT_PACKAGES = [
  // --- sans ---
  { id: "inter", pkg: "@fontsource-variable/inter", subsets: LATIN },
  { id: "ibm-plex-sans", pkg: "@fontsource-variable/ibm-plex-sans", subsets: LATIN },
  { id: "source-sans-3", pkg: "@fontsource-variable/source-sans-3", subsets: LATIN },
  { id: "figtree", pkg: "@fontsource-variable/figtree", subsets: LATIN },
  { id: "noto-sans", pkg: "@fontsource-variable/noto-sans", subsets: LATIN },

  // --- serif ---
  { id: "source-serif-4", pkg: "@fontsource-variable/source-serif-4", subsets: LATIN },
  { id: "literata", pkg: "@fontsource-variable/literata", subsets: LATIN },
  { id: "lora", pkg: "@fontsource-variable/lora", subsets: LATIN },
  { id: "merriweather", pkg: "@fontsource-variable/merriweather", subsets: LATIN },
  { id: "newsreader", pkg: "@fontsource-variable/newsreader", subsets: LATIN },
  { id: "crimson-pro", pkg: "@fontsource-variable/crimson-pro", subsets: LATIN },
  { id: "eb-garamond", pkg: "@fontsource/eb-garamond", subsets: LATIN, weights: [400, 700] },
  { id: "noto-serif", pkg: "@fontsource-variable/noto-serif", subsets: LATIN },

  // --- mono ---
  { id: "jetbrains-mono", pkg: "@fontsource-variable/jetbrains-mono", subsets: LATIN },
  { id: "fira-code", pkg: "@fontsource-variable/fira-code", subsets: LATIN },
  { id: "source-code-pro", pkg: "@fontsource-variable/source-code-pro", subsets: LATIN },
  { id: "ibm-plex-mono", pkg: "@fontsource/ibm-plex-mono", subsets: LATIN, weights: [400, 700] },

  // --- script fallbacks (appended to every stack, gated by unicode-range so
  //     they are only downloaded when Devanagari text actually appears) ---
  { id: "noto-sans-devanagari", pkg: "@fontsource-variable/noto-sans-devanagari", subsets: ["devanagari"] },
  { id: "noto-serif-devanagari", pkg: "@fontsource-variable/noto-serif-devanagari", subsets: ["devanagari"] },
];

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
function resolveFaces(dir, meta, unicode, entry) {
  const filesDir = path.join(dir, "files");
  const available = new Set(fs.readdirSync(filesDir));
  const styles = meta.styles ?? ["normal"];
  const faces = [];

  for (const subset of entry.subsets) {
    if (!meta.subsets.includes(subset)) continue;
    const range = unicode[subset];
    if (!range) continue;

    for (const style of styles) {
      const variableFile = `${meta.id}-${subset}-wght-${style}.woff2`;

      if (available.has(variableFile) && meta.variable?.wght) {
        const { min, max } = meta.variable.wght;
        faces.push({ file: variableFile, style, weight: `${min} ${max}`, unicodeRange: range });
        continue;
      }

      for (const weight of entry.weights ?? [400, 700]) {
        const file = `${meta.id}-${subset}-${weight}-${style}.woff2`;
        if (!available.has(file)) continue;
        faces.push({ file, style, weight: String(weight), unicodeRange: range });
      }
    }
  }

  return faces;
}

/**
 * Skip the copy when the manifest already matches what is installed and every
 * file it references is on disk. Without this, `predev` would wipe and rewrite
 * public/fonts on every dev server start and send Next's watcher into a spin.
 */
function isUpToDate() {
  if (!fs.existsSync(MANIFEST)) return false;

  let manifest;
  try {
    manifest = readJson(MANIFEST).fonts;
  } catch {
    return false;
  }

  const expected = new Set(FONT_PACKAGES.map((entry) => entry.id));
  const actual = new Set(Object.keys(manifest ?? {}));
  if (expected.size !== actual.size) return false;

  for (const entry of FONT_PACKAGES) {
    const record = manifest[entry.id];
    if (!record) return false;

    const installed = readJson(path.join(packageDir(entry.pkg), "package.json"));
    if (record.version !== installed.version) return false;

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

  const manifest = {};
  let fileCount = 0;
  let byteCount = 0;

  for (const entry of FONT_PACKAGES) {
    const dir = packageDir(entry.pkg);
    const meta = readJson(path.join(dir, "metadata.json"));
    const unicode = readJson(path.join(dir, "unicode.json"));
    const pkgJson = readJson(path.join(dir, "package.json"));

    const faces = resolveFaces(dir, meta, unicode, entry);
    if (faces.length === 0) {
      throw new Error(`No usable font files found for ${entry.pkg}`);
    }

    const destDir = path.join(OUT_DIR, entry.id);
    fs.mkdirSync(destDir, { recursive: true });

    for (const face of faces) {
      const src = path.join(dir, "files", face.file);
      const dest = path.join(destDir, face.file);
      fs.copyFileSync(src, dest);
      byteCount += fs.statSync(dest).size;
      fileCount += 1;
    }

    manifest[entry.id] = {
      family: meta.family,
      category: meta.category,
      package: entry.pkg,
      version: pkgJson.version,
      license: meta.license?.type ?? pkgJson.license ?? "unknown",
      attribution: meta.license?.attribution ?? "",
      faces: faces.map((face) => ({
        url: `/fonts/${entry.id}/${face.file}`,
        style: face.style,
        weight: face.weight,
        unicodeRange: face.unicodeRange,
      })),
    };
  }

  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  fs.writeFileSync(
    MANIFEST,
    `${JSON.stringify(
      {
        $comment: "GENERATED by scripts/sync-fonts.mjs - do not edit by hand.",
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
