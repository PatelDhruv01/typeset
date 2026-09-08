"use client";

import { useEffect, useState } from "react";

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
