/**
 * Shared types for the in-browser LLM stack.
 *
 * The model runs in a Web Worker (see `llmWorker.ts`); the React provider
 * (see `LLMProvider.tsx`) owns the worker reference and exposes the
 * imperative API to the rest of the app.
 */

export type ChatRole = "system" | "user" | "assistant";
export interface ChatTurn {
  role: ChatRole;
  content: string;
}

/**
 * Bias label attached to ingested chunks.
 *
 *  - `core`     — content originating from the bitcoin/bitcoin reference
 *                 implementation (commits, release notes, official docs).
 *  - `knots`    — content from the bitcoinknots/bitcoin alternative client.
 *  - `neutral`  — third-party content with no fork affiliation (OpTech,
 *                 BitcoinTalk, generic web pages indexed by users).
 *
 * Tagged at ingestion time only. The toggle that filters retrieval by
 * bias is built in Task #5; this task just stamps the metadata.
 */
export type Bias = "core" | "knots" | "neutral";

/**
 * Kind of ingestion that produced a chunk. Used by the Knowledge UI
 * to group chunks by the *job* the user submitted (a single page,
 * a sitemap walk, an RSS/Atom feed pull, the seed corpus, or the
 * Bitcoin bundle), rather than by the per-page URL.
 */
export type JobKind =
  | "page"
  | "sitemap"
  | "rss"
  | "crawl"
  | "seed"
  | "bitcoin-bundle"
  | "seed-bundle"
  | "nostr"
  | "local-files";

export interface KbChunk {
  id: string;

  /**
   * Identifier of the ingestion *job* that produced this chunk. All
   * pages discovered through the same sitemap or feed share a job_id;
   * a single-page ingest creates a job_id of its own. Used as the
   * grouping key in the Knowledge panel.
   */
  job_id: string;

  /**
   * The URL the user submitted (page URL, sitemap URL, or feed URL).
   * Stored alongside the per-chunk page_url so that "remove this
   * source" semantics can act on the whole job.
   */
  job_root_url: string;

  /** Human-readable label for the job ("Bitcoin Optech RSS feed"). */
  job_label: string;

  /** What kind of ingestion this chunk came from. */
  job_kind: JobKind;

  /** URL of the actual page this chunk was extracted from. */
  page_url: string;

  /** Title of the page this chunk was extracted from. */
  page_label: string;

  /** Position of this chunk within its page. */
  chunk_index: number;

  text: string;

  /** Optional bias tag; absent on legacy chunks (treated as 'neutral'). */
  bias?: Bias;

  /**
   * Persona slug this chunk belongs to. Use the literal `__global__`
   * for cross-persona content (the meta-bot corpus, user ingestions
   * from the home page, etc.). Absent on legacy chunks written before
   * the persona-scope migration; the migration backfills it from
   * `job_id`. Retrieval filters by this so the FinTech corpus does
   * not leak into Cornerstone Church results, etc.
   */
  persona_slug?: string;

  /** Unix ms when the chunk was indexed. */
  indexed_at?: number;
}

/**
 * Aggregate stats per ingestion *job*, used by the Knowledge panel.
 * One row per `job_id`.
 */
export interface IndexedSource {
  job_id: string;
  job_root_url: string;
  job_label: string;
  job_kind: JobKind;
  page_count: number;
  chunk_count: number;
  bias?: Bias;
  /** Most recent `indexed_at` across all chunks in the job. */
  indexed_at?: number;
}

export interface IngestProgress {
  /** Pages discovered (1 for single-page mode, N for sitemap/RSS/crawl). */
  total_pages: number;
  /** Pages whose extraction + chunking + embedding finished. */
  done_pages: number;
  /** Total chunks added so far across all pages. */
  done_chunks: number;
  /** Stage label for the UI. */
  stage:
    | "discovering"
    | "extracting"
    | "embedding"
    | "crawling"
    | "complete"
    | "error";
  /** URL currently being worked on, if any. */
  current_url?: string;
  /** Error message; only set when stage === 'error'. */
  error?: string;
  /**
   * Crawl-only: number of pages the server reported as fetched
   * (extracted) so far. May lead `done_pages` because embedding
   * happens client-side after each fetch event arrives.
   */
  pages_fetched?: number;
  /** Crawl-only: cumulative skip/error count from the server stream. */
  errors?: number;
  /** Most recent error messages, capped to a small window. */
  recent_errors?: string[];
}

export interface RetrievedChunk extends KbChunk {
  score: number;
}

export type ResponseSource = "local" | "cloud" | "openclaw" | "qa-cache";

/**
 * Bring-Your-Own-LLM config for OpenClaw mode. Any OpenAI-compatible
 * HTTP server (Ollama, llama.cpp, LM Studio, vLLM, …) becomes
 * Greater's inference backend when the visitor enables this. The
 * config persists to `localStorage` so a returning visitor doesn't
 * have to re-enter their endpoint each session.
 */
export interface OpenClawConfig {
  /** Master switch. When false, all other fields are ignored. */
  enabled: boolean;
  /**
   * Base URL of the OpenAI-compatible endpoint, *without* trailing
   * slash and *without* the `/chat/completions` suffix. Examples:
   *   - `http://localhost:11434/v1`   (Ollama)
   *   - `http://localhost:1234/v1`    (LM Studio)
   *   - `http://localhost:8080/v1`    (llama.cpp server)
   */
  baseUrl: string;
  /** Model identifier passed to the OpenAI Chat Completions API. */
  model: string;
  /** Optional bearer token; only sent when non-empty. */
  apiKey: string;
}

export interface OpenClawHealth {
  state: "idle" | "testing" | "ok" | "error";
  /** Human-readable error message when state === 'error'. */
  message?: string;
  /** Models reported by the endpoint's `/models` listing, if any. */
  models?: string[];
  /** Unix ms of the last test attempt (success OR failure). */
  testedAt?: number;
}

/**
 * Why a given message was served from the cloud rather than locally.
 * Carried per-message so the UI can label each turn truthfully even
 * after the global model state has changed.
 */
export type CloudReason = "loading" | "unsupported" | "local-error";

export interface ThoughtTrace {
  /** Chunks actually fed into the prompt (not fabricated). */
  chunks: RetrievedChunk[];
  /** Short summary of what the model considered. */
  reasoning: string;
}

/* ---------- Worker message protocol ---------- */

export type LoadStage = "embedder" | "llm";

export interface ProgressEvent {
  type: "progress";
  stage: LoadStage;
  /** Filename the worker is currently downloading. */
  file?: string;
  /** 0..100; -1 if unknown. */
  progress?: number;
  status?: string;
}

export interface ReadyEvent {
  type: "ready";
  stage: LoadStage | "all";
}

export interface ErrorEvent {
  type: "error";
  id?: string;
  stage?: LoadStage;
  message: string;
}

export interface EmbedRequest {
  type: "embed";
  id: string;
  text: string;
}

export interface EmbedResult {
  type: "embedResult";
  id: string;
  vector: number[];
}

export interface GenerateRequest {
  type: "generate";
  id: string;
  messages: ChatTurn[];
  maxNewTokens?: number;
}

export interface GenerateResult {
  type: "generateResult";
  id: string;
  text: string;
}

export type WorkerInbound = { type: "init" } | EmbedRequest | GenerateRequest;
export type WorkerOutbound =
  | ProgressEvent
  | ReadyEvent
  | ErrorEvent
  | EmbedResult
  | GenerateResult;

/* ---------- Provider-facing API ---------- */

/**
 * Stages of model readiness. The chat widget reflects these directly:
 *   unsupported → no WebGPU; permanent cloud-only mode
 *   idle        → worker not yet started (briefly, on mount)
 *   loading-embedder / loading-llm → downloads in flight
 *   ready       → local inference available
 *   error       → load failed; cloud fallback continues
 */
export type ModelStatus =
  | "idle"
  | "unsupported"
  | "loading-embedder"
  | "loading-llm"
  | "ready"
  | "error";

export interface ModelInfo {
  llmName: string;
  llmQuantization: string;
  embedderName: string;
  approxSizeMb: number;
  loadedAt: Date | null;
}

export interface LocalAnswer {
  text: string;
  source: ResponseSource;
  thoughtTrace?: ThoughtTrace;
}

/**
 * Per-turn knobs supplied by the chat widget. Both fields are
 * Pipe-driven (see `@workspace/pipes`):
 *
 *  - `systemPrompt` overrides the default Greater system prompt with
 *    the active Pipe's bias-specific prompt, allowing the bot to
 *    adopt a Core / Knots / Neutral posture mid-conversation.
 *  - `biasFilter` restricts retrieval to chunks tagged with one of
 *    the listed biases. Callers should always include `'neutral'`
 *    so common-ground material remains eligible regardless of fork.
 */
export interface AskOptions {
  systemPrompt?: string;
  biasFilter?: Bias[];
  /**
   * Stable id of the active bias perspective. Carried so that cloud
   * fallback requests (which can't read the Pipe registry) can still
   * pass the bias through to the server, and so the per-message bias
   * chip on the response stays truthful.
   */
  biasId?: string;
  /** Human-readable label for `biasId` (e.g. "Core", "Knots"). */
  biasLabel?: string;
  /**
   * Persona slug ("startups", "faith", …) used to scope the curated
   * Q&A cache lookup. When omitted, the cache check is skipped and
   * inference falls through to the regular RAG path.
   */
  personaSlug?: string;
  /**
   * When true (the default), the chat refuses to answer when retrieval
   * returns nothing relevant — instead of letting the small in-browser
   * model fall back to its pretraining and hallucinate a "helpful
   * general assistant" response. This is the trust guarantee behind
   * the LOCAL · PRIVATE badge: the bot never claims competence it
   * can't ground in cited snippets. Set to `false` only for routes
   * that explicitly want the unguarded model behavior. Threshold is
   * a low cosine similarity (any reasonably-related chunk passes);
   * the goal is to catch "what is the meaning of life" style off-
   * corpus drift, not to nitpick borderline matches.
   */
  strictGrounding?: boolean;
  /**
   * Short noun phrase describing what this bot covers, used in the
   * deterministic off-corpus refusal text. Example: "Greater itself
   * (the FOSS shell, the six bots, OpenClaw, hiring colonhyphenbracket
   * to build a Pipe)". When omitted, the refusal uses generic copy.
   */
  refusalScope?: string;
  /**
   * User-authored "Local Harness" charter text, injected as the very
   * first block of the system prompt — above the persona identity,
   * above the bias hint, above the RAG chunks. Sourced from
   * `localStorage` via the HarnessPanel and passed through on every
   * turn so the operator's rules and compressed knowledge index
   * anchor the model before any other instruction reaches it.
   *
   * Trimmed before use; empty string / undefined → no-op.
   */
  harnessText?: string;
}
