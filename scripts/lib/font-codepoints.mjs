/**
 * Which characters does a font file actually draw?
 *
 * The unicode ranges that @fontsource publishes describe what Google *meant* a
 * subset to contain, not what the file holds: a "latin" range spans all of
 * U+2000-206F whether or not the font draws every character in it. Typeset
 * uses the real answer - the font's own cmap - to pick which fallback font
 * draws a character, to inline only the files a document needs, and to report
 * any character nothing can draw instead of printing an empty box.
 *
 * WOFF2 is decoded with Node's built-in Brotli, so this needs no dependency.
 * The cmap table is never transformed by WOFF2 (only glyf, loca and hmtx can
 * be), so it can be read straight out of the decompressed stream.
 */
import zlib from "node:zlib";

const WOFF2_SIGNATURE = 0x774f4632; // "wOF2"

/** WOFF2's table-tag shorthand. The index is the low six bits of the flags byte. */
const KNOWN_TAGS = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm",
  "glyf", "loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern",
  "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC",
  "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar",
  "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty",
  "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat",
  "Gloc", "Feat", "Sill",
];

function tagAt(view, offset) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

/** WOFF2's variable-length integer: up to five bytes, seven bits each. */
function readBase128(view, cursor) {
  let value = 0;
  for (let i = 0; i < 5; i += 1) {
    const byte = view.getUint8(cursor.offset);
    cursor.offset += 1;
    if (i === 0 && byte === 0x80) throw new Error("Invalid UIntBase128 (leading zero).");
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return value;
  }
  throw new Error("UIntBase128 longer than five bytes.");
}

/** The raw bytes of the cmap table, from a WOFF2 file. */
function cmapFromWoff2(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const flavor = view.getUint32(4);
  if (flavor === 0x74746366) throw new Error("WOFF2 font collections are not supported.");

  const numTables = view.getUint16(12);
  const totalCompressedSize = view.getUint32(20);
  const cursor = { offset: 48 };

  let streamOffset = 0;
  let cmap = null;

  for (let i = 0; i < numTables; i += 1) {
    const flags = view.getUint8(cursor.offset);
    cursor.offset += 1;

    const tagIndex = flags & 0x3f;
    let tag;
    if (tagIndex === 0x3f) {
      tag = tagAt(view, cursor.offset);
      cursor.offset += 4;
    } else {
      tag = KNOWN_TAGS[tagIndex];
    }

    const transformVersion = (flags >> 6) & 0x03;
    const origLength = readBase128(view, cursor);

    // glyf and loca are transformed at version 0; every other table is
    // transformed at any version other than 0.
    const transformed =
      tag === "glyf" || tag === "loca" ? transformVersion === 0 : transformVersion !== 0;
    const length = transformed ? readBase128(view, cursor) : origLength;

    if (tag === "cmap") cmap = { offset: streamOffset, length };
    streamOffset += length;
  }

  if (!cmap) throw new Error("Font has no cmap table.");

  const compressed = buffer.subarray(cursor.offset, cursor.offset + totalCompressedSize);
  const stream = zlib.brotliDecompressSync(compressed);
  return stream.subarray(cmap.offset, cmap.offset + cmap.length);
}

/** The raw bytes of the cmap table, from a TrueType/OpenType file. */
function cmapFromSfnt(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const numTables = view.getUint16(4);
  for (let i = 0; i < numTables; i += 1) {
    const record = 12 + i * 16;
    if (tagAt(view, record) === "cmap") {
      const offset = view.getUint32(record + 8);
      const length = view.getUint32(record + 12);
      return buffer.subarray(offset, offset + length);
    }
  }
  throw new Error("Font has no cmap table.");
}

/** Format 4: 16-bit segments with deltas or a glyph index array. */
function readFormat4(view, base, out) {
  const segCount = view.getUint16(base + 6) / 2;
  const endCodes = base + 14;
  const startCodes = endCodes + segCount * 2 + 2;
  const idDeltas = startCodes + segCount * 2;
  const idRangeOffsets = idDeltas + segCount * 2;

  for (let s = 0; s < segCount; s += 1) {
    const end = view.getUint16(endCodes + s * 2);
    const start = view.getUint16(startCodes + s * 2);
    const delta = view.getInt16(idDeltas + s * 2);
    const rangeOffsetAt = idRangeOffsets + s * 2;
    const rangeOffset = view.getUint16(rangeOffsetAt);

    for (let cp = start; cp <= end && cp !== 0xffff; cp += 1) {
      let glyph;
      if (rangeOffset === 0) {
        glyph = (cp + delta) & 0xffff;
      } else {
        const glyphAt = rangeOffsetAt + rangeOffset + (cp - start) * 2;
        glyph = view.getUint16(glyphAt);
        if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
      }
      if (glyph !== 0) out.add(cp);
    }
  }
}

/** Format 12: 32-bit sequential groups. */
function readFormat12(view, base, out) {
  const groups = view.getUint32(base + 12);
  for (let g = 0; g < groups; g += 1) {
    const record = base + 16 + g * 12;
    const start = view.getUint32(record);
    const end = view.getUint32(record + 4);
    const startGlyph = view.getUint32(record + 8);
    for (let cp = start; cp <= end; cp += 1) {
      if (startGlyph + (cp - start) !== 0) out.add(cp);
    }
  }
}

/**
 * Every codepoint the font maps to a real glyph (not .notdef).
 *
 * Prefers a full-repertoire subtable (format 12) and falls back to the BMP one
 * (format 4). Variation-sequence subtables (format 14) are ignored: they say
 * how to draw a sequence, not which characters exist.
 */
export function readFontCodepoints(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const signature = bytes.readUInt32BE(0);
  const table = signature === WOFF2_SIGNATURE ? cmapFromWoff2(bytes) : cmapFromSfnt(bytes);

  const view = new DataView(table.buffer, table.byteOffset, table.byteLength);
  const count = view.getUint16(2);
  const subtables = [];

  for (let i = 0; i < count; i += 1) {
    const record = 4 + i * 8;
    const platform = view.getUint16(record);
    const encoding = view.getUint16(record + 2);
    const offset = view.getUint32(record + 4);
    subtables.push({ platform, encoding, offset, format: view.getUint16(offset) });
  }

  const unicode = (s) => s.platform === 0 || (s.platform === 3 && (s.encoding === 1 || s.encoding === 10));
  const full = subtables.find((s) => unicode(s) && s.format === 12);
  const bmp = subtables.find((s) => unicode(s) && s.format === 4);

  const out = new Set();
  if (full) readFormat12(view, full.offset, out);
  else if (bmp) readFormat4(view, bmp.offset, out);
  else throw new Error("Font has no Unicode cmap subtable in format 4 or 12.");

  return out;
}

/** Sorted codepoints -> the shortest CSS unicode-range string. */
export function formatUnicodeRange(codepoints) {
  const sorted = [...codepoints].sort((a, b) => a - b);
  const spans = [];
  for (const cp of sorted) {
    const last = spans[spans.length - 1];
    if (last && cp === last[1] + 1) last[1] = cp;
    else spans.push([cp, cp]);
  }
  return spans
    .map(([a, b]) => (a === b ? `U+${a.toString(16)}` : `U+${a.toString(16)}-${b.toString(16)}`))
    .join(",");
}

/** "U+0-ff,U+131" -> the codepoints it covers. */
export function parseUnicodeRange(range) {
  const out = new Set();
  for (const part of range.split(",")) {
    const trimmed = part.trim().replace(/^U\+/i, "");
    if (trimmed === "") continue;
    if (trimmed.includes("?")) {
      const start = parseInt(trimmed.replace(/\?/g, "0"), 16);
      const end = parseInt(trimmed.replace(/\?/g, "f"), 16);
      for (let cp = start; cp <= end; cp += 1) out.add(cp);
      continue;
    }
    const [a, b] = trimmed.split("-");
    const start = parseInt(a, 16);
    const end = b ? parseInt(b, 16) : start;
    for (let cp = start; cp <= end; cp += 1) out.add(cp);
  }
  return out;
}
