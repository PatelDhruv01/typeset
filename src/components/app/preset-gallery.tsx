"use client";

import { Check } from "lucide-react";

import { resolvePageSize } from "@/lib/config/page-sizes";
import { configFromPreset, PRESET_IDS, PRESETS, type PresetId } from "@/lib/config/presets";
import { fontFaceCss, fontStack, type FontId } from "@/lib/fonts";
import { cn } from "@/lib/cn";

/**
 * The style presets, shown as miniature pages rather than a list of names.
 * Each thumbnail is drawn from the preset's own config - its page shape,
 * colours, typefaces, alignment and cover - so it cannot drift out of date
 * when a preset changes.
 */

const PRESET_CONFIGS = Object.fromEntries(
  PRESET_IDS.map((id) => [id, configFromPreset(id)]),
) as Record<PresetId, ReturnType<typeof configFromPreset>>;

function headingFontOf(id: PresetId): FontId {
  const { headingFont, bodyFont } = PRESET_CONFIGS[id].typography;
  return headingFont === "inherit" ? bodyFont : headingFont;
}

/**
 * @font-face rules for the faces the thumbnails letter in. Only the Latin
 * files are selected - "Aa" is all they draw - so this is a few small
 * requests, made once the gallery first opens.
 */
const THUMBNAIL_FONT_CSS = fontFaceCss(
  [...new Set(PRESET_IDS.flatMap((id) => [headingFontOf(id), PRESET_CONFIGS[id].typography.bodyFont]))],
  (url) => url,
  "Aa",
);

function Lines({
  widths,
  colour,
  unit,
}: {
  widths: readonly number[];
  colour: string;
  unit: number;
}) {
  return (
    <>
      {widths.map((width, index) => (
        <div
          key={index}
          style={{
            width: `${width}%`,
            height: Math.max(2, unit * 0.9),
            marginTop: unit * 1.5,
            borderRadius: unit,
            background: colour,
            opacity: 0.24,
          }}
        />
      ))}
    </>
  );
}

export function PresetThumbnail({ id, height = 112 }: { id: PresetId; height?: number }) {
  const config = PRESET_CONFIGS[id];
  const { theme, typography, cover, structure } = config;
  const size = resolvePageSize(config.page.size, config.page.orientation, {
    width: config.page.customWidth,
    height: config.page.customHeight,
  });

  const unit = height / 48;
  const justify = typography.align === "justify";
  const prose = justify ? [100, 100, 100, 62] : [100, 92, 97, 58];

  return (
    <div
      aria-hidden
      className="relative shrink-0 overflow-hidden rounded-[3px] shadow-[0_1px_2px_rgb(0_0_0/0.14),0_6px_14px_-6px_rgb(0_0_0/0.28)]"
      style={{
        height,
        aspectRatio: `${size.width} / ${size.height}`,
        background: theme.pageBackground,
      }}
    >
      <div className="absolute inset-0 flex flex-col" style={{ padding: `${unit * 5}px ${unit * 4.4}px` }}>
        {cover.enabled ? (
          <div className="flex h-full flex-col">
            <div style={{ width: "28%", height: unit * 0.9, background: theme.accent }} />
            <div
              style={{
                marginTop: unit * 7,
                fontFamily: fontStack(headingFontOf(id)),
                color: theme.heading,
                fontSize: unit * 6.4,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              Aa
            </div>
            <Lines widths={[76, 54]} colour={theme.text} unit={unit} />
            <div className="mt-auto" />
            <Lines widths={[40]} colour={theme.text} unit={unit} />
          </div>
        ) : (
          <>
            <div
              style={{
                fontFamily: fontStack(headingFontOf(id)),
                color: theme.heading,
                fontSize: unit * 5.4,
                fontWeight: 700,
                lineHeight: 1,
                textAlign: structure.numberHeadings ? "left" : undefined,
              }}
            >
              {structure.numberHeadings ? (
                <span style={{ color: theme.accent, marginRight: unit * 1.2 }}>1</span>
              ) : null}
              Aa
            </div>
            <div style={{ marginTop: unit * 1.6, height: 1, background: theme.border }} />
            <Lines widths={prose} colour={theme.text} unit={unit} />
            <div
              style={{
                marginTop: unit * 2.4,
                height: unit * 6,
                borderRadius: unit * 0.8,
                background: theme.codeBackground,
                border: `1px solid ${theme.border}`,
              }}
            />
            <Lines widths={justify ? [100, 100] : [100, 84]} colour={theme.text} unit={unit} />
          </>
        )}
      </div>
    </div>
  );
}

export function PresetGallery({
  value,
  modified,
  onSelect,
  columns = 2,
  thumbnailHeight = 104,
}: {
  value: PresetId;
  modified: boolean;
  onSelect: (id: PresetId) => void;
  columns?: 2 | 3 | 4;
  thumbnailHeight?: number;
}) {
  return (
    <>
      <style>{THUMBNAIL_FONT_CSS}</style>
      <div
        role="radiogroup"
        aria-label="Document style"
        className={cn(
          "grid gap-2",
          columns === 2 && "grid-cols-2",
          columns === 3 && "grid-cols-3",
          columns === 4 && "grid-cols-4",
        )}
      >
        {PRESET_IDS.map((id) => {
          const active = id === value;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(id)}
              title={PRESETS[id].bestFor}
              className={cn(
                "group flex min-w-0 flex-col rounded-xl border p-1.5 text-left transition-[border-color,background-color,box-shadow] duration-150",
                active
                  ? "border-primary bg-primary-soft/50 ring-3 ring-primary/12"
                  : "border-border hover:border-border-strong hover:bg-surface-hover",
              )}
            >
              <span
                className="relative grid place-items-center rounded-lg bg-canvas"
                style={{ height: thumbnailHeight + 22 }}
              >
                <PresetThumbnail id={id} height={thumbnailHeight} />
                {active && (
                  <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className="mt-2 flex items-center gap-1.5 px-1">
                <span className="truncate text-[13px] font-semibold text-foreground">
                  {PRESETS[id].name}
                </span>
                {active && modified && (
                  <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                    Edited
                  </span>
                )}
              </span>
              <span className="mb-1 line-clamp-2 px-1 text-xs leading-snug text-muted-foreground">
                {PRESETS[id].tagline}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
