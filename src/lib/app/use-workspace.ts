"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import {
  deleteDocument,
  getCurrentDocumentId,
  listDocuments,
  loadDocument,
  newDocumentId,
  saveDocument,
  setCurrentDocumentId,
  type DocumentSummary,
  type SavedDocument,
} from "@/lib/app/documents";
import { mergeConfig } from "@/lib/config/merge";
import { configFromPreset, DEFAULT_PRESET_ID, type PresetId } from "@/lib/config/presets";
import {
  documentConfigSchema,
  type DocumentConfig,
  type PartialDocumentConfig,
} from "@/lib/config/schema";

/**
 * The open document, the library behind it, and autosave.
 *
 * Saved state is read from localStorage in `useState` initialisers rather than
 * in an effect: the first client render happens while hydrating, when the page
 * renders a skeleton anyway (see `useHydrated`), so reading storage there costs
 * nothing and avoids a second render that would flash an empty editor.
 */

const AUTOSAVE_MS = 600;

export type SaveState = "saved" | "saving" | "error";

type OpenDocument = {
  id: string;
  source: string;
  sourceName?: string;
  presetId: PresetId;
  config: DocumentConfig;
  createdAt: number;
};

/** False while hydrating (and on the server), true on the client after. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function serialise(document: OpenDocument): string {
  return JSON.stringify([
    document.source,
    document.sourceName ?? null,
    document.presetId,
    document.config,
  ]);
}

function fromSaved(saved: SavedDocument): OpenDocument {
  return {
    id: saved.id,
    source: saved.source,
    sourceName: saved.sourceName,
    presetId: saved.presetId,
    config: saved.config,
    createdAt: saved.createdAt,
  };
}

function blankDocument(style?: { presetId: PresetId; config: DocumentConfig }): OpenDocument {
  const presetId = style?.presetId ?? DEFAULT_PRESET_ID;
  return {
    id: newDocumentId(),
    source: "",
    presetId,
    config: style?.config ?? configFromPreset(presetId),
    createdAt: Date.now(),
  };
}

function initialDocument(): OpenDocument {
  if (typeof window === "undefined") {
    return {
      id: "server",
      source: "",
      presetId: DEFAULT_PRESET_ID,
      config: configFromPreset(DEFAULT_PRESET_ID),
      createdAt: 0,
    };
  }

  const currentId = getCurrentDocumentId();
  const saved =
    (currentId ? loadDocument(currentId) : null) ??
    listDocuments()
      .map((summary) => loadDocument(summary.id))
      .find((document) => document !== null) ??
    null;

  return saved ? fromSaved(saved) : blankDocument();
}

export function useWorkspace() {
  const hydrated = useHydrated();
  const [initial] = useState<{ document: OpenDocument; serialised: string }>(() => {
    const document = initialDocument();
    return { document, serialised: serialise(document) };
  });
  const [document, setDocument] = useState<OpenDocument>(initial.document);
  const [documents, setDocuments] = useState<DocumentSummary[]>(() =>
    typeof window === "undefined" ? [] : listDocuments(),
  );
  const [saveState, setSaveState] = useState<SaveState>("saved");

  // What was last written for the open document, so opening the app - or
  // switching documents - is not itself counted as an edit.
  const lastSaved = useRef<string>(initial.serialised);

  const documentRef = useRef(document);
  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  /** Writes the open document now, if it has unsaved changes. */
  const persist = useCallback((): boolean => {
    const current = documentRef.current;
    const serialised = serialise(current);
    if (serialised === lastSaved.current) return true;

    // An empty document is not worth a place in the library. If it had one,
    // clearing it removes it; typing again brings it back under the same id.
    if (current.source.trim() === "") {
      deleteDocument(current.id);
      lastSaved.current = serialised;
      setDocuments(listDocuments());
      return true;
    }

    const ok = saveDocument({ ...current, updatedAt: Date.now() });
    if (ok) {
      lastSaved.current = serialised;
      setCurrentDocumentId(current.id);
    }
    setDocuments(listDocuments());
    setSaveState(ok ? "saved" : "error");
    return ok;
  }, []);

  // Autosave, debounced so typing writes once per pause rather than per key.
  useEffect(() => {
    if (!hydrated) return;
    if (serialise(document) === lastSaved.current) return;
    const timer = window.setTimeout(persist, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [document, hydrated, persist]);

  // Leaving the page must not lose the last half-second of typing.
  useEffect(() => {
    const flush = () => {
      persist();
    };
    const onVisibility = () => {
      if (window.document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    window.document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [persist]);

  const edit = useCallback((change: (current: OpenDocument) => OpenDocument) => {
    setDocument((current) => change(current));
    setSaveState("saving");
  }, []);

  const setSource = useCallback(
    (source: string) => edit((current) => ({ ...current, source })),
    [edit],
  );

  /**
   * Every settings change goes through the schema. Merging a partial and
   * re-parsing means the config in state is always valid, so nothing
   * downstream has to defend against a half-typed colour; an unparseable
   * patch is dropped and the last good value stands.
   */
  const updateConfig = useCallback(
    (patch: PartialDocumentConfig) =>
      edit((current) => {
        try {
          return {
            ...current,
            config: documentConfigSchema.parse(mergeConfig(current.config, patch)),
          };
        } catch {
          return current;
        }
      }),
    [edit],
  );

  const applyPreset = useCallback(
    (presetId: PresetId) =>
      edit((current) => ({ ...current, presetId, config: configFromPreset(presetId) })),
    [edit],
  );

  /**
   * Switches to a fresh document in the current style, optionally with text.
   * Returns its id, so the caller can offer to undo.
   */
  const createDocument = useCallback(
    (initial?: { source?: string; sourceName?: string }): string => {
      persist();
      const current = documentRef.current;
      const next: OpenDocument = {
        ...blankDocument({ presetId: current.presetId, config: current.config }),
        source: initial?.source ?? "",
        sourceName: initial?.sourceName,
      };
      // Never saved: a non-empty starting text is written by the next autosave.
      lastSaved.current = serialise({ ...next, source: "" });
      documentRef.current = next;
      setDocument(next);
      setCurrentDocumentId(next.id);
      setSaveState("saved");
      return next.id;
    },
    [persist],
  );

  const openDocument = useCallback(
    (id: string): boolean => {
      if (id === documentRef.current.id) return true;
      persist();
      const saved = loadDocument(id);
      if (!saved) {
        setDocuments(listDocuments());
        return false;
      }
      const next = fromSaved(saved);
      lastSaved.current = serialise(next);
      documentRef.current = next;
      setDocument(next);
      setCurrentDocumentId(id);
      setSaveState("saved");
      return true;
    },
    [persist],
  );

  /** Deletes a document; returns it so the caller can offer Undo. */
  const removeDocument = useCallback(
    (id: string): SavedDocument | null => {
      if (id === documentRef.current.id) persist();
      const removed = loadDocument(id);
      deleteDocument(id);
      const remaining = listDocuments();
      setDocuments(remaining);

      if (id === documentRef.current.id) {
        const next = remaining[0] ? loadDocument(remaining[0].id) : null;
        const open = next ? fromSaved(next) : blankDocument(documentRef.current);
        lastSaved.current = serialise(next ? open : { ...open, source: "" });
        documentRef.current = open;
        setDocument(open);
        setCurrentDocumentId(open.id);
      }
      return removed;
    },
    [persist],
  );

  const restoreDocument = useCallback((saved: SavedDocument) => {
    saveDocument(saved);
    setDocuments(listDocuments());
  }, []);

  const presetConfig = useMemo(() => configFromPreset(document.presetId), [document.presetId]);
  const modified = useMemo(
    () => JSON.stringify(document.config) !== JSON.stringify(presetConfig),
    [document.config, presetConfig],
  );

  return {
    hydrated,
    document,
    documents,
    saveState,
    modified,
    setSource,
    updateConfig,
    applyPreset,
    resetPreset: () => applyPreset(document.presetId),
    createDocument,
    openDocument,
    removeDocument,
    restoreDocument,
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;
