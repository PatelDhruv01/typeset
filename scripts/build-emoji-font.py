"""
Builds the colour-emoji font Typeset ships, from @fontsource/noto-color-emoji.

Run this only when upgrading the emoji font. Its output is committed under
vendor/fonts/noto-color-emoji/ and copied into public/fonts by sync-fonts.mjs,
so neither `npm install` nor a Vercel build ever needs Python.

Why the npm package cannot be used as it comes:

  * Its eleven numbered subsets are OpenType-SVG fonts. Chrome does not render
    SVG glyphs, so every emoji drawn from them comes out blank - in the preview
    and in the PDF.
  * Its single "emoji" file does carry COLRv1 colour glyphs, which Chrome both
    renders and prints to PDF as vectors. But it is 5.6 MB, mostly an SVG table
    Chrome ignores, and it would have to be inlined whole into every render.
  * harfbuzzjs, the only subsetter available from JavaScript, is compiled
    without colour-table support and silently drops COLR and CPAL, producing
    black-and-white emoji.

So this splits the COLRv1 master along Google's own unicode-range groups - the
ones in the package's unicode.json. Google designed those groups so that every
part of an emoji sequence (ZWJ, skin tone, flag, keycap, tag) sits in the same
file, which is what lets a sequence like 👩🏾‍🔬 form its ligature at all once
the font is split. The SVG table is dropped.

Usage:

    python -m pip install fonttools brotli
    npm install --no-save @fontsource/noto-color-emoji@<version>
    python scripts/build-emoji-font.py [--source path/to/@fontsource/noto-color-emoji]

It takes several minutes: fontTools walks the 42,000-glyph master once per file.
"""

import argparse
import io
import json
import os
import re
import shutil
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_DIR = os.path.join(ROOT, "vendor", "fonts", "noto-color-emoji")
MASTER_FILE = "noto-color-emoji-emoji-400-normal.woff2"


def parse_range(value):
    """'U+1f1e6-1f1ff,U+200d' -> [0x1f1e6, ..., 0x1f1ff, 0x200d]"""
    out = []
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        start, _, end = part[2:].partition("-")
        out.extend(range(int(start, 16), int(end or start, 16) + 1))
    return out


def format_range(codepoints):
    """Sorted codepoints -> the shortest unicode-range string."""
    spans = []
    for cp in sorted(set(codepoints)):
        if spans and cp == spans[-1][1] + 1:
            spans[-1][1] = cp
        else:
            spans.append([cp, cp])
    return ",".join(
        f"U+{a:x}" if a == b else f"U+{a:x}-{b:x}" for a, b in spans
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        default=os.path.join(ROOT, "node_modules", "@fontsource", "noto-color-emoji"),
        help="Directory of the installed @fontsource/noto-color-emoji package",
    )
    args = parser.parse_args()

    source = os.path.abspath(args.source)
    master_path = os.path.join(source, "files", MASTER_FILE)
    if not os.path.exists(master_path):
        sys.exit(
            f"{master_path} not found. Install the package first:\n"
            "  npm install --no-save @fontsource/noto-color-emoji"
        )

    with open(os.path.join(source, "package.json"), encoding="utf8") as handle:
        version = json.load(handle)["version"]
    with open(os.path.join(source, "unicode.json"), encoding="utf8") as handle:
        groups = json.load(handle)

    # Decode the woff2 and drop the SVG table once, then hand each subset an
    # in-memory TrueType copy. Re-decompressing 5.6 MB of Brotli per file would
    # double an already slow run.
    master = TTFont(master_path)
    if "COLR" not in master or master["COLR"].version != 1:
        sys.exit("The master font no longer carries a COLRv1 table; revisit this script.")
    del master["SVG "]
    master.flavor = None
    buffer = io.BytesIO()
    master.save(buffer)
    master_bytes = buffer.getvalue()
    master_cmap = set(master.getBestCmap().keys())

    shutil.rmtree(OUT_DIR, ignore_errors=True)
    os.makedirs(OUT_DIR)

    def group_index(key):
        match = re.search(r"\d+", key)
        return int(match.group()) if match else 0

    files = []
    plan = []
    covered = set()

    for key in sorted(groups, key=group_index):
        wanted = [cp for cp in parse_range(groups[key]) if cp in master_cmap]
        if wanted:
            covered.update(wanted)
            plan.append((f"noto-color-emoji-{group_index(key)}.woff2", wanted))

    # A handful of codepoints are in the master but in none of Google's groups
    # (U+1F46A FAMILY, for one). They still have to draw, so they get a file of
    # their own. The space is left out: it is never drawn from the emoji font.
    leftover = sorted(master_cmap - covered - {0x20})
    if len(leftover) > 64:
        sys.exit(f"{len(leftover)} codepoints fell outside every group; revisit the grouping.")
    if leftover:
        plan.append(("noto-color-emoji-extra.woff2", leftover))

    for name, wanted in plan:
        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = ["*"]
        options.name_IDs = ["*"]
        options.notdef_outline = True

        font = TTFont(io.BytesIO(master_bytes))
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=wanted)
        subsetter.subset(font)

        if "COLR" not in font or "CPAL" not in font:
            sys.exit(f"{name} lost its colour tables.")

        font.flavor = "woff2"
        font.save(os.path.join(OUT_DIR, name))

        files.append(
            {
                "file": name,
                "unicodeRange": format_range(font.getBestCmap().keys()),
            }
        )
        size = os.path.getsize(os.path.join(OUT_DIR, name))
        print(f"{name}: {len(wanted)} codepoints, {size // 1024} KB", flush=True)

    shutil.copyfile(os.path.join(source, "LICENSE"), os.path.join(OUT_DIR, "LICENSE"))

    # newline="\n": the same bytes on every platform, not CRLF on Windows.
    with open(os.path.join(OUT_DIR, "manifest.json"), "w", encoding="utf8", newline="\n") as handle:
        json.dump(
            {
                "$comment": "GENERATED by scripts/build-emoji-font.py - do not edit by hand.",
                "family": "Noto Color Emoji",
                "package": "@fontsource/noto-color-emoji",
                "version": version,
                "license": "OFL-1.1",
                "files": files,
            },
            handle,
            indent=2,
        )
        handle.write("\n")

    print(f"{len(files)} files -> {os.path.relpath(OUT_DIR, ROOT)}")


if __name__ == "__main__":
    main()
