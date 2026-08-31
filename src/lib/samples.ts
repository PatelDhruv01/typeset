/**
 * Built-in sample documents.
 *
 * Kept as module constants rather than files read at runtime: on Vercel the
 * repository is not on disk beside the running function, so anything the app
 * needs at request time has to be bundled.
 */

export type Sample = {
  id: string;
  name: string;
  description: string;
  source: string;
};

const KITCHEN_SINK = `---
title: Typeset Feature Tour
author: Typeset
subtitle: Every supported construct, on one page
---

# Typeset Feature Tour

A single document that exercises everything the renderer supports, so a change
to the stylesheet has somewhere obvious to show itself.

## Text and typography

Ordinary paragraphs reflow, so a source file that is hard-wrapped at eighty
columns still sets as continuous prose rather than as a stack of short lines.

Smart typography turns "straight quotes" into curly ones, -- into an em dash,
and three dots into an ellipsis... automatically.

You can use **bold**, *italic*, ***both***, ~~strikethrough~~, \`inline code\`,
and [links to elsewhere](https://example.com).

## Lists

1. Ordered items
2. Second item
   - Nested unordered
   - Another nested
3. Third item

- [x] A completed task
- [ ] An outstanding task

## Callouts

> [!NOTE]
> GitHub alert syntax works. So does the container form below.

::: warning Check this before running
Directive callouts accept a custom title after the type.
:::

> An ordinary blockquote is left alone, and still looks like a quotation
> rather than a callout box.

## Tables

| Setting | Default | Notes |
|---|---|---|
| Page size | A4 | Letter for North America |
| Body size | 11pt | Points, not pixels |
| Line height | 1.6 | Unitless multiplier |
| Margins | 25/20mm | Top-bottom / left-right |

## Code

Inline \`const x = 1\` and a fenced block with highlighting:

\`\`\`typescript
export function fibonacci(n: number): number {
  if (n < 2) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Long lines wrap rather than overflowing the page, which is the single most
// common way a Markdown-to-PDF converter ruins a technical document.
const veryLongLine = someFunction(argumentOne, argumentTwo, argumentThree, argumentFour);
\`\`\`

\`\`\`python
def quicksort(items):
    if len(items) <= 1:
        return items
    pivot = items[len(items) // 2]
    return (
        quicksort([x for x in items if x < pivot])
        + [x for x in items if x == pivot]
        + quicksort([x for x in items if x > pivot])
    )
\`\`\`

## Mathematics

Inline maths such as $E = mc^2$ sits in the line. Display maths gets its own
block:

$$
\\int_{0}^{\\infty} e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}
$$

And a matrix:

$$
A = \\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}
$$

## Footnotes

Claims should be attributable.[^source] Footnotes collect at the end of the
document.

[^source]: The footnote text, set smaller and separated by a rule.

## Page breaks

Insert \`<!-- pagebreak -->\` anywhere to force the next content onto a new page.

<!-- pagebreak -->

## After the break

This heading starts a new page because of the comment above it.

### Deeper heading

Heading levels are sized from a modular scale, so the hierarchy stays
proportional whatever base size you pick.

#### Fourth level

##### Fifth level

###### Sixth level
`;

const REPORT = `---
title: Groundwater Extraction in Peri-Urban Districts
subtitle: Findings and recommendations
author: Policy Research Unit
date: March 2026
---

# Executive summary

Groundwater extraction in the surveyed districts exceeds natural recharge by an
estimated 34 percent. Without intervention, three of the eight blocks studied
will reach critical depletion within a decade.

This report sets out the measurement methodology, presents district-level
findings, and makes four recommendations.

# Methodology

## Sampling frame

Measurements were taken at 412 observation wells across eight administrative
blocks, sampled quarterly over three years.

> [!IMPORTANT]
> Observation wells are not evenly distributed. Blocks D and F are
> under-sampled relative to their area, and their figures carry wider
> confidence intervals.

## Instrumentation

| Instrument | Count | Precision | Calibration |
|---|---|---|---|
| Automatic loggers | 180 | 1 cm | Annual |
| Manual dip meters | 232 | 5 cm | Biannual |

# Findings

## Extraction against recharge

Net depletion was observed in six of eight blocks. The two exceptions both
border a perennial river.

## District variation

Variation between districts is larger than variation within them, which
suggests that policy set at district level is the right instrument.

# Recommendations

1. Meter all agricultural connections above 5 HP within eighteen months.
2. Move the subsidy from electricity units to metered water volume.
3. Publish block-level water budgets quarterly.
4. Fund recharge structures in the three critical blocks first.
`;

export const SAMPLES: Sample[] = [
  {
    id: "tour",
    name: "Feature tour",
    description: "Every construct the renderer supports, on one page.",
    source: KITCHEN_SINK,
  },
  {
    id: "report",
    name: "Policy report",
    description: "Front matter, sections, tables and callouts.",
    source: REPORT,
  },
];

export const DEFAULT_SAMPLE = SAMPLES[0] as Sample;
