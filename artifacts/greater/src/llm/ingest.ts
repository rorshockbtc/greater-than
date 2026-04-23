import {
  ingestExtract,
  ingestRss,
  ingestSitemap,
} from "@workspace/api-client-react";
import { chunkText } from "./chunker";
import { GLOBAL_PERSONA_SLUG, putChunkWithVector } from "./vectorStore";
import type { Bias, IngestProgress, JobKind, KbChunk } from "./types";

/**
 * Ingestion orchestrator. Lives in the main thread because it needs the
 * embed worker (owned by `LLMProvider`) and IndexedDB. The HTTP fetches
 * to extract clean text are *not* run from the browser directly — they
 * go through the API server (`/api/ingest/*`) for CORS + rate limiting.
 *
 * The orchestrator is deliberately stateless and decoupled from React:
 * pass in an `embed` callback (typically `LLMProvider.embed`) plus a
 * progress callback, and it will report each milestone.
 *
 * Critical: NO LLM is called during ingestion. Extraction is Readability
 * on the server, chunking is deterministic word-count splitting, and
 * embedding is the local sentence-transformer. This is a hard product
 * constraint — every claim about "no telemetry, no cloud" depends on
 * ingestion staying offline.
 */

export type EmbedFn = (text: string) => Promise<number[]>;

/**
 * Ingestion modes. `page` indexes a single URL; `sitemap` walks an
 * XML sitemap (or sitemap index); `rss` walks an RSS 2.0 or Atom 1.0
 * feed. All three produce one "job" in the Knowledge panel — sitemap
 * and rss may produce many pages but appear as a single ingest unit
 * the user can remove with one click.
 */
export type IngestMode = "page" | "sitemap" | "rss";

export interface IngestOptions {
  url: string;
  mode: IngestMode;
  bias?: Bias;
  /**
   * Persona slug to stamp on every produced chunk (so retrieval can
   * scope by persona later). Omit to fall back to `__global__` —
   * appropriate for ingestions started outside any persona route
   * (e.g. the home-page Greater meta-bot).
   */
  personaSlug?: string;
  /** Called between each step so the UI can show a live counter. */
  onProgress?: (p: IngestProgress) => void;
  /** Cap on pages indexed when mode is sitemap or rss. */
  maxPages?: number;
}

export interface IngestResult {
  job_id: string;
  pages_indexed: number;
  chunks_indexed: number;
}

function chunkId(jobId: string, pageUrl: string, index: number): string {
  // Stable ID so re-running the same job with the same URLs overwrites
  // prior chunks rather than duplicating them.
  return `${jobId}::${pageUrl}#${index}`;
}

function newJobId(): string {
  // Small UUID; collision risk is irrelevant per browser.
  return crypto.randomUUID();
}

interface JobMeta {
  job_id: string;
  job_root_url: string;
  job_label: string;
  job_kind: JobKind;
}

async function indexSinglePage(
  pageUrl: string,
  bias: Bias,
  personaSlug: string,
  job: JobMeta,
  embed: EmbedFn,
  emit: (n: number) => void,
): Promise<{ chunks: number; pageLabel: string }> {
  const extracted = await ingestExtract({ url: pageUrl });
  const chunks = chunkText(extracted.contentText);
  const pageLabel =
    extracted.title?.trim() ||
    new URL(extracted.url).hostname + new URL(extracted.url).pathname;
  const indexedAt = Date.now();
  for (const ch of chunks) {
    const vec = await embed(ch.text);
    await putChunkWithVector(
      {
        id: chunkId(job.job_id, extracted.url, ch.chunk_index),
        job_id: job.job_id,
        job_root_url: job.job_root_url,
        job_label: job.job_label,
        job_kind: job.job_kind,
        page_url: extracted.url,
        page_label: pageLabel,
        chunk_index: ch.chunk_index,
        text: ch.text,
        bias,
        persona_slug: personaSlug,
        indexed_at: indexedAt,
      } satisfies KbChunk,
      vec,
    );
    emit(1);
  }
  return { chunks: chunks.length, pageLabel };
}

function jobLabelFromUrl(url: string, kind: JobKind): string {
  try {
    const u = new URL(url);
    const suffix =
      kind === "sitemap" ? " (sitemap)"
      : kind === "rss" ? " (feed)"
      : kind === "crawl" ? " (crawl)"
      : "";
    return `${u.hostname}${u.pathname === "/" ? "" : u.pathname}${suffix}`;
  } catch {
    return url;
  }
}

/* -------------------------------------------------------------- */
/*  Site-crawler orchestrator                                     */
/* -------------------------------------------------------------- */

/**
 * Options for {@link ingestCrawl}. Mirrors the shape of the server
 * `/ingest/crawl` body, plus the orchestrator-only `bias`,
 * `onProgress`, and `signal` fields.
 */
export interface CrawlOptions {
  root: string;
  maxPages?: number;
  maxDepth?: number;
  delayMs?: number;
  bias?: Bias;
  /** See {@link IngestOptions.personaSlug}. */
  personaSlug?: string;
  onProgress?: (p: IngestProgress) => void;
  /** AbortSignal for the Cancel button in the Knowledge panel. */
  signal?: AbortSignal;
}

/**
 * Server-side stream events. The server writes one JSON per line.
 * `discovered` is "we are about to fetch this URL"; `fetched` is
 * "here is the cleaned text"; `skipped`/`error` are non-fatal per-
 * URL conditions. `done` always closes a successful stream.
 */
type CrawlEvent =
  | { event: "queued"; discovered: number; fromSitemap?: boolean }
  | { event: "discovered"; url: string; depth: number; index: number }
  | {
      event: "fetched";
      url: string;
      title: string | null;
      contentText: string;
      length: number;
      index: number;
    }
  | { event: "skipped"; url: string; reason: string }
  | { event: "error"; url?: string; message: string }
  | {
      event: "done";
      pagesFetched: number;
      discovered: number;
      aborted: boolean;
      capUsed: number;
      capLimit: number;
    };

const RECENT_ERRORS_CAP = 5;

/**
 * Read NDJSON events off a fetch Response body. Yields one parsed
 * event per line; tolerates whitespace and ignores blank lines so a
 * trailing `\n` from the server doesn't yield an empty payload.
 */
async function* readNdjson(
  response: Response,
  signal: AbortSignal | undefined,
): AsyncGenerator<CrawlEvent, void, void> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      if (signal?.aborted) {
        await reader.cancel().catch(() => {});
        return;
      }
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // Process complete lines; keep any trailing partial line in buf.
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          yield JSON.parse(line) as CrawlEvent;
        } catch {
          // Drop malformed lines; the stream protocol is JSON-per-line
          // and a partial buffer would have been kept by the indexOf
          // check above.
        }
      }
    }
    const tail = buf.trim();
    if (tail) {
      try {
        yield JSON.parse(tail) as CrawlEvent;
      } catch {
        // ignore
      }
    }
  } finally {
    reader.releaseLock?.();
  }
}

export async function ingestCrawl(
  embed: EmbedFn,
  options: CrawlOptions,
): Promise<IngestResult> {
  const bias: Bias = options.bias ?? "neutral";
  const personaSlug = options.personaSlug ?? GLOBAL_PERSONA_SLUG;
  const onProgress = options.onProgress ?? (() => undefined);
  const job: JobMeta = {
    job_id: newJobId(),
    job_root_url: options.root,
    job_kind: "crawl",
    job_label: jobLabelFromUrl(options.root, "crawl"),
  };

  const progress: IngestProgress = {
    total_pages: 0,
    done_pages: 0,
    done_chunks: 0,
    pages_fetched: 0,
    errors: 0,
    recent_errors: [],
    stage: "discovering",
    current_url: options.root,
  };
  onProgress({ ...progress });

  let response: Response;
  try {
    response = await fetch("/api/ingest/crawl", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: options.signal,
      body: JSON.stringify({
        root: options.root,
        maxPages: options.maxPages,
        maxDepth: options.maxDepth,
        delayMs: options.delayMs,
      }),
    });
  } catch (err) {
    progress.stage = "error";
    progress.error = (err as Error).message;
    onProgress({ ...progress });
    throw err;
  }

  if (!response.ok) {
    let errMsg = `Crawl request failed: ${response.status}`;
    try {
      const data = await response.json();
      if (data?.error) errMsg = data.error;
    } catch {
      // Non-JSON error body; keep the status-code message.
    }
    progress.stage = "error";
    progress.error = errMsg;
    onProgress({ ...progress });
    throw new Error(errMsg);
  }

  let pagesEmbedded = 0;
  let totalChunks = 0;

  try {
    for await (const ev of readNdjson(response, options.signal)) {
      switch (ev.event) {
        case "queued": {
          progress.total_pages = Math.max(progress.total_pages, ev.discovered);
          progress.stage = "crawling";
          onProgress({ ...progress });
          break;
        }
        case "discovered": {
          progress.current_url = ev.url;
          progress.stage = "crawling";
          onProgress({ ...progress });
          break;
        }
        case "fetched": {
          progress.pages_fetched = (progress.pages_fetched ?? 0) + 1;
          progress.current_url = ev.url;
          progress.stage = "embedding";
          onProgress({ ...progress });
          if (!ev.contentText || ev.contentText.length < 40) {
            // Page came back empty (paywall, JS-rendered, 404 page).
            // Count as a soft skip rather than an error.
            break;
          }
          const chunks = chunkText(ev.contentText);
          const pageLabel =
            ev.title?.trim() ||
            (() => {
              try {
                const u = new URL(ev.url);
                return `${u.hostname}${u.pathname}`;
              } catch {
                return ev.url;
              }
            })();
          const indexedAt = Date.now();
          for (const ch of chunks) {
            if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
            const vec = await embed(ch.text);
            await putChunkWithVector(
              {
                id: chunkId(job.job_id, ev.url, ch.chunk_index),
                job_id: job.job_id,
                job_root_url: job.job_root_url,
                job_label: job.job_label,
                job_kind: job.job_kind,
                page_url: ev.url,
                page_label: pageLabel,
                chunk_index: ch.chunk_index,
                text: ch.text,
                bias,
                persona_slug: personaSlug,
                indexed_at: indexedAt,
              } satisfies KbChunk,
              vec,
            );
            totalChunks += 1;
            progress.done_chunks = totalChunks;
            onProgress({ ...progress });
          }
          pagesEmbedded += 1;
          progress.done_pages = pagesEmbedded;
          onProgress({ ...progress });
          break;
        }
        case "skipped":
        case "error": {
          progress.errors = (progress.errors ?? 0) + 1;
          const msg =
            ev.event === "skipped"
              ? `${ev.url}: ${ev.reason}`
              : ev.url
                ? `${ev.url}: ${ev.message}`
                : ev.message;
          const recent = progress.recent_errors ?? [];
          progress.recent_errors = [...recent, msg].slice(-RECENT_ERRORS_CAP);
          onProgress({ ...progress });
          break;
        }
        case "done": {
          progress.stage = "complete";
          progress.current_url = undefined;
          onProgress({ ...progress });
          break;
        }
      }
    }
  } catch (err) {
    if (
      options.signal?.aborted ||
      (err instanceof DOMException && err.name === "AbortError")
    ) {
      // Cancelled — we still want to keep whatever we embedded so far.
      progress.stage = "complete";
      progress.current_url = undefined;
      onProgress({ ...progress });
    } else {
      progress.stage = "error";
      progress.error = (err as Error).message;
      onProgress({ ...progress });
      throw err;
    }
  }

  return {
    job_id: job.job_id,
    pages_indexed: pagesEmbedded,
    chunks_indexed: totalChunks,
  };
}

export async function ingestUrl(
  embed: EmbedFn,
  options: IngestOptions,
): Promise<IngestResult> {
  const bias: Bias = options.bias ?? "neutral";
  const personaSlug = options.personaSlug ?? GLOBAL_PERSONA_SLUG;
  const onProgress = options.onProgress ?? (() => undefined);
  const maxPages = options.maxPages ?? 200;

  const job: JobMeta = {
    job_id: newJobId(),
    job_root_url: options.url,
    job_kind: options.mode,
    job_label: jobLabelFromUrl(options.url, options.mode),
  };

  const progress: IngestProgress = {
    total_pages: options.mode === "page" ? 1 : 0,
    done_pages: 0,
    done_chunks: 0,
    stage: "discovering",
    current_url: options.url,
  };
  onProgress(progress);

  try {
    let pageUrls: string[];
    if (options.mode === "page") {
      pageUrls = [options.url];
    } else if (options.mode === "sitemap") {
      const res = await ingestSitemap({ url: options.url });
      pageUrls = res.urls.slice(0, maxPages);
    } else {
      const res = await ingestRss({ url: options.url });
      pageUrls = res.urls.slice(0, maxPages);
    }

    progress.total_pages = pageUrls.length;
    progress.stage = "extracting";
    onProgress({ ...progress });

    let totalChunks = 0;
    let pagesDone = 0;

    for (const pageUrl of pageUrls) {
      progress.current_url = pageUrl;
      progress.stage = "extracting";
      onProgress({ ...progress });
      try {
        await indexSinglePage(pageUrl, bias, personaSlug, job, embed, (n) => {
          totalChunks += n;
          progress.done_chunks = totalChunks;
          progress.stage = "embedding";
          onProgress({ ...progress });
        });
        pagesDone += 1;
        progress.done_pages = pagesDone;
        progress.done_chunks = totalChunks;
        onProgress({ ...progress });
      } catch (err) {
        // Soft-fail individual pages on a multi-page walk so one 502
        // does not abort a hundred-page index. Single-page mode does
        // re-throw because the user is watching one URL.
        if (options.mode === "page") throw err;
        // eslint-disable-next-line no-console
        console.warn(`Skipping ${pageUrl}: ${(err as Error).message}`);
      }
    }

    progress.stage = "complete";
    progress.current_url = undefined;
    onProgress({ ...progress });
    return {
      job_id: job.job_id,
      pages_indexed: pagesDone,
      chunks_indexed: totalChunks,
    };
  } catch (err) {
    progress.stage = "error";
    progress.error = (err as Error).message;
    onProgress({ ...progress });
    throw err;
  }
}
