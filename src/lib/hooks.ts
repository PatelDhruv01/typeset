"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/**
 * A value that settles after the user stops changing it.
 *
 * Pagination costs seconds on a long document, so the preview cannot chase every
 * keystroke. Deliberately not `useDeferredValue`: that yields to render priority
 * but still processes every change, whereas the point here is to skip the
 * intermediate values entirely.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}

export type Theme = "light" | "dark";

const THEME_KEY = "typeset:theme";

/**
 * Light/dark for the application chrome.
 *
 * This never touches the document being edited: a PDF must not change because
 * someone dimmed their screen. Document colours live in the theme preset.
 *
 * The `dark` class on <html> is the single source of truth, set before first
 * paint by the inline script in layout.tsx. Reading it through
 * useSyncExternalStore rather than mirroring it into state avoids both the
 * hydration mismatch and the set-state-in-an-effect that a useState version
 * needs.
 */

const themeListeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  themeListeners.add(listener);

  // Another tab changing the preference should update this one.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_KEY) return;
    applyTheme(event.newValue === "dark" ? "dark" : "light");
  };
  window.addEventListener("storage", onStorage);

  return () => {
    themeListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** The server cannot know the preference; the bootstrap script corrects it. */
function getServerSnapshot(): Theme {
  return "light";
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  for (const listener of themeListeners) listener();
}

export function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next: Theme =
      document.documentElement.classList.contains("dark") ? "light" : "dark";

    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private browsing, or storage disabled. The toggle still works for this
      // session; it just will not be remembered.
    }

    applyTheme(next);
  }, []);

  return [theme, toggle];
}

/**
 * Keeps a ref in step with a prop without writing to it during render.
 *
 * Used for callbacks that long-lived effects need to reach: putting the
 * callback itself in the dependency array would tear down and rebuild the
 * editor (losing cursor, selection and undo history) or restart pagination
 * every time the parent re-renders.
 */
export function useLatestRef<T>(value: T): { readonly current: T } {
  const [ref] = useState(() => ({ current: value }));

  useEffect(() => {
    ref.current = value;
  }, [ref, value]);

  return ref;
}
