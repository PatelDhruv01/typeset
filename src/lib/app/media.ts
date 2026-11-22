"use client";

import { useSyncExternalStore } from "react";

/**
 * Viewport and platform queries.
 *
 * Both use `useSyncExternalStore` with a server snapshot, so the first client
 * render matches the server's HTML and the real value arrives one render
 * later - no hydration mismatch, no reading `window` during render.
 */

export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/**
 * phone   - one pane at a time, bottom tab bar, settings as a bottom sheet.
 * tablet  - one pane at a time, switched from the header; settings as a side sheet.
 * desktop - editor and preview side by side; settings docked once there is room.
 */
export type Layout = "phone" | "tablet" | "desktop";

export function useLayout(): Layout {
  const desktop = useMediaQuery("(min-width: 1024px)", true);
  const tablet = useMediaQuery("(min-width: 640px)", true);
  if (desktop) return "desktop";
  return tablet ? "tablet" : "phone";
}

/** Wide enough to dock the settings panel beside editor and preview. */
export function useWideDesktop(): boolean {
  return useMediaQuery("(min-width: 1280px)", true);
}

function isApplePlatform(): boolean {
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
      ?.platform ?? navigator.platform;
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** "⌘" on Apple platforms, "Ctrl" everywhere else - for shortcut hints. */
export function useModKey(): string {
  return useSyncExternalStore(
    () => () => {},
    () => (isApplePlatform() ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}

/** True for the platform's shortcut modifier: ⌘ on Apple, Ctrl elsewhere. */
export function hasModKey(event: KeyboardEvent | React.KeyboardEvent): boolean {
  return isApplePlatform() ? event.metaKey : event.ctrlKey;
}
