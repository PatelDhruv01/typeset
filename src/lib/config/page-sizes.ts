/**
 * Page geometry.
 *
 * One rule holds everywhere in this codebase: **page geometry is millimetres,
 * type is points.** Nothing is stored in inches or centimetres. The UI converts
 * for display and the PDF engine formats units at the boundary, so no interior
 * code ever has to ask "which unit is this number in?".
 */

export type PageSizeId =
  | "a4"
  | "letter"
  | "legal"
  | "a3"
  | "a5"
  | "b5"
  | "tabloid"
  | "executive";

export type PageSize = {
  id: PageSizeId;
  name: string;
  /** Portrait width in millimetres. */
  width: number;
  /** Portrait height in millimetres. */
  height: number;
  note: string;
};

export const PAGE_SIZES: Record<PageSizeId, PageSize> = {
  a4: {
    id: "a4",
    name: "A4",
    width: 210,
    height: 297,
    note: "International standard. Use unless you are printing in North America.",
  },
  letter: {
    id: "letter",
    name: "Letter",
    width: 215.9,
    height: 279.4,
    note: "US and Canada default. Wider and shorter than A4.",
  },
  legal: {
    id: "legal",
    name: "Legal",
    width: 215.9,
    height: 355.6,
    note: "US legal filings. Very tall.",
  },
  a3: {
    id: "a3",
    name: "A3",
    width: 297,
    height: 420,
    note: "Twice A4. For posters, large tables and wide diagrams.",
  },
  a5: {
    id: "a5",
    name: "A5",
    width: 148,
    height: 210,
    note: "Half A4. Booklets and handouts.",
  },
  b5: {
    id: "b5",
    name: "B5",
    width: 176,
    height: 250,
    note: "Common trim size for printed books.",
  },
  tabloid: {
    id: "tabloid",
    name: "Tabloid",
    width: 279.4,
    height: 431.8,
    note: "US large format. Twice Letter.",
  },
  executive: {
    id: "executive",
    name: "Executive",
    width: 184.1,
    height: 266.7,
    note: "Compact US business size.",
  },
};

export const PAGE_SIZE_IDS = Object.keys(PAGE_SIZES) as [
  PageSizeId,
  ...PageSizeId[],
];

export type MarginPresetId = "narrow" | "normal" | "wide" | "book";

export type Margins = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export const MARGIN_PRESETS: Record<
  MarginPresetId,
  { name: string; note: string; margins: Margins }
> = {
  narrow: {
    name: "Narrow",
    note: "Maximum content per page. Good for reference material.",
    margins: { top: 15, right: 12, bottom: 15, left: 12 },
  },
  normal: {
    name: "Normal",
    note: "Balanced. Comfortable to read and to print.",
    margins: { top: 25, right: 20, bottom: 25, left: 20 },
  },
  wide: {
    name: "Wide",
    note: "Generous margins. Room for annotation and binding.",
    margins: { top: 30, right: 30, bottom: 30, left: 30 },
  },
  book: {
    name: "Book",
    note: "Asymmetric, with extra space on the left for binding.",
    margins: { top: 25, right: 18, bottom: 28, left: 30 },
  },
};

/** Physical page dimensions in millimetres, after orientation is applied. */
export function resolvePageSize(
  size: PageSizeId | "custom",
  orientation: "portrait" | "landscape",
  custom: { width: number; height: number },
): { width: number; height: number } {
  const base = size === "custom" ? custom : PAGE_SIZES[size];
  return orientation === "landscape"
    ? { width: base.height, height: base.width }
    : { width: base.width, height: base.height };
}

/** Width available to content, after margins. Millimetres. */
export function contentWidth(
  page: { width: number },
  margins: Margins,
): number {
  return Math.max(0, page.width - margins.left - margins.right);
}

const MM_PER: Record<LengthUnit, number> = {
  mm: 1,
  cm: 10,
  in: 25.4,
  pt: 25.4 / 72,
};

export type LengthUnit = "mm" | "cm" | "in" | "pt";

export const LENGTH_UNITS: [LengthUnit, ...LengthUnit[]] = [
  "mm",
  "cm",
  "in",
  "pt",
];

/** Millimetres -> the given unit (for display in the UI). */
export function mmTo(value: number, unit: LengthUnit): number {
  return value / MM_PER[unit];
}

/** The given unit -> millimetres (for storing what the user typed). */
export function toMm(value: number, unit: LengthUnit): number {
  return value * MM_PER[unit];
}

/** Round to a sensible number of decimals for the unit, for display. */
export function formatLength(mm: number, unit: LengthUnit): string {
  const value = mmTo(mm, unit);
  const decimals = unit === "in" ? 2 : unit === "cm" ? 1 : 0;
  return `${Number(value.toFixed(decimals))}${unit}`;
}
