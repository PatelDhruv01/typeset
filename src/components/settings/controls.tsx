"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Form primitives for the settings panel.
 *
 * There are roughly ninety configurable fields. Written one at a time they
 * would drift apart in spacing, label placement and focus behaviour within a
 * day, so every control in the panel is built from this file. Each one is
 * label-associated and keyboard-operable; none of them own state.
 *
 * Visually these follow the Modernist design system: zero corner radius (most
 * of that comes free from the `--radius-*` tokens all being 0, but `rounded-
 * full` - used for pill-shaped toggles and sliders - is a hardcoded Tailwind
 * utility that does not derive from those tokens, so it needs an explicit
 * square treatment below), flush-left labels, and the one accent colour used
 * sparingly.
 */

export function Field({
  label,
  hint,
  htmlFor,
  children,
  inline = false,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  /** Label and control on one row - for toggles and short selects. */
  inline?: boolean;
}) {
  return (
    <div className={inline ? "flex items-center justify-between gap-3 py-1.5" : "py-1.5"}>
      <div className={inline ? "min-w-0" : "mb-1"}>
        <label
          htmlFor={htmlFor}
          className="block text-xs text-foreground"
        >
          {label}
        </label>
        {hint && (
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
      <div className={inline ? "shrink-0" : ""}>{children}</div>
    </div>
  );
}

export const inputClass =
  "w-full min-h-[34px] border border-input bg-surface px-2.5 py-1.5 text-xs text-foreground outline-none transition-colors hover:border-foreground/45 focus-visible:border-primary";

export function TextInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
    />
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  id,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className={`${inputClass} min-w-[7rem]`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Grouped font picker.
 *
 * Each font's one-line description sits in the option text rather than a
 * tooltip: choosing a typeface from a list of names alone is guesswork unless
 * you already know them all.
 */
export function FontSelect({
  value,
  groups,
  onChange,
  id,
  extra,
}: {
  value: string;
  groups: { label: string; fonts: { id: string; name: string; description: string }[] }[];
  onChange: (value: string) => void;
  id?: string;
  /** Prepended options, e.g. "Same as body". */
  extra?: readonly { value: string; label: string }[];
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
    >
      {extra?.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
      {groups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.fonts.map((font) => (
            <option key={font.id} value={font.id}>
              {font.name} — {font.description}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** Formats the way the field displays itself when the user is not typing. */
function formatNumber(value: number): string {
  return String(Number(value.toFixed(3)));
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  id,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  id?: string;
}) {
  // The field shows its own draft text rather than being fully controlled by
  // `value`. A number input reformatted on every keystroke - as this one used
  // to be, via value={Number(value.toFixed(3))} - fights the user: typing the
  // "." in "0.75" immediately parsed to 0.75... no, worse: after typing just
  // "0.", Number("0.") is 0, so the field's value prop snapped back to "0"
  // before "75" could be typed, and the decimal point never landed.
  const [draft, setDraft] = useState(() => formatNumber(value));
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) setDraft(formatNumber(value));
  }, [value]);

  return (
    <div className="flex items-center gap-1.5">
      <input
        id={id}
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        onFocus={() => {
          isFocused.current = true;
        }}
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw);
          const next = Number(raw);
          // Mid-edit states like "" or "-" parse to NaN or 0 in ways that would
          // be wrong to commit; wait for something that actually means a number.
          if (raw !== "" && raw !== "-" && Number.isFinite(next)) onChange(next);
        }}
        onBlur={() => {
          isFocused.current = false;
          // Whatever was left half-typed (or invalid) reverts to the last
          // value that actually committed.
          setDraft(formatNumber(value));
        }}
        className={`${inputClass} w-20 text-right tabular-nums`}
      />
      {unit && (
        <span className="w-6 shrink-0 text-[11px] text-muted-foreground">
          {unit}
        </span>
      )}
    </div>
  );
}

/** Shared thumb styling for the two `<input type="range">`s below, in the design's flat square accent block rather than a native rounded thumb. */
const RANGE_THUMB =
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer " +
  "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer";

export function Slider({
  value,
  onChange,
  min,
  max,
  step,
  format,
  id,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  id?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`h-0.5 flex-1 cursor-pointer appearance-none bg-border ${RANGE_THUMB}`}
      />
      <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
        {format ? format(value) : value}
      </span>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Used as the accessible name; the visible label comes from <Field>. */
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[17px] w-[30px] shrink-0 border border-transparent transition-colors hover:border-foreground ${
        checked ? "bg-primary" : "bg-border"
      }`}
    >
      <span
        className={`absolute top-0.5 size-3 bg-background transition-all ${
          checked ? "left-[15px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex overflow-hidden border border-input"
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 border-input px-2 py-1.5 text-[11px] transition-colors ${
            index > 0 ? "border-l" : ""
          } ${
            value === option.value
              ? "bg-primary text-primary-foreground"
              : "text-foreground hover:bg-surface-hover"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Colour input.
 *
 * A native swatch plus the hex text, because both are needed: the swatch for
 * picking and the text for pasting a brand colour someone sent you.
 */
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function ColorInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const id = useId();

  // A local draft for the text field, for the same reason as NumberInput:
  // fully controlling it by `value` while only calling onChange on a complete
  // hex meant every incomplete keystroke - "#ff", "#ff0" while typing "#ff00ff"
  // - was immediately overwritten back to the last full colour, so nothing
  // typed there ever visibly landed.
  const [draft, setDraft] = useState(value);
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) setDraft(value);
  }, [value]);

  return (
    <div className="flex items-center gap-2">
      <div
        className="relative size-7 shrink-0 border border-input"
        style={{ background: value }}
      >
        <input
          id={id}
          type="color"
          value={value}
          aria-label={label}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer border-0 bg-transparent p-0 opacity-0"
        />
      </div>
      <input
        type="text"
        value={draft}
        aria-label={`${label} hex value`}
        onFocus={() => {
          isFocused.current = true;
        }}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          // Only commit a complete 6-digit hex; the schema rejects anything
          // else, and a partial value has nothing sensible to become yet.
          if (HEX_COLOR.test(next.trim())) onChange(next.trim().toLowerCase());
        }}
        onBlur={() => {
          isFocused.current = false;
          // Left incomplete - revert rather than leave a colour that never
          // actually applied sitting in the field.
          if (!HEX_COLOR.test(draft.trim())) setDraft(value);
        }}
        className={`${inputClass} w-20 font-mono uppercase`}
      />
    </div>
  );
}

/** Multi-select as a row of toggle chips. Used for `avoidBreakInside`. */
export function ChipGroup<T extends string>({
  values,
  options,
  onChange,
  label,
}: {
  values: readonly T[];
  options: readonly { value: T; label: string }[];
  onChange: (values: T[]) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = values.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() =>
              onChange(
                active
                  ? values.filter((v) => v !== option.value)
                  : [...values, option.value],
              )
            }
            className={`border px-2 py-1 text-[11px] transition-colors ${
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input text-muted-foreground hover:bg-surface-hover"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** The 4-way tab switcher at the top of the settings panel. */
export function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex border-b-2 border-border">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-current={value === option.value ? "true" : undefined}
          onClick={() => onChange(option.value)}
          className={`flex-1 -mb-0.5 border-b-2 py-2.5 text-xs font-bold transition-colors ${
            value === option.value
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:bg-surface-hover"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** A strong 2px rule, separating kicker groups within a tab. */
export function Hr() {
  return <div className="my-4 h-0.5 bg-border" role="separator" />;
}

/** A labelled divider inside a tab - the small uppercase kicker above a group of fields. */
export function SubHeading({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}
