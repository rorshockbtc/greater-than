/**
 * Local file system sync — ingests documents from a user-chosen local
 * directory into the Greater in-browser vector store using the
 * File System Access API.
 *
 * Privacy guarantee
 * -----------------
 * Files are read directly from the user's file system into browser
 * memory. They are never uploaded to a server. Chunking and embedding
 * run in the existing local Web Worker. The resulting embeddings are
 * persisted only to IndexedDB on the user's own machine.
 *
 * This is the "sovereign data companion" answer to the question:
 * "Where does my data go?" — nowhere. It stays on the hard drive.
 *
 * Supported file types
 * --------------------
 *   .txt, .md, .mdx      — plain text / markdown
 *   .json                 — serialized text content (stringified)
 *   .csv                  — row text (first 64 chars/row for efficiency)
 *   .html, .htm           — inner-text stripped of tags
 *   Everything else        — attempted UTF-8 read; skipped on decode error
 *
 * Constraints
 * -----------
 * - Requires a browser that supports `window.showDirectoryPicker`
 *   (Chrome / Edge 86+; Firefox with dom.fs.enabled flag in 111+).
 * - Files > 5 MB are skipped (same MAX_BYTES cap as the server-side
 *   ingest routes).
 * - The user must grant permission each session (API design; cannot
 *   be persisted without a StorageManager.persist() grant).
 */

import { chunkText } from "./chunker";
import { GLOBAL_PERSONA_SLUG, putChunkWithVector } from "./vectorStore";
import type { EmbedFn } from "./ingest";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "mdx", "markdown",
  "rst", "asciidoc", "adoc",
  "json", "jsonl", "ndjson",
  "csv", "tsv",
  "html", "htm",
  "xml",
  "js", "ts", "tsx", "jsx",
  "py", "rb", "go", "rs", "java", "c", "cpp", "cs", "swift", "kt",
  "sh", "bash", "zsh",
  "yaml", "yml", "toml", "ini", "env",
]);

function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i !== -1 ? name.slice(i + 1).toLowerCase() : "";
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeContent(text: string, ext: string): string {
  switch (ext) {
    case "html":
    case "htm":
      return stripHtmlTags(text);
    case "json":
    case "jsonl":
    case "ndjson": {
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed === "string") return parsed;
        return JSON.stringify(parsed, null, 2);
      } catch {
        return text;
      }
    }
    case "csv":
    case "tsv": {
      return text
        .split("\n")
        .map((r) => r.replace(/,|\t/g, " | ").trim())
        .filter(Boolean)
        .join("\n");
    }
    default:
      return text;
  }
}

export interface FileSystemSyncOptions {
  embed: EmbedFn;
  onProgress?: (fileName: string, done: number, total: number) => void;
  /** Bias tag for all chunks from this directory. Default: "neutral". */
  bias?: "neutral" | "core" | "knots";
  /**
   * Persona slug to stamp on every produced chunk so retrieval can
   * scope by persona (Task #26). Defaults to `__global__` so files
   * added from the home page stay eligible across all personas.
   */
  personaSlug?: string;
}

export interface FileSystemSyncResult {
  files_read: number;
  files_skipped: number;
  chunks_indexed: number;
  directory_name: string;
}

/** Returns true when the File System Access API is available. */
export function hasFileSystemAccess(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

async function walkDirectory(
  dirHandle: FileSystemDirectoryHandle,
  depth = 0,
): Promise<FileSystemFileHandle[]> {
  if (depth > 6) return [];
  const handles: FileSystemFileHandle[] = [];
  for await (const [, entry] of (dirHandle as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
    if (entry.kind === "file") {
      const ext = fileExtension(entry.name);
      if (ext && TEXT_EXTENSIONS.has(ext)) {
        handles.push(entry as FileSystemFileHandle);
      }
    } else if (entry.kind === "directory") {
      const name = (entry as FileSystemDirectoryHandle).name;
      if (name.startsWith(".") || name === "node_modules" || name === "__pycache__") continue;
      const sub = await walkDirectory(entry as FileSystemDirectoryHandle, depth + 1);
      handles.push(...sub);
    }
  }
  return handles;
}

export async function syncLocalFiles(
  jobId: string,
  options: FileSystemSyncOptions,
): Promise<FileSystemSyncResult> {
  if (!hasFileSystemAccess()) {
    throw new Error(
      "Your browser doesn't support the File System Access API. " +
      "Try Chrome or Edge 86+.",
    );
  }

  const dirHandle = await (window as unknown as {
    showDirectoryPicker: (opts?: { mode?: string }) => Promise<FileSystemDirectoryHandle>;
  }).showDirectoryPicker({ mode: "read" });

  const dirName = dirHandle.name;
  const {
    embed,
    onProgress,
    bias = "neutral",
    personaSlug = GLOBAL_PERSONA_SLUG,
  } = options;

  const fileHandles = await walkDirectory(dirHandle);
  const total = fileHandles.length;
  let files_read = 0;
  let files_skipped = 0;
  let chunks_indexed = 0;

  for (let i = 0; i < fileHandles.length; i++) {
    const handle = fileHandles[i]!;
    onProgress?.(handle.name, i, total);

    let text: string;
    try {
      const file = await handle.getFile();
      if (file.size > MAX_FILE_BYTES) {
        files_skipped++;
        continue;
      }
      text = await file.text();
    } catch {
      files_skipped++;
      continue;
    }

    const ext = fileExtension(handle.name);
    const normalized = normalizeContent(text, ext);
    if (normalized.trim().length < 20) {
      files_skipped++;
      continue;
    }

    let path = handle.name;
    try {
      path = await (dirHandle as FileSystemDirectoryHandle & {
        resolve: (h: FileSystemHandle) => Promise<string[] | null>;
      }).resolve(handle).then((p) => (p ? p.join("/") : handle.name));
    } catch {}

    const pageUrl = `local://${dirName}/${path}`;
    const chunks = chunkText(normalized);

    for (const chunk of chunks) {
      const chunkId = `${jobId}::${pageUrl}#${chunk.chunk_index}`;
      const vec = await embed(chunk.text);
      await putChunkWithVector(
        {
          id: chunkId,
          job_id: jobId,
          job_root_url: `local://${dirName}`,
          job_label: dirName,
          job_kind: "local-files",
          page_url: pageUrl,
          page_label: path,
          chunk_index: chunk.chunk_index,
          text: chunk.text,
          bias,
          persona_slug: personaSlug,
          indexed_at: Date.now(),
        },
        vec,
      );
      chunks_indexed++;
    }

    files_read++;
    onProgress?.(handle.name, i + 1, total);
  }

  return { files_read, files_skipped, chunks_indexed, directory_name: dirName };
}
