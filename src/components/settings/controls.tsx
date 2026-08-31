"use client";

import { useId, type ReactNode } from "react";

/**
 * Form primitives for the settings panel.
 *
 * There are roughly ninety configurable fields. Written one at a time they
 * would drift apart in spacing, label placement and focus behaviour within a
 * day, so every control in the panel is built from this file. Each one is
 * label-associated and keyboard-operable; none of them own state.
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
    <div className={inline ? "flex items-center justify-between gap-3 py-1" : "py-1"}>
      <div className={inline ? "min-w-0" : "mb-1"}>
        <label
          htmlFor={htmlFor}
          className="block text-xs font-medium text-foreground"
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

const inputClass =
  "w-full rounded-md border border-input bg-card px-2 py-1 text-xs text-foreground outline-none transition-colors focus-visible:border-ring";

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
  return (
    <div className="flex items-center gap-1">
      <input
        id={id}
        type="number"
        value={Number(value.toFixed(3))}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          // An empty field parses to NaN. Ignoring it keeps the last valid
          // value instead of throwing the whole config out of validation.
          if (Number.isFinite(next)) onChange(next);
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
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
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
      className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`absolute top-0.5 size-3 rounded-full bg-card transition-all ${
          checked ? "left-3.5" : "left-0.5"
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
      className="flex overflow-hidden rounded-md border border-input"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`px-2 py-1 text-[11px] transition-colors ${
            value === option.value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-surface-hover"
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

  return (
    <div className="flex items-center gap-1.5">
      <input
        id={id}
        type="color"
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className="size-6 shrink-0 cursor-pointer rounded border border-input bg-card p-0.5"
      />
      <input
        type="text"
        value={value}
        aria-label={`${label} hex value`}
        onChange={(event) => {
          const next = event.target.value.trim();
          // Only commit a complete 6-digit hex; the schema rejects anything
          // else, and rejecting mid-typing would fight the user.
          if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next.toLowerCase());
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
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
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
            className={`rounded border px-1.5 py-0.5 text-[11px] transition-colors ${
              active
                ? "border-primary bg-primary/10 text-foreground"
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

/**
 * A collapsible group.
 *
 * The `summary` is the point: ninety fields behind nine closed headings is only
 * usable if each heading says what is currently set, so you can find the one
 * you want without opening all of them.
 */
export function Section({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-hover"
      >
        <svg
          viewBox="0 0 24 24"
          width="12"
          height="12"
          aria-hidden
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold">{title}</span>
          {!open && (
            <span className="block truncate text-[11px] text-muted-foreground">
              {summary}
            </span>
          )}
        </span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

/** A labelled divider inside a section. */
export function SubHeading({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}
