import type { PartialDocumentConfig } from "@/lib/config/schema";

/**
 * Deep-merge one partial config over another.
 *
 * Needed wherever two partial configs are layered: a preset plus API overrides,
 * a shared link plus local edits, saved defaults plus a per-document tweak. A
 * spread would not do - `{...preset, ...overrides}` replaces whole branches, so
 * `{page: {size: "letter"}}` would silently discard the preset's margins.
 *
 * Three rules:
 *
 *   - Plain objects merge recursively.
 *   - Arrays replace wholesale. There is no sensible element-wise merge for
 *     `keywords` or `avoidBreakInside`, and half-merging them would be worse
 *     than either alternative.
 *   - `null` is a value, not an absence. `measure: null` means "full column
 *     width" and must be able to override a number. Only `undefined` is treated
 *     as "not specified".
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  if (Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function mergeUnknown(base: unknown, patch: unknown): unknown {
  if (patch === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch;

  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(patch)) {
    // Guard against prototype pollution: this merges data that can arrive from
    // an API request body.
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      continue;
    }
    const patchValue = patch[key];
    if (patchValue === undefined) continue;
    result[key] = mergeUnknown(result[key], patchValue);
  }

  return result;
}

export function mergeConfig(
  base: PartialDocumentConfig,
  ...patches: (PartialDocumentConfig | undefined)[]
): PartialDocumentConfig {
  return patches.reduce<PartialDocumentConfig>(
    (accumulated, patch) =>
      mergeUnknown(accumulated, patch) as PartialDocumentConfig,
    base,
  );
}
