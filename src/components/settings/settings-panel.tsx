"use client";

import { useRef, useState } from "react";

import {
  ChipGroup,
  ColorInput,
  Field,
  FontSelect,
  Hr,
  inputClass,
  NumberInput,
  Segmented,
  Select,
  Slider,
  SubHeading,
  Tabs,
  TextInput,
  Toggle,
} from "@/components/settings/controls";
import {
  LENGTH_UNITS,
  MARGIN_PRESETS,
  PAGE_SIZES,
  PAGE_SIZE_IDS,
  mmTo,
  toMm,
  type LengthUnit,
  type MarginPresetId,
} from "@/lib/config/page-sizes";
import { PRESETS, type PresetId } from "@/lib/config/presets";
import {
  CODE_THEMES,
  type DocumentConfig,
  type PartialDocumentConfig,
} from "@/lib/config/schema";
import { fontsByCategory } from "@/lib/fonts";

/**
 * The customisation panel.
 *
 * Every field in DocumentConfig is reachable from here, across 4 always-open
 * tabs (Page / Type / Theme / Document) rather than an accordion - the layout
 * the Modernist design specifies. Document does the most work: everything that
 * isn't page geometry, typography or colour/style lands there, grouped under
 * small uppercase kickers separated by a 2px rule.
 *
 * The panel is stateless apart from which tab is active (and one small local
 * flag for the margin preset's "Custom" option - see below). Every change is a
 * partial config sent to `onChange`, which merges and revalidates - so the
 * panel cannot put the document into an invalid state.
 */

type Props = {
  config: DocumentConfig;
  onChange: (patch: PartialDocumentConfig) => void;
  presetId: PresetId;
  /** True when the config no longer matches the preset it started from. */
  modified: boolean;
  onResetPreset: () => void;
};

const FONT_GROUPS = [
  { label: "Sans", category: "sans" as const },
  { label: "Serif", category: "serif" as const },
  { label: "Monospace", category: "mono" as const },
].map((group) => ({
  label: group.label,
  fonts: fontsByCategory(group.category).map((font) => ({
    id: font.id,
    name: font.family,
    description: font.description,
  })),
}));

const MONO_GROUP = FONT_GROUPS.filter((group) => group.label === "Monospace");

const TOKEN_HELP =
  "{title} {subtitle} {author} {date} {section} {subsection} {page} {pages} {filename}";

function options<T extends string>(values: readonly T[], labels?: Record<string, string>) {
  return values.map((value) => ({
    value,
    label: labels?.[value] ?? value.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
  }));
}

/**
 * A length in the user's display unit, stored in millimetres.
 *
 * Declared at module scope on purpose. Defined inside SettingsPanel it would be
 * a new component type on every render, so React would unmount and remount it -
 * and the input would lose focus after every keystroke.
 */
function LengthField({
  label,
  value,
  unit,
  onCommit,
  max = 200,
}: {
  label: string;
  value: number;
  unit: LengthUnit;
  onCommit: (millimetres: number) => void;
  max?: number;
}) {
  return (
    <Field label={label} inline>
      <NumberInput
        value={mmTo(value, unit)}
        min={0}
        max={mmTo(max, unit)}
        step={unit === "in" ? 0.05 : unit === "cm" ? 0.1 : 1}
        unit={unit}
        onChange={(next) => onCommit(toMm(next, unit))}
      />
    </Field>
  );
}

/**
 * Comma-separated keywords, committed on blur rather than on every keystroke.
 *
 * The natural implementation - split on comma, trim, drop empties, rejoin,
 * call onChange - is lossy mid-edit: typing "alpha, " triggers that transform
 * immediately, and dropping the empty trailing segment turns it back into
 * "alpha" one keystroke after the user typed the separator, so the comma they
 * just typed is erased before they can start the next word. Committing only on
 * blur (or Enter) means the transform runs once, on a finished value, instead
 * of fighting the user on every character.
 *
 * A top-level function so its draft state survives a parent re-render, same
 * reasoning as LengthField above.
 */
function KeywordsField({
  value,
  onChange,
}: {
  value: readonly string[];
  onChange: (value: string[]) => void;
}) {
  const [draft, setDraft] = useState(value.join(", "));
  const isFocused = useRef(false);

  const commit = () => {
    onChange(
      draft
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .slice(0, 30),
    );
  };

  return (
    <input
      type="text"
      value={draft}
      onFocus={() => {
        isFocused.current = true;
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        isFocused.current = false;
        commit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className={inputClass}
    />
  );
}

type SettingsTab = "page" | "type" | "theme" | "document";

const SETTINGS_TABS: { value: SettingsTab; label: string }[] = [
  { value: "page", label: "Page" },
  { value: "type", label: "Type" },
  { value: "theme", label: "Theme" },
  { value: "document", label: "Document" },
];

const COLOR_FIELD_DEFS = [
  ["pageBackground", "Page"],
  ["text", "Body text"],
  ["heading", "Headings"],
  ["muted", "Secondary text"],
  ["link", "Links"],
  ["accent", "Accent"],
  ["border", "Rules and borders"],
  ["codeBackground", "Code background"],
] as const;

export function SettingsPanel({
  config,
  onChange,
  presetId,
  modified,
  onResetPreset,
}: Props) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("page");
  const unit = config.page.displayUnit;

  // Which named margin preset (if any) the current margins exactly match.
  const matchingMarginPreset = (Object.keys(MARGIN_PRESETS) as MarginPresetId[]).find(
    (id) => {
      const preset = MARGIN_PRESETS[id].margins;
      const current = config.page.margins;
      return (
        preset.top === current.top &&
        preset.right === current.right &&
        preset.bottom === current.bottom &&
        preset.left === current.left
      );
    },
  );

  // Shipping only the 4-way preset segmented control would make arbitrary
  // margins (e.g. 30mm top / 15mm sides) unreachable - a real regression, since
  // pageSchema.margins allows any value. "Custom" is a 5th option, symmetric
  // with how page.size already has its own "Custom" escape hatch: it is
  // selected automatically whenever the stored margins don't match a preset,
  // and can also be forced on explicitly (this local flag) so clicking it
  // reveals the per-side fields even if the current values happen to equal a
  // preset - letting the user start diverging from it.
  const [marginsForceCustom, setMarginsForceCustom] = useState(false);
  const showCustomMargins = marginsForceCustom || !matchingMarginPreset;

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l-2 border-border bg-surface">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3.5 py-2.5">
        <span className="text-[13px] font-extrabold">Customise</span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
          {PRESETS[presetId].name}
          {modified ? " (modified)" : ""}
        </span>
        {modified && (
          <button
            type="button"
            onClick={onResetPreset}
            className="shrink-0 border-none px-2 py-1 text-[11px] text-primary transition-colors hover:bg-primary/10"
          >
            Reset
          </button>
        )}
      </div>

      <Tabs value={activeTab} onChange={setActiveTab} options={SETTINGS_TABS} />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {/* ================================================================ */}
        {/* PAGE                                                             */}
        {/* ================================================================ */}
        {activeTab === "page" && (
          <>
            <Field label="Size" inline>
              <Select
                value={config.page.size}
                options={[
                  ...PAGE_SIZE_IDS.map((id) => ({
                    value: id as string,
                    label: PAGE_SIZES[id].name,
                  })),
                  { value: "custom", label: "Custom" },
                ]}
                onChange={(value) =>
                  onChange({ page: { size: value as DocumentConfig["page"]["size"] } })
                }
              />
            </Field>

            {config.page.size !== "custom" ? (
              <p className="mb-3 text-[11px] text-muted-foreground">
                {PAGE_SIZES[config.page.size].note}
              </p>
            ) : (
              <>
                <LengthField
                  label="Width"
                  value={config.page.customWidth}
                  unit={unit}
                  max={2000}
                  onCommit={(mm) => onChange({ page: { customWidth: mm } })}
                />
                <LengthField
                  label="Height"
                  value={config.page.customHeight}
                  unit={unit}
                  max={2000}
                  onCommit={(mm) => onChange({ page: { customHeight: mm } })}
                />
              </>
            )}

            <Field label="Orientation" inline>
              <Segmented
                label="Orientation"
                value={config.page.orientation}
                options={[
                  { value: "portrait", label: "Portrait" },
                  { value: "landscape", label: "Landscape" },
                ]}
                onChange={(value) => onChange({ page: { orientation: value } })}
              />
            </Field>

            <Field label="Margins">
              <div className="space-y-2">
                <Segmented
                  label="Margin preset"
                  value={showCustomMargins ? "custom" : (matchingMarginPreset ?? "custom")}
                  options={[
                    ...(Object.keys(MARGIN_PRESETS) as MarginPresetId[]).map((id) => ({
                      value: id as MarginPresetId | "custom",
                      label: MARGIN_PRESETS[id].name,
                    })),
                    { value: "custom" as const, label: "Custom" },
                  ]}
                  onChange={(value) => {
                    if (value === "custom") {
                      setMarginsForceCustom(true);
                      return;
                    }
                    setMarginsForceCustom(false);
                    onChange({ page: { margins: MARGIN_PRESETS[value].margins } });
                  }}
                />
                {showCustomMargins && (
                  <div className="grid grid-cols-2 gap-x-4">
                    {(["top", "right", "bottom", "left"] as const).map((side) => (
                      <LengthField
                        key={side}
                        label={side.charAt(0).toUpperCase() + side.slice(1)}
                        value={config.page.margins[side]}
                        unit={unit}
                        onCommit={(mm) =>
                          onChange({ page: { margins: { [side]: mm } } })
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </Field>

            <Field
              label="Print scale"
              hint="Chromium's own scaling. Leave at 100% unless a document must be squeezed."
            >
              <Slider
                value={config.page.scale}
                min={0.5}
                max={2}
                step={0.05}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(value) => onChange({ page: { scale: value } })}
              />
            </Field>

            <Hr />

            <Field label="Units" inline hint="Display only; values are stored in millimetres.">
              <Segmented
                label="Display units"
                value={unit}
                options={LENGTH_UNITS.map((u) => ({ value: u, label: u }))}
                onChange={(value) => onChange({ page: { displayUnit: value as LengthUnit } })}
              />
            </Field>
          </>
        )}

        {/* ================================================================ */}
        {/* TYPE                                                             */}
        {/* ================================================================ */}
        {activeTab === "type" && (
          <>
            <Field label="Body font">
              <FontSelect
                value={config.typography.bodyFont}
                groups={FONT_GROUPS}
                onChange={(value) =>
                  onChange({
                    typography: { bodyFont: value as DocumentConfig["typography"]["bodyFont"] },
                  })
                }
              />
            </Field>

            <Field label="Heading font">
              <FontSelect
                value={config.typography.headingFont}
                groups={FONT_GROUPS}
                extra={[{ value: "inherit", label: "Same as body" }]}
                onChange={(value) =>
                  onChange({
                    typography: {
                      headingFont: value as DocumentConfig["typography"]["headingFont"],
                    },
                  })
                }
              />
            </Field>

            <Field label="Code font">
              <FontSelect
                value={config.typography.monoFont}
                groups={MONO_GROUP}
                onChange={(value) =>
                  onChange({
                    typography: { monoFont: value as DocumentConfig["typography"]["monoFont"] },
                  })
                }
              />
            </Field>

            <Hr />
            <SubHeading>Size and spacing</SubHeading>

            <Field label="Body size" inline>
              <NumberInput
                value={config.typography.baseFontSize}
                min={6}
                max={24}
                step={0.5}
                unit="pt"
                onChange={(value) => onChange({ typography: { baseFontSize: value } })}
              />
            </Field>

            <Field label="Line height">
              <Slider
                value={config.typography.lineHeight}
                min={1}
                max={2.4}
                step={0.05}
                onChange={(value) => onChange({ typography: { lineHeight: value } })}
              />
            </Field>

            <Field label="Paragraph gap" hint="In em of the body size.">
              <Slider
                value={config.typography.paragraphSpacing}
                min={0}
                max={2.5}
                step={0.05}
                onChange={(value) => onChange({ typography: { paragraphSpacing: value } })}
              />
            </Field>

            <Field label="Letter spacing" hint="In em. Negative tightens.">
              <Slider
                value={config.typography.letterSpacing}
                min={-0.05}
                max={0.2}
                step={0.005}
                format={(v) => v.toFixed(3)}
                onChange={(value) => onChange({ typography: { letterSpacing: value } })}
              />
            </Field>

            <Hr />
            <SubHeading>Headings</SubHeading>

            <Field
              label="Heading scale"
              hint="One ratio for all levels. h4 is body size; each level up multiplies by this."
            >
              <Slider
                value={config.typography.headingScale}
                min={1}
                max={1.6}
                step={0.01}
                format={(v) => v.toFixed(2)}
                onChange={(value) => onChange({ typography: { headingScale: value } })}
              />
            </Field>

            <Field label="Heading weight" inline>
              <Select
                value={String(config.typography.headingWeight)}
                options={[400, 500, 600, 700, 800, 900].map((w) => ({
                  value: String(w),
                  label: String(w),
                }))}
                onChange={(value) => onChange({ typography: { headingWeight: Number(value) } })}
              />
            </Field>

            <Hr />
            <SubHeading>Text setting</SubHeading>

            <Field label="Alignment" inline>
              <Segmented
                label="Text alignment"
                value={config.typography.align}
                options={[
                  { value: "left", label: "Left" },
                  { value: "justify", label: "Justify" },
                ]}
                onChange={(value) => onChange({ typography: { align: value } })}
              />
            </Field>

            <Field
              label="Hyphenate"
              inline
              hint={
                config.typography.align === "justify"
                  ? "Strongly recommended: unhyphenated justified text opens rivers of whitespace."
                  : "Only affects justified text."
              }
            >
              <Toggle
                label="Hyphenate"
                checked={config.typography.hyphenate}
                onChange={(checked) => onChange({ typography: { hyphenate: checked } })}
              />
            </Field>

            <Field
              label="Line length"
              hint="Caps the measure. Long lines are tiring; 65-75 characters is the usual target."
            >
              <div className="flex items-center gap-2">
                <Toggle
                  label="Limit line length"
                  checked={config.typography.measure !== null}
                  onChange={(checked) =>
                    onChange({ typography: { measure: checked ? 140 : null } })
                  }
                />
                {config.typography.measure !== null && (
                  <NumberInput
                    value={mmTo(config.typography.measure, unit)}
                    min={40}
                    max={mmTo(400, unit)}
                    step={unit === "in" ? 0.25 : 5}
                    unit={unit}
                    onChange={(value) =>
                      onChange({ typography: { measure: toMm(value, unit) } })
                    }
                  />
                )}
              </div>
            </Field>

            <Hr />
            <SubHeading>Code</SubHeading>

            <Field label="Code size" hint="Relative to the body size.">
              <Slider
                value={config.typography.codeFontScale}
                min={0.5}
                max={1.2}
                step={0.01}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(value) => onChange({ typography: { codeFontScale: value } })}
              />
            </Field>

            <Field
              label="Wrap long lines"
              inline
              hint="Off lets wide code run past the page edge and be cut off."
            >
              <Toggle
                label="Wrap long code lines"
                checked={config.typography.wrapCode}
                onChange={(checked) => onChange({ typography: { wrapCode: checked } })}
              />
            </Field>
          </>
        )}

        {/* ================================================================ */}
        {/* THEME                                                            */}
        {/* ================================================================ */}
        {activeTab === "theme" && (
          <>
            <SubHeading>Colours</SubHeading>
            {COLOR_FIELD_DEFS.map(([key, label]) => (
              <Field key={key} label={label} inline>
                <ColorInput
                  label={label}
                  value={config.theme[key]}
                  onChange={(value) => onChange({ theme: { [key]: value } })}
                />
              </Field>
            ))}

            <Hr />
            <SubHeading>Styling</SubHeading>

            <Field label="Code theme" inline>
              <Select
                value={config.theme.codeTheme}
                options={options(CODE_THEMES)}
                onChange={(value) =>
                  onChange({ theme: { codeTheme: value as DocumentConfig["theme"]["codeTheme"] } })
                }
              />
            </Field>

            <Field
              label="Links"
              inline
              hint="Footnote prints the URL beside the text, so a paper copy stays usable."
            >
              <Select
                value={config.theme.linkStyle}
                options={options(["colour", "underline", "plain", "footnote"] as const)}
                onChange={(value) =>
                  onChange({ theme: { linkStyle: value as DocumentConfig["theme"]["linkStyle"] } })
                }
              />
            </Field>

            <Field label="Heading rules" inline>
              <Select
                value={config.theme.headingRules}
                options={[
                  { value: "none", label: "None" },
                  { value: "h1", label: "Under h1" },
                  { value: "h1-h2", label: "Under h1 and h2" },
                ]}
                onChange={(value) =>
                  onChange({
                    theme: { headingRules: value as DocumentConfig["theme"]["headingRules"] },
                  })
                }
              />
            </Field>

            <Field label="Tables" inline>
              <Select
                value={config.theme.tableStyle}
                options={options(["grid", "zebra", "horizontal", "minimal"] as const)}
                onChange={(value) =>
                  onChange({
                    theme: { tableStyle: value as DocumentConfig["theme"]["tableStyle"] },
                  })
                }
              />
            </Field>

            <Field label="Blockquotes" inline>
              <Select
                value={config.theme.quoteStyle}
                options={options(["bar", "bar-tinted", "indent", "italic"] as const)}
                onChange={(value) =>
                  onChange({
                    theme: { quoteStyle: value as DocumentConfig["theme"]["quoteStyle"] },
                  })
                }
              />
            </Field>
          </>
        )}

        {/* ================================================================ */}
        {/* DOCUMENT                                                         */}
        {/* ================================================================ */}
        {activeTab === "document" && (
          <>
            <SubHeading>Cover page</SubHeading>
            <Field label="Cover page" inline>
              <Toggle
                label="Cover page"
                checked={config.cover.enabled}
                onChange={(checked) => onChange({ cover: { enabled: checked } })}
              />
            </Field>

            {config.cover.enabled && (
              <>
                <Field label="Layout" inline>
                  <Select
                    value={config.cover.layout}
                    options={options(["centred", "left", "banner", "minimal"] as const)}
                    onChange={(value) =>
                      onChange({
                        cover: { layout: value as DocumentConfig["cover"]["layout"] },
                      })
                    }
                  />
                </Field>

                {(
                  [
                    ["title", "Title", "Taken from front matter or the first heading."],
                    ["subtitle", "Subtitle", undefined],
                    ["author", "Author", undefined],
                    ["organisation", "Organisation", undefined],
                    ["date", "Date", "Today's date if left empty."],
                  ] as const
                ).map(([key, label, hint]) => (
                  <Field key={key} label={label} hint={hint}>
                    <TextInput
                      value={config.cover[key] ?? ""}
                      placeholder="from the document"
                      onChange={(value) =>
                        onChange({ cover: { [key]: value === "" ? null : value } })
                      }
                    />
                  </Field>
                ))}

                <Field label="Abstract" hint="Plain text. Blank lines start new paragraphs.">
                  <textarea
                    value={config.cover.abstract}
                    rows={4}
                    onChange={(event) => onChange({ cover: { abstract: event.target.value } })}
                    className={`${inputClass} resize-y`}
                  />
                </Field>
              </>
            )}

            <Hr />
            <SubHeading>Contents</SubHeading>

            <Field label="Contents page" inline>
              <Toggle
                label="Contents page"
                checked={config.toc.enabled}
                onChange={(checked) => onChange({ toc: { enabled: checked } })}
              />
            </Field>

            {config.toc.enabled && (
              <>
                <Field label="Heading" inline>
                  <TextInput
                    value={config.toc.title}
                    onChange={(value) => onChange({ toc: { title: value } })}
                  />
                </Field>

                <Field label="Shallowest level" inline>
                  <Select
                    value={String(config.toc.minDepth)}
                    options={[1, 2, 3, 4, 5, 6].map((d) => ({ value: String(d), label: `h${d}` }))}
                    onChange={(value) => onChange({ toc: { minDepth: Number(value) } })}
                  />
                </Field>

                <Field label="Deepest level" inline>
                  <Select
                    value={String(config.toc.maxDepth)}
                    options={[1, 2, 3, 4, 5, 6].map((d) => ({ value: String(d), label: `h${d}` }))}
                    onChange={(value) => onChange({ toc: { maxDepth: Number(value) } })}
                  />
                </Field>

                <Field label="Page numbers" inline>
                  <Toggle
                    label="Contents page numbers"
                    checked={config.toc.pageNumbers}
                    onChange={(checked) => onChange({ toc: { pageNumbers: checked } })}
                  />
                </Field>

                <Field label="Dot leaders" inline>
                  <Toggle
                    label="Dot leaders"
                    checked={config.toc.dotLeaders}
                    onChange={(checked) => onChange({ toc: { dotLeaders: checked } })}
                  />
                </Field>

                <Field label="Start body on a new page" inline>
                  <Toggle
                    label="Break after contents"
                    checked={config.toc.breakAfter}
                    onChange={(checked) => onChange({ toc: { breakAfter: checked } })}
                  />
                </Field>
              </>
            )}

            <Hr />
            <SubHeading>Running head &amp; foot</SubHeading>
            <p className="mb-2 break-words font-mono text-[10px] leading-relaxed text-muted-foreground">
              {TOKEN_HELP}
            </p>

            {(["header", "footer"] as const).map((area) => {
              const slot = config[area];
              return (
                <div key={area} className="mb-3">
                  <p className="mb-1 text-[11px] font-bold text-foreground">
                    {area === "header" ? "Header" : "Footer"}
                  </p>

                  <Field label="Show" inline>
                    <Toggle
                      label={`Show ${area}`}
                      checked={slot.enabled}
                      onChange={(checked) => onChange({ [area]: { enabled: checked } })}
                    />
                  </Field>

                  {slot.enabled && (
                    <>
                      {(["left", "center", "right"] as const).map((position) => (
                        <Field
                          key={position}
                          label={position.charAt(0).toUpperCase() + position.slice(1)}
                        >
                          <TextInput
                            value={slot[position]}
                            placeholder="empty"
                            onChange={(value) => onChange({ [area]: { [position]: value } })}
                          />
                        </Field>
                      ))}

                      <Field label="Size" inline>
                        <NumberInput
                          value={slot.fontSize}
                          min={5}
                          max={16}
                          step={0.5}
                          unit="pt"
                          onChange={(value) => onChange({ [area]: { fontSize: value } })}
                        />
                      </Field>

                      <Field label="Colour" inline>
                        <ColorInput
                          label={`${area} colour`}
                          value={slot.colour}
                          onChange={(value) => onChange({ [area]: { colour: value } })}
                        />
                      </Field>

                      <Field label="Show on first page" inline>
                        <Toggle
                          label={`Show ${area} on first page`}
                          checked={slot.showOnFirstPage}
                          onChange={(checked) =>
                            onChange({ [area]: { showOnFirstPage: checked } })
                          }
                        />
                      </Field>
                    </>
                  )}
                </div>
              );
            })}

            <Hr />
            <SubHeading>Structure</SubHeading>

            <Field
              label="Number headings"
              inline
              hint="Turn off if your document already numbers its own headings."
            >
              <Toggle
                label="Number headings"
                checked={config.structure.numberHeadings}
                onChange={(checked) => onChange({ structure: { numberHeadings: checked } })}
              />
            </Field>

            {config.structure.numberHeadings && (
              <>
                <Field label="Start at level" inline hint="Use h2 when h1 is the document title.">
                  <Select
                    value={String(config.structure.numberFrom)}
                    options={[1, 2, 3].map((d) => ({ value: String(d), label: `h${d}` }))}
                    onChange={(value) => onChange({ structure: { numberFrom: Number(value) } })}
                  />
                </Field>
                <Field label="Levels deep" inline>
                  <Select
                    value={String(config.structure.numberDepth)}
                    options={[1, 2, 3, 4, 5, 6].map((d) => ({
                      value: String(d),
                      label: String(d),
                    }))}
                    onChange={(value) => onChange({ structure: { numberDepth: Number(value) } })}
                  />
                </Field>
              </>
            )}

            <Field label="New page before" inline>
              <Select
                value={config.structure.pageBreakBefore}
                options={[
                  { value: "none", label: "Never" },
                  { value: "h1", label: "Every h1" },
                  { value: "h2", label: "Every h2" },
                ]}
                onChange={(value) =>
                  onChange({
                    structure: {
                      pageBreakBefore: value as DocumentConfig["structure"]["pageBreakBefore"],
                    },
                  })
                }
              />
            </Field>

            <Field label="Never split" hint="Keeps these whole rather than breaking across pages.">
              <ChipGroup
                label="Never split across pages"
                values={config.structure.avoidBreakInside}
                options={options([
                  "code",
                  "table",
                  "figure",
                  "blockquote",
                  "list",
                  "callout",
                ] as const)}
                onChange={(values) =>
                  onChange({
                    structure: {
                      avoidBreakInside: values as DocumentConfig["structure"]["avoidBreakInside"],
                    },
                  })
                }
              />
            </Field>

            <Field label="Widows / orphans" hint="Minimum lines kept together at a page break.">
              <div className="flex items-center gap-2">
                <NumberInput
                  value={config.structure.widows}
                  min={1}
                  max={5}
                  onChange={(value) => onChange({ structure: { widows: value } })}
                />
                <NumberInput
                  value={config.structure.orphans}
                  min={1}
                  max={5}
                  onChange={(value) => onChange({ structure: { orphans: value } })}
                />
              </div>
            </Field>

            <Field label="First page number" inline>
              <NumberInput
                value={config.structure.startPageNumber}
                min={0}
                max={9999}
                onChange={(value) => onChange({ structure: { startPageNumber: value } })}
              />
            </Field>

            <Field label="Columns" inline>
              <Segmented
                label="Columns"
                value={String(config.structure.columns)}
                options={[
                  { value: "1", label: "One" },
                  { value: "2", label: "Two" },
                ]}
                onChange={(value) => onChange({ structure: { columns: value === "2" ? 2 : 1 } })}
              />
            </Field>

            {config.structure.columns === 2 && (
              <LengthField
                label="Column gap"
                value={config.structure.columnGap}
                unit={unit}
                max={50}
                onCommit={(mm) => onChange({ structure: { columnGap: mm } })}
              />
            )}

            <Field label="Number figures" inline>
              <Toggle
                label="Number figures"
                checked={config.structure.numberFigures}
                onChange={(checked) => onChange({ structure: { numberFigures: checked } })}
              />
            </Field>
            <Field label="Number tables" inline>
              <Toggle
                label="Number tables"
                checked={config.structure.numberTables}
                onChange={(checked) => onChange({ structure: { numberTables: checked } })}
              />
            </Field>

            <Hr />
            <SubHeading>Markdown</SubHeading>

            {(
              [
                ["gfm", "Tables, task lists, strikethrough", undefined],
                ["footnotes", "Footnotes", undefined],
                ["math", "Maths", "$inline$ and $$display$$ via KaTeX."],
                ["mermaid", "Mermaid diagrams", "Not yet rendered; blocks show as code."],
                ["admonitions", "Callouts", "> [!NOTE] and ::: tip blocks."],
                ["emoji", "Emoji shortcodes", undefined],
                ["smartTypography", "Curly quotes and dashes", undefined],
                [
                  "softBreaks",
                  "Treat every newline as a line break",
                  "Off is right for hard-wrapped Markdown; on preserves deliberate breaks.",
                ],
              ] as const
            ).map(([key, label, hint]) => (
              <Field key={key} label={label} hint={hint} inline>
                <Toggle
                  label={label}
                  checked={config.markdown[key]}
                  onChange={(checked) => onChange({ markdown: { [key]: checked } })}
                />
              </Field>
            ))}

            <Field
              label="Raw HTML"
              inline
              hint="Sanitise strips scripts and event handlers. Allow is only safe for your own documents."
            >
              <Select
                value={config.markdown.rawHtml}
                options={[
                  { value: "sanitise", label: "Sanitise" },
                  { value: "strip", label: "Strip" },
                  { value: "allow", label: "Allow" },
                ]}
                onChange={(value) =>
                  onChange({
                    markdown: { rawHtml: value as DocumentConfig["markdown"]["rawHtml"] },
                  })
                }
              />
            </Field>

            <Field label="Front matter" inline>
              <Select
                value={config.markdown.frontMatter}
                options={[
                  { value: "parse", label: "Use as metadata" },
                  { value: "ignore", label: "Discard" },
                  { value: "render", label: "Print it" },
                ]}
                onChange={(value) =>
                  onChange({
                    markdown: {
                      frontMatter: value as DocumentConfig["markdown"]["frontMatter"],
                    },
                  })
                }
              />
            </Field>

            <Hr />
            <SubHeading>Watermark</SubHeading>

            <Field label="Watermark" inline>
              <Toggle
                label="Watermark"
                checked={config.watermark.enabled}
                onChange={(checked) => onChange({ watermark: { enabled: checked } })}
              />
            </Field>

            {config.watermark.enabled && (
              <>
                <Field label="Text" inline>
                  <TextInput
                    value={config.watermark.text}
                    onChange={(value) => onChange({ watermark: { text: value } })}
                  />
                </Field>
                <Field label="Colour" inline>
                  <ColorInput
                    label="Watermark colour"
                    value={config.watermark.colour}
                    onChange={(value) => onChange({ watermark: { colour: value } })}
                  />
                </Field>
                <Field label="Opacity">
                  <Slider
                    value={config.watermark.opacity}
                    min={0}
                    max={0.5}
                    step={0.01}
                    format={(v) => `${Math.round(v * 100)}%`}
                    onChange={(value) => onChange({ watermark: { opacity: value } })}
                  />
                </Field>
                <Field label="Rotation">
                  <Slider
                    value={config.watermark.rotation}
                    min={-90}
                    max={90}
                    step={5}
                    format={(v) => `${v}°`}
                    onChange={(value) => onChange({ watermark: { rotation: value } })}
                  />
                </Field>
                <Field label="Size" inline>
                  <NumberInput
                    value={config.watermark.fontSize}
                    min={8}
                    max={300}
                    step={4}
                    unit="pt"
                    onChange={(value) => onChange({ watermark: { fontSize: value } })}
                  />
                </Field>
              </>
            )}

            <Hr />
            <SubHeading>Output</SubHeading>

            <Field
              label="Filename"
              hint="Left empty: front matter title, then the first heading, then the opened filename."
            >
              <TextInput
                value={config.output.fileName ?? ""}
                placeholder="auto"
                onChange={(value) => onChange({ output: { fileName: value === "" ? null : value } })}
              />
            </Field>

            <Field label="PDF bookmarks" inline hint="An outline built from the headings.">
              <Toggle
                label="PDF bookmarks"
                checked={config.output.outline}
                onChange={(checked) => onChange({ output: { outline: checked } })}
              />
            </Field>

            <Field label="Tagged PDF" inline hint="Structure information for screen readers.">
              <Toggle
                label="Tagged PDF"
                checked={config.output.tagged}
                onChange={(checked) => onChange({ output: { tagged: checked } })}
              />
            </Field>

            {(
              [
                ["title", "Title"],
                ["author", "Author"],
                ["subject", "Subject"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <TextInput
                  value={config.output.metadata[key] ?? ""}
                  placeholder="from the document"
                  onChange={(value) =>
                    onChange({ output: { metadata: { [key]: value === "" ? null : value } } })
                  }
                />
              </Field>
            ))}

            <Field label="Keywords" hint="Comma separated.">
              <KeywordsField
                value={config.output.metadata.keywords}
                onChange={(keywords) => onChange({ output: { metadata: { keywords } } })}
              />
            </Field>
          </>
        )}
      </div>
    </aside>
  );
}
