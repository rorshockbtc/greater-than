/**
 * Eject KB — export utility.
 *
 * Serialises the entire local knowledge base into a single JSON blob:
 *   - All vector chunks from IndexedDB (text + embedding + metadata)
 *   - Local Harness text for every persona (from localStorage)
 *   - The active local-index.md content from the meta store, if present
 *   - A schema version header for future migration detection
 *
 * Progress is reported via the optional `onProgress` callback so the
 * UI can show a progress bar for large exports.
 */

import { openDB } from "idb";
import type { KbChunk } from "@/llm/types";

export const EXPORT_SCHEMA_VERSION = "greater-export-v1";

/** 50 MB soft limit — exceeding triggers the per-persona fallback. */
export const EXPORT_SIZE_LIMIT_BYTES = 50 * 1024 * 1024;

export interface ExportedChunk extends KbChunk {
  /** Dense embedding vector stored alongside the chunk text. */
  vector: number[];
}

export interface KbExport {
  schema_version: typeof EXPORT_SCHEMA_VERSION;
  exported_at: string;
  /**
   * Which persona slugs are included. `"__all__"` means every chunk
   * regardless of persona; otherwise it is a single slug (per-persona
   * export chosen by the user when the full export would be too large).
   */
  persona_scope: "__all__" | string;
  chunks: ExportedChunk[];
  /**
   * Harness texts keyed by persona slug (only personas that have a
   * non-empty harness are included). Format: `{ [slug]: text }`.
   */
  harnesses: Record<string, string>;
  /**
   * The active local-index.md content produced by the NOSTR wiki-
   * compiler, if it has ever run. `null` when the compiler hasn't run
   * or if the key is absent from the meta store. Stored as a plain
   * string so the importer can restore it directly.
   */
  local_index_md: string | null;
}

export interface ExportProgress {
  done: number;
  total: number;
  stage: "reading" | "serialising";
}

const DB_NAME = "greater-vector-store";
const DB_VERSION = 3;

/** Key used to persist the wiki-compiler output in the meta store. */
const LOCAL_INDEX_MD_KEY = "greater:local-index-md";

/**
 * Collect all stored chunks + their embeddings from IndexedDB.
 * Filtered to `personaSlug` when provided; collects all when omitted.
 */
async function collectChunks(
  personaSlug?: string,
  onProgress?: (p: ExportProgress) => void,
): Promise<ExportedChunk[]> {
  const db = await openDB(DB_NAME, DB_VERSION);
  const [docs, embs] = await Promise.all([
    db.getAll("documents") as Promise<KbChunk[]>,
    db.getAll("embeddings") as Promise<{ document_id: string; vector: number[] }[]>,
  ]);

  const vectorMap = new Map(embs.map((e) => [e.document_id, e.vector]));

  const filtered = personaSlug
    ? docs.filter((d) => {
        const slug = (d as KbChunk & { persona_slug?: string }).persona_slug;
        return slug === personaSlug || slug === "__global__" || slug === undefined;
      })
    : docs;

  const total = filtered.length;
  const result: ExportedChunk[] = [];

  for (let i = 0; i < filtered.length; i++) {
    const doc = filtered[i];
    const vector = vectorMap.get(doc.id);
    if (!vector) continue;
    result.push({ ...doc, vector });
    if (onProgress && (i % 100 === 0 || i === total - 1)) {
      onProgress({ done: i + 1, total, stage: "reading" });
    }
  }

  return result;
}

/**
 * Read the active local-index.md from the meta object store.
 * Returns null when the wiki-compiler has never run (key absent).
 */
async function collectLocalIndexMd(): Promise<string | null> {
  try {
    const db = await openDB(DB_NAME, DB_VERSION);
    const row = await (db.get("meta", LOCAL_INDEX_MD_KEY) as Promise<
      { key: string; value?: string } | undefined
    >);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Read all `greater:harness:*` entries from localStorage.
 * Returns an object keyed by persona slug.
 */
function collectHarnesses(): Record<string, string> {
  const harnesses: Record<string, string> = {};
  if (typeof window === "undefined") return harnesses;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("greater:harness:")) continue;
      const slug = key.slice("greater:harness:".length);
      const text = localStorage.getItem(key) ?? "";
      if (text.trim()) {
        harnesses[slug] = text;
      }
    }
  } catch {
    // localStorage unavailable (private mode); skip harnesses.
  }
  return harnesses;
}

/**
 * Rough estimate of serialised JSON size for the given chunks.
 * Each float32 element costs ~10 bytes in JSON; the average chunk
 * also carries ~500 bytes of metadata + text.
 */
function estimateSize(chunks: ExportedChunk[]): number {
  if (chunks.length === 0) return 0;
  const sampleVector = chunks[0].vector;
  const vectorBytesPerChunk = sampleVector.length * 10;
  const metadataBytesPerChunk = 500;
  return chunks.length * (vectorBytesPerChunk + metadataBytesPerChunk);
}

export interface EjectKbOptions {
  /**
   * Restrict export to this persona (plus global chunks).
   * When `undefined`, all chunks are included unless the full export
   * exceeds the size limit and the caller has already chosen
   * per-persona mode via `forcePersonaScope`.
   */
  personaSlug?: string;
  /**
   * When `true`, restrict to `personaSlug` regardless of size.
   * Used when the user explicitly chose the per-persona option
   * after being warned about a large export.
   */
  forcePersonaScope?: boolean;
  onProgress?: (p: ExportProgress) => void;
}

export interface EjectKbResult {
  /** True when the full (all-persona) export fit within the size limit. */
  fullExport: boolean;
  /** Persona slug used for scoping, or `"__all__"`. */
  personaScope: "__all__" | string;
  /** Approximate serialised size in bytes. */
  estimatedBytes: number;
  /** The complete export object ready for JSON.stringify. */
  payload: KbExport;
}

/**
 * Estimate the size of a full export without reading all vectors.
 * Used by the UI to warn the user before committing to a download.
 */
export async function estimateFullExportSize(): Promise<number> {
  try {
    const db = await openDB(DB_NAME, DB_VERSION);
    const docs = await (db.getAll("documents") as Promise<KbChunk[]>);
    const embs = await (db.getAll("embeddings") as Promise<{ document_id: string; vector: number[] }[]>);
    if (embs.length === 0) return 0;
    return estimateSize(
      docs.map((d) => ({ ...d, vector: embs.find((e) => e.document_id === d.id)?.vector ?? [] }))
        .filter((d) => d.vector.length > 0) as ExportedChunk[],
    );
  } catch {
    return 0;
  }
}

/**
 * Build the export payload. Does NOT trigger the download — call
 * `downloadExport(result.payload)` for that.
 */
export async function buildExport(options: EjectKbOptions = {}): Promise<EjectKbResult> {
  const { personaSlug, forcePersonaScope, onProgress } = options;

  let chunks: ExportedChunk[];
  let personaScope: "__all__" | string;
  let fullExport: boolean;

  if (forcePersonaScope && personaSlug) {
    chunks = await collectChunks(personaSlug, onProgress);
    personaScope = personaSlug;
    fullExport = false;
  } else {
    chunks = await collectChunks(undefined, onProgress);
    const estimatedBytes = estimateSize(chunks);
    if (estimatedBytes > EXPORT_SIZE_LIMIT_BYTES) {
      fullExport = false;
      personaScope = personaSlug ?? "__all__";
      if (personaSlug) {
        chunks = await collectChunks(personaSlug, onProgress);
      }
    } else {
      fullExport = true;
      personaScope = "__all__";
    }
  }

  onProgress?.({ done: chunks.length, total: chunks.length, stage: "serialising" });

  const [harnesses, local_index_md] = await Promise.all([
    Promise.resolve(collectHarnesses()),
    collectLocalIndexMd(),
  ]);

  const payload: KbExport = {
    schema_version: EXPORT_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    persona_scope: personaScope,
    chunks,
    harnesses,
    local_index_md,
  };

  return {
    fullExport,
    personaScope,
    estimatedBytes: estimateSize(chunks),
    payload,
  };
}

/**
 * Trigger a browser download for the given export payload.
 * Filename is `greater-export-<ISO-date>.json`.
 */
export function downloadExport(payload: KbExport): void {
  const date = new Date().toISOString().slice(0, 10);
  const filename = `greater-export-${date}.json`;
  const json = JSON.stringify(payload);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
