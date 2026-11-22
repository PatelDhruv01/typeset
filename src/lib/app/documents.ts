import {
  configFromPreset,
  DEFAULT_PRESET_ID,
  isPresetId,
  type PresetId,
} from "@/lib/config/presets";
import { documentConfigSchema, type DocumentConfig } from "@/lib/config/schema";

/**
 * Documents, kept in the browser.
 *
 * Nothing leaves the device: the whole library lives in localStorage, one key
 * per document plus a small index for the list. That is plenty - a long
 * chatbot answer is a few kilobytes - and it means a refresh, a crash or a
 * closed tab never costs anyone their work.
 *
 * Every read is defensive. Storage can be full, disabled (private mode in some
 * browsers), or hold data written by an older version of the app, and none of
 * those may break the editor: a document that cannot be read is skipped, and a
 * stored config that no longer validates falls back to its preset.
 */

export type SavedDocument = {
  id: string;
  source: string;
  /** Name of the file the text came from, if it was opened from disk. */
  sourceName?: string;
  presetId: PresetId;
  config: DocumentConfig;
  createdAt: number;
  updatedAt: number;
};

export type DocumentSummary = {
  id: string;
  title: string;
  excerpt: string;
  words: number;
  createdAt: number;
  updatedAt: number;
};

const PREFIX = "typeset:v1";
const INDEX_KEY = `${PREFIX}:index`;
const CURRENT_KEY = `${PREFIX}:current`;
const documentKey = (id: string) => `${PREFIX}:doc:${id}`;

/** Oldest documents are dropped beyond this, and when storage fills up. */
export const MAX_DOCUMENTS = 200;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readJson(key: string): unknown {
  try {
    const raw = storage()?.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function newDocumentId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Titles
// ---------------------------------------------------------------------------

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

function plainText(markdown: string): string {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]+/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, length: number): string {
  return text.length <= length ? text : `${text.slice(0, length - 1).trimEnd()}…`;
}

/**
 * A short human title for the document list: front matter `title`, else the
 * first heading, else the first line of text. Cheap on purpose - it runs on
 * every autosave - so it reads the source with patterns rather than rendering.
 */
export function deriveTitle(source: string): string {
  const frontMatter = FRONT_MATTER.exec(source);
  if (frontMatter?.[1]) {
    const title = /^title:\s*["']?(.+?)["']?\s*$/m.exec(frontMatter[1])?.[1];
    if (title) return truncate(plainText(title), 80);
  }

  const body = source.replace(FRONT_MATTER, "");
  const heading = /^#{1,6}\s+(.+?)\s*#*\s*$/m.exec(body)?.[1];
  if (heading && plainText(heading)) return truncate(plainText(heading), 80);

  for (const line of body.split(/\r?\n/)) {
    const text = plainText(line.replace(/^\s*(?:[-*+>]|\d+\.)\s+/, ""));
    if (text && !/^(?:```|~~~|\|)/.test(line.trim())) return truncate(text, 80);
  }

  return "Untitled";
}

function excerptOf(source: string, title: string): string {
  const text = plainText(
    source
      .replace(FRONT_MATTER, "")
      .replace(/^```[\s\S]*?^```/gm, " ")
      .replace(/^#{1,6}\s+/gm, ""),
  );
  const rest = text.startsWith(title.replace(/…$/, "")) ? text.slice(title.length) : text;
  return truncate(rest.trim(), 140);
}

function countWords(source: string): number {
  return source.split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

function isSummary(value: unknown): value is DocumentSummary {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.updatedAt === "number"
  );
}

function readIndex(): DocumentSummary[] {
  const raw = readJson(INDEX_KEY);
  if (!Array.isArray(raw)) return [];
  // Older or hand-edited entries may lack the optional fields; fill them in.
  return raw.filter(isSummary).map((summary) => ({
    id: summary.id,
    title: summary.title,
    updatedAt: summary.updatedAt,
    excerpt: typeof summary.excerpt === "string" ? summary.excerpt : "",
    words: typeof summary.words === "number" ? summary.words : 0,
    createdAt: typeof summary.createdAt === "number" ? summary.createdAt : summary.updatedAt,
  }));
}

function writeIndex(index: DocumentSummary[]): void {
  storage()?.setItem(INDEX_KEY, JSON.stringify(index));
}

/** Most recently edited first. */
export function listDocuments(): DocumentSummary[] {
  return readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export function loadDocument(id: string): SavedDocument | null {
  const raw = readJson(documentKey(id));
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.source !== "string") return null;

  const presetId =
    typeof record.presetId === "string" && isPresetId(record.presetId)
      ? record.presetId
      : DEFAULT_PRESET_ID;

  const parsed = documentConfigSchema.safeParse(record.config);
  const now = Date.now();

  return {
    id,
    source: record.source,
    sourceName: typeof record.sourceName === "string" ? record.sourceName : undefined,
    presetId,
    config: parsed.success ? parsed.data : configFromPreset(presetId),
    createdAt: typeof record.createdAt === "number" ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : now,
  };
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

/**
 * Writes the document and its index entry. When storage is full, the oldest
 * other documents are dropped one at a time until it fits; returns false only
 * if even that fails, or storage is unavailable altogether.
 */
export function saveDocument(document: SavedDocument): boolean {
  const store = storage();
  if (!store) return false;

  const title = deriveTitle(document.source);
  const summary: DocumentSummary = {
    id: document.id,
    title,
    excerpt: excerptOf(document.source, title),
    words: countWords(document.source),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };

  const payload = JSON.stringify(document);

  for (let attempt = 0; attempt < MAX_DOCUMENTS; attempt += 1) {
    try {
      store.setItem(documentKey(document.id), payload);
      const index = readIndex().filter((entry) => entry.id !== document.id);
      index.push(summary);
      index.sort((a, b) => b.updatedAt - a.updatedAt);
      for (const dropped of index.splice(MAX_DOCUMENTS)) {
        store.removeItem(documentKey(dropped.id));
      }
      writeIndex(index);
      return true;
    } catch (error) {
      if (!isQuotaError(error)) return false;
      const oldest = listDocuments()
        .filter((entry) => entry.id !== document.id)
        .at(-1);
      if (!oldest) return false;
      deleteDocument(oldest.id);
    }
  }

  return false;
}

export function deleteDocument(id: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(documentKey(id));
    writeIndex(readIndex().filter((entry) => entry.id !== id));
    if (store.getItem(CURRENT_KEY) === id) store.removeItem(CURRENT_KEY);
  } catch {
    // Nothing useful to do; the entry simply stays.
  }
}

export function getCurrentDocumentId(): string | null {
  try {
    return storage()?.getItem(CURRENT_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setCurrentDocumentId(id: string): void {
  try {
    storage()?.setItem(CURRENT_KEY, id);
  } catch {
    // Storage unavailable: the app still works, it just won't remember.
  }
}
