/**
 * Nav icons, copied verbatim from the source design (Typeset.dc.html).
 *
 * The design system's own guide suggests Lucide, but the prototype never
 * actually used it - every icon there is hand-drawn inline SVG. Copying that
 * exact path data is both simpler and more pixel-accurate than sourcing
 * equivalent-but-not-identical icons from a library, and it adds no
 * dependency.
 */

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="shrink-0">
      <path
        d="M6 4H22L28 10V28H6Z"
        fill="var(--background)"
        stroke="var(--foreground)"
        strokeWidth="2"
      />
      <path d="M22 4L28 10H22Z" fill="var(--primary)" />
      <rect x="10" y="19" width="13" height="3" fill="var(--primary)" />
      <rect x="10" y="24" width="9" height="2.2" fill="var(--foreground)" opacity="0.35" />
    </svg>
  );
}

const strokeIconProps = {
  viewBox: "0 0 24 24",
  width: 13,
  height: 13,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** An open folder - the "Open file" button. */
export function FolderIcon() {
  return (
    <svg {...strokeIconProps}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}

/** Two chevrons pointing outward - collapses or restores the editor panel. */
export function EditorToggleIcon() {
  return (
    <svg {...strokeIconProps}>
      <path d="m8 6-6 6 6 6M16 6l6 6-6 6" />
    </svg>
  );
}

/** Three sliders - the Customise button. */
export function SettingsIcon() {
  return (
    <svg {...strokeIconProps}>
      <path d="M4 6h10M17 6h3M4 12h3M10 12h10M4 18h13M20 18h0" />
    </svg>
  );
}
