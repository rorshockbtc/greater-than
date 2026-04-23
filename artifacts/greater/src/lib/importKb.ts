/**
 * Eject KB — import utility.
 *
 * Accepts a `greater-export.json` file, validates the schema version
 * header, deduplicates chunks by content hash, and writes new chunks
 * into the existing IndexedDB vector store. Restores local-index.md
 * if the export contains it. Harnesses are returned for the caller to
 * preview — they are NOT auto-saved.
 */

import { openDB } from "idb";
import { invalidateLexicalIndex } from "@/llm/lexicalIndex";
import type { KbExport, ExportedChunk } from "./exportKb";
import { EXPORT_SCHEMA_VERSION } from "./exportKb";

export class ImportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportValidationError";
  }
}

export interface ImportProgress {
  done: number;
  total: number;
}

export interface ImportResult {
  chunks_imported: number;
  chunks_skipped: number;
  /**
   * Harness texts found in the export, keyed by persona slug.
   * NOT saved automatically — the caller should display a read-only
   * preview and let the user explicitly save.
   */
  harnesses: Record<string, string>;
}

const DB_NAME = "greater-vector-store";
const DB_VERSION = 3;

/** Key used to persist the wiki-compiler output in the meta store. */
const LOCAL_INDEX_MD_KEY = "greater:local-index-md";

/**
 * Compute a stable content hash from a chunk's identifying fields.
 * Uses a djb2-derived hash of `page_url :: chunk_index :: text[0..512]`
 * so identical content from two separate indexing jobs is deduplicated.
 * The hash is kept short (base-36 encoded u32) for fast comparison.
 */
function contentHash(chunk: Pick<ExportedChunk, "text" | "page_url" | "chunk_index">): string {
  const s = `${chunk.page_url}\x00${chunk.chunk_index}\x00${chunk.text.slice(0, 512)}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 33) ^ s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * Parse and validate an uploaded export file. Throws
 * `ImportValidationError` for schema mismatches.
 */
export function parseExport(raw: string): KbExport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ImportValidationError(
      "File is not valid JSON. Make sure you selected a greater-export-*.json file.",
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { schema_version?: unknown }).schema_version !== EXPORT_SCHEMA_VERSION
  ) {
    throw new ImportValidationError(
      `Unrecognised export format. Expected schema_version "${EXPORT_SCHEMA_VERSION}".`,
    );
  }

  const obj = parsed as KbExport;

  if (!Array.isArray(obj.chunks)) {
    throw new ImportValidationError("Export file is missing the chunks array.");
  }

  return obj;
}

/**
 * Restore local-index.md into the meta store if the export contains it.
 */
async function restoreLocalIndexMd(content: string | null | undefined): Promise<void> {
  if (!content) return;
  try {
    const db = await openDB(DB_NAME, DB_VERSION);
    await db.put("meta", { key: LOCAL_INDEX_MD_KEY, value: content });
  } catch {
    // Meta store write failure is non-fatal; skip silently.
  }
}

/**
 * Merge the imported chunks into IndexedDB.
 * Deduplicates by content hash (page_url + chunk_index + text prefix)
 * so identical content re-imported from a second session is not doubled.
 * Existing rows whose content hash matches are skipped.
 */
export async function importChunks(
  chunks: ExportedChunk[],
  onProgress?: (p: ImportProgress) => void,
): Promise<{ imported: number; skipped: number }> {
  if (chunks.length === 0) return { imported: 0, skipped: 0 };

  const db = await openDB(DB_NAME, DB_VERSION);

  const existingDocs = await (db.getAll("documents") as Promise<
    Pick<ExportedChunk, "text" | "page_url" | "chunk_index">[]
  >);
  const existingHashes = new Set(existingDocs.map(contentHash));

  let imported = 0;
  let skipped = 0;
  const total = chunks.length;

  const BATCH = 50;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const tx = db.transaction(["documents", "embeddings"], "readwrite");

    for (const chunk of batch) {
      if (existingHashes.has(contentHash(chunk))) {
        skipped++;
      } else {
        const { vector, ...doc } = chunk;
        await tx.objectStore("documents").put(doc);
        await tx.objectStore("embeddings").put({ document_id: doc.id, vector });
        imported++;
      }
    }

    await tx.done;

    if (onProgress) {
      const done = Math.min(i + BATCH, total);
      onProgress({ done, total });
    }
  }

  if (imported > 0) {
    invalidateLexicalIndex();
  }

  return { imported, skipped };
}

/**
 * Full import pipeline: parse the file, write chunks, restore
 * local-index.md, and return harnesses for the caller to preview.
 */
export async function importKb(
  raw: string,
  onProgress?: (p: ImportProgress) => void,
): Promise<ImportResult> {
  const payload = parseExport(raw);

  const [{ imported, skipped }] = await Promise.all([
    importChunks(payload.chunks, onProgress),
    restoreLocalIndexMd(payload.local_index_md),
  ]);

  return {
    chunks_imported: imported,
    chunks_skipped: skipped,
    harnesses: payload.harnesses ?? {},
  };
}
