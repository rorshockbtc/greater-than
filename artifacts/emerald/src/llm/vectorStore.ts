import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Bias, IndexedSource, KbChunk, RetrievedChunk } from "./types";

/**
 * IndexedDB-backed vector store for the Greater RAG pipeline.
 *
 * - `documents` keeps the human-readable corpus chunks (text + page URL +
 *   ingestion-job metadata + bias). A `by_job_id` index supports fast
 *   "remove this source" semantics in the Knowledge panel; a
 *   `by_page_url` index is kept to dedupe re-indexing the same page.
 * - `embeddings` keeps the dense vectors keyed by document id.
 * - `meta` records the seed-corpus version + the embedder used to build
 *   the index so cache invalidation is automatic when either changes,
 *   plus arbitrary key/value flags (e.g. "bitcoin-bundle:v1" markers).
 *
 * Cosine similarity is computed in-process; for the seed-corpus size
 * (~20 chunks) this is trivially fast. The Bitcoin bundle pushes us to
 * O(10k) chunks which is still well under the threshold where you'd
 * want a real ANN index.
 */

const DB_NAME = "greater-vector-store";
const DB_VERSION = 3;

interface DocumentRow extends KbChunk {}
interface EmbeddingRow {
  document_id: string;
  vector: number[];
}
interface MetaRow {
  key: string;
  value?: string;
  version?: string;
  embedderName?: string;
  count?: number;
  installed_at?: number;
}

interface GreaterVectorDB extends DBSchema {
  documents: {
    key: string;
    value: DocumentRow;
    indexes: { by_job_id: string; by_page_url: string };
  };
  embeddings: { key: string; value: EmbeddingRow };
  meta: { key: string; value: MetaRow };
}

let dbPromise: Promise<IDBPDatabase<GreaterVectorDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<GreaterVectorDB>(DB_NAME, DB_VERSION, {
      // The `transaction` parameter is the active versionchange
      // transaction; we MUST use it (rather than opening a new one) to
      // mutate existing stores during upgrade. Opening a fresh tx here
      // throws InvalidStateError.
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains("documents")) {
          const store = db.createObjectStore("documents", { keyPath: "id" });
          store.createIndex("by_job_id", "job_id", { unique: false });
          store.createIndex("by_page_url", "page_url", { unique: false });
        } else {
          const store = transaction.objectStore("documents");
          // The previous schema (v2) keyed sources by `source_url`.
          // The job-grouping refactor in v3 replaces it with `job_id`
          // and `page_url`. Drop the old index if present and add the
          // new ones; pre-existing rows are wiped because their shape
          // is incompatible — they would all collapse into one giant
          // pseudo-job otherwise, which is worse than re-indexing.
          // The string literal is intentional — DOMStringList#contains takes a
          // free-form name; the typed index whitelist would (correctly) reject
          // a deleted v2 index.
          const legacyIndex = "by_source_url" as unknown as
            | "by_job_id"
            | "by_page_url";
          if (store.indexNames.contains(legacyIndex)) {
            store.deleteIndex(legacyIndex);
          }
          if (!store.indexNames.contains("by_job_id")) {
            store.createIndex("by_job_id", "job_id", { unique: false });
          }
          if (!store.indexNames.contains("by_page_url")) {
            store.createIndex("by_page_url", "page_url", { unique: false });
          }
          if (oldVersion < 3) {
            // Wipe v2 rows so they get re-embedded under the new schema.
            store.clear();
            transaction.objectStore("embeddings").clear();
            transaction.objectStore("meta").clear();
          }
        }
        if (!db.objectStoreNames.contains("embeddings"))
          db.createObjectStore("embeddings", { keyPath: "document_id" });
        if (!db.objectStoreNames.contains("meta"))
          db.createObjectStore("meta", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

export async function getCorpusMeta(): Promise<MetaRow | undefined> {
  const db = await getDb();
  return db.get("meta", "corpus");
}

export async function setCorpusMeta(
  version: string,
  embedderName: string,
  count: number,
): Promise<void> {
  const db = await getDb();
  await db.put("meta", {
    key: "corpus",
    version,
    embedderName,
    count,
  });
}

export async function getMetaFlag(key: string): Promise<MetaRow | undefined> {
  const db = await getDb();
  return db.get("meta", key);
}

export async function setMetaFlag(
  key: string,
  value: string,
): Promise<void> {
  const db = await getDb();
  await db.put("meta", { key, value, installed_at: Date.now() });
}

export async function clearAll(): Promise<void> {
  const db = await getDb();
  await db.clear("documents");
  await db.clear("embeddings");
  await db.clear("meta");
}

export async function putChunkWithVector(
  chunk: KbChunk,
  vector: number[],
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["documents", "embeddings"], "readwrite");
  await tx.objectStore("documents").put(chunk);
  await tx
    .objectStore("embeddings")
    .put({ document_id: chunk.id, vector });
  await tx.done;
}

export async function countDocuments(): Promise<number> {
  const db = await getDb();
  return db.count("documents");
}

/**
 * Count documents belonging to a specific ingestion job. Used by the
 * seed-corpus bootstrap to decide whether the seed slice is intact
 * without depending on the total IndexedDB row count (which is
 * inflated by user-ingested sources and the optional Bitcoin bundle).
 */
export async function countDocumentsByJob(jobId: string): Promise<number> {
  const db = await getDb();
  return db.countFromIndex("documents", "by_job_id", jobId);
}

/**
 * Delete every chunk + embedding belonging to the given ingestion job.
 * Used by the Knowledge panel's "Remove" button. One job may span
 * many page URLs (sitemap walk, RSS ingest), so this removes them all
 * in a single transaction.
 */
export async function deleteByJob(jobId: string): Promise<number> {
  const db = await getDb();
  const tx = db.transaction(["documents", "embeddings"], "readwrite");
  const docs = await tx
    .objectStore("documents")
    .index("by_job_id")
    .getAll(jobId);
  for (const doc of docs) {
    await tx.objectStore("documents").delete(doc.id);
    await tx.objectStore("embeddings").delete(doc.id);
  }
  await tx.done;
  return docs.length;
}

/**
 * List every distinct ingestion job with its page count, chunk count,
 * and most recent indexing timestamp. Used by the Knowledge panel.
 */
export async function listSources(): Promise<IndexedSource[]> {
  const db = await getDb();
  const docs = await db.getAll("documents");
  const map = new Map<string, IndexedSource & { _pages: Set<string> }>();
  for (const doc of docs) {
    const existing = map.get(doc.job_id);
    if (existing) {
      existing.chunk_count += 1;
      existing._pages.add(doc.page_url);
      if (
        doc.indexed_at &&
        (!existing.indexed_at || doc.indexed_at > existing.indexed_at)
      ) {
        existing.indexed_at = doc.indexed_at;
      }
    } else {
      map.set(doc.job_id, {
        job_id: doc.job_id,
        job_root_url: doc.job_root_url,
        job_label: doc.job_label,
        job_kind: doc.job_kind,
        page_count: 0, // filled in below from _pages
        chunk_count: 1,
        bias: doc.bias,
        indexed_at: doc.indexed_at,
        _pages: new Set([doc.page_url]),
      });
    }
  }
  return Array.from(map.values())
    .map(({ _pages, ...rest }) => ({ ...rest, page_count: _pages.size }))
    .sort((a, b) => (b.indexed_at ?? 0) - (a.indexed_at ?? 0));
}

export function cosine(a: number[], b: number[]): number {
  // Embeddings are L2-normalized at the embedder; cosine reduces to dot
  // product, but we still compute the full form to stay correct if the
  // normalization assumption ever changes.
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export async function topK(
  queryVector: number[],
  k: number,
  options: { biasFilter?: Bias[] } = {},
): Promise<RetrievedChunk[]> {
  const db = await getDb();
  const [docs, embs] = await Promise.all([
    db.getAll("documents"),
    db.getAll("embeddings"),
  ]);
  const docById = new Map(docs.map((d) => [d.id, d]));
  const scored: RetrievedChunk[] = [];
  for (const row of embs) {
    const doc = docById.get(row.document_id);
    if (!doc) continue;
    if (options.biasFilter && options.biasFilter.length > 0) {
      const tag: Bias = doc.bias ?? "neutral";
      if (!options.biasFilter.includes(tag)) continue;
    }
    scored.push({ ...doc, score: cosine(queryVector, row.vector) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
