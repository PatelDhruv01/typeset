"use client";

import { useSyncExternalStore } from "react";

/**
 * Light, dark, or whatever the operating system says.
 *
 * The resolved theme lives on `<html data-theme>`, where globals.css reads it.
 * An inline script in layout.tsx sets it before first paint; this store only
 * ever changes it in response to the user or the OS. It deliberately never
 * writes it on mount: while hydrating, React renders with the server snapshot
 * ("system", light), and writing that would flash a dark-mode user to light.
 */

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

type ThemeState = { preference: ThemePreference; resolved: ResolvedTheme };

const STORAGE_KEY = "typeset:theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Inlined into <head>; keep it dependency-free and tiny. */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${STORAGE_KEY}");var d=p==="dark"||(p!=="light"&&window.matchMedia("${DARK_QUERY}").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;

function readPreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function compute(): ThemeState {
  const preference = readPreference();
  const resolved =
    preference === "system"
      ? window.matchMedia(DARK_QUERY).matches
        ? "dark"
        : "light"
      : preference;
  return { preference, resolved };
}

const SERVER_STATE: ThemeState = { preference: "system", resolved: "light" };
const listeners = new Set<() => void>();
let current: ThemeState | null = null;
let detachSystemListener: (() => void) | null = null;

function snapshot(): ThemeState {
  current ??= compute();
  return current;
}

function refresh() {
  const next = compute();
  if (current && next.preference === current.preference && next.resolved === current.resolved) {
    return;
  }
  current = next;
  document.documentElement.dataset.theme = next.resolved;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (!detachSystemListener) {
    const media = window.matchMedia(DARK_QUERY);
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) refresh();
    };
    media.addEventListener("change", refresh);
    // Another tab changed the theme: follow it.
    window.addEventListener("storage", onStorage);
    detachSystemListener = () => {
      media.removeEventListener("change", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      detachSystemListener?.();
      detachSystemListener = null;
    }
  };
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Private mode: the choice lasts for this visit only.
    current = { preference, resolved: preference === "dark" ? "dark" : "light" };
  }
  refresh();
}

export function useTheme(): ThemeState & {
  setPreference: (preference: ThemePreference) => void;
} {
  const state = useSyncExternalStore(subscribe, snapshot, () => SERVER_STATE);
  return { ...state, setPreference: setThemePreference };
}
