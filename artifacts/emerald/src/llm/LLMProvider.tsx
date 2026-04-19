import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AskOptions,
  ChatTurn,
  EmbedResult,
  GenerateResult,
  IngestProgress,
  LocalAnswer,
  ModelInfo,
  ModelStatus,
  RetrievedChunk,
  ThoughtTrace,
  WorkerOutbound,
} from "./types";
import { ingestUrl, type IngestOptions, type IngestResult } from "./ingest";
// IMPORTANT: import constants from the worker-safe config module, NOT
// from `./llmWorker`. Importing the worker module on the main thread
// would drag the entire @huggingface/transformers runtime into the
// initial bundle and execute worker-only top-level code on `window`,
// defeating the lazy-load design.
import {
  APPROX_SIZE_MB,
  EMBEDDER_MODEL_ID,
  LLM_MODEL_ID,
  LLM_QUANTIZATION_LABEL,
} from "./config";
import { SEED_CORPUS } from "./seedCorpus";
import {
  clearAll,
  countDocumentsByJob,
  deleteByJob,
  getCorpusMeta,
  getMetaFlag,
  putChunkWithVector,
  setCorpusMeta,
  setMetaFlag,
  topK,
} from "./vectorStore";

const SEED_CORPUS_VERSION = "v2-seed-blockstream";

interface SeedBundleDoc {
  /** Per-page URL inside the bundle. */
  source_url: string;
  /** Per-page title inside the bundle. */
  source_label: string;
  bias?: "core" | "knots" | "neutral";
  chunks: { text: string; chunk_index: number }[];
}

interface SeedBundle {
  version?: string;
  generated_at?: string;
  documents: SeedBundleDoc[];
}

/** Job-id constant used for the hand-curated startup seed (Blockstream). */
const SEED_JOB_ID = "seed-blockstream";
const SEED_JOB_ROOT_URL = "https://help.blockstream.com/";
const SEED_JOB_LABEL = "Blockstream support seed corpus";

/**
 * Registry of optional, on-demand seed bundles. Each demo route
 * requests its own bundle via `requestSeedBundle(slug)`; the loader
 * fetches `<base>/seeds/<slug>.json` once and persists the chunks
 * into IndexedDB. A 404 marks the bundle as `absent` so the FOSS
 * fork (which ships no bundles) doesn't keep re-checking. Adding a
 * new persona only requires dropping a new file in `public/seeds/`
 * and adding an entry here.
 */
interface SeedBundleConfig {
  /** Slug used as the meta flag key, the URL filename, and the job id. */
  slug: string;
  /** Bumped to force a re-index after corpus changes. */
  version: string;
  /** Used for the Knowledge panel's job grouping. */
  jobLabel: string;
}

const SEED_BUNDLES: Record<string, SeedBundleConfig> = {
  bitcoin: {
    slug: "bitcoin",
    version: "v1",
    jobLabel: "Bitcoin knowledge bundle",
  },
  startups: {
    slug: "startups",
    version: "v1",
    jobLabel: "Startups demo seed (Vellum)",
  },
  faith: {
    slug: "faith",
    version: "v1",
    jobLabel: "Faith demo seed (Cornerstone)",
  },
  schools: {
    slug: "schools",
    version: "v1",
    jobLabel: "Schools demo seed (Heritage Classical)",
  },
  "small-business": {
    slug: "small-business",
    version: "v1",
    jobLabel: "Small Business demo seed (Pinecrest Realty)",
  },
  healthtech: {
    slug: "healthtech",
    version: "v1",
    jobLabel: "HealthTech demo seed (MutualHealth)",
  },
};

function bundleFlagKey(slug: string) {
  return `seed-bundle:${slug}`;
}

function bundleJobId(slug: string) {
  // Preserve historical job_id for the bitcoin bundle so existing
  // IndexedDB rows don't get orphaned across the rename.
  return slug === "bitcoin" ? "bitcoin-bundle" : `seed-bundle:${slug}`;
}

function bundleRootUrl(slug: string) {
  return `internal://seed-bundle/${slug}`;
}

export interface BundleLoadProgress {
  total_chunks: number;
  done_chunks: number;
  done: boolean;
}

/**
 * Top-level LLM provider. MUST be mounted above the router so that
 * SPA navigations do not unmount it (and therefore do not re-trigger
 * model download). Worker download begins after first paint via a
 * deferred startup so the page itself stays interactive.
 */

interface LLMContextValue {
  status: ModelStatus;
  /** Granular load progress (0..100) for the active stage. -1 if unknown. */
  progress: number;
  loadStageLabel: string;
  errorMessage: string | null;
  modelInfo: ModelInfo;
  /**
   * Run a full RAG turn locally: embed the user message, retrieve top-K
   * chunks from IndexedDB, generate a grounded reply, return the reply
   * with the chunks that were actually used (for the thought trace).
   * Throws if the local model is not ready — callers should check
   * `status === "ready"` first and fall back to cloud otherwise.
   */
  ask: (
    history: ChatTurn[],
    userMessage: string,
    options?: AskOptions,
  ) => Promise<LocalAnswer>;
  /** Embed a single text chunk via the in-browser sentence-transformer. */
  embed: (text: string) => Promise<number[]>;
  /** Run a full ingestion (single page or sitemap) and store chunks locally. */
  ingest: (options: IngestOptions) => Promise<IngestResult>;
  /**
   * Progress for the (optional) Bitcoin knowledge bundle. `null` when the
   * bundle is not present or already installed; an object with counts
   * while it is being indexed for the first time.
   */
  bundleProgress: BundleLoadProgress | null;
  clearCacheAndReload: () => Promise<void>;
}

const LLMContext = createContext<LLMContextValue | null>(null);

export function LLMProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ModelStatus>("idle");
  const [progress, setProgress] = useState<number>(0);
  const [loadStageLabel, setLoadStageLabel] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [bundleProgress, setBundleProgress] =
    useState<BundleLoadProgress | null>(null);

  const workerRef = useRef<Worker | null>(null);
  type Pending = {
    resolve: (v: unknown) => void;
    reject: (e: Error) => void;
  };
  const pendingRef = useRef<Map<string, Pending>>(new Map());

  const callWorker = useCallback(
    <T,>(
      type: "embed" | "generate",
      payload: { text?: string; messages?: ChatTurn[]; maxNewTokens?: number },
    ): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const w = workerRef.current;
        if (!w) return reject(new Error("Worker not initialized"));
        const id = crypto.randomUUID();
        pendingRef.current.set(id, {
          resolve: resolve as (v: unknown) => void,
          reject,
        });
        if (type === "embed") {
          w.postMessage({ type: "embed", id, text: payload.text });
        } else {
          w.postMessage({
            type: "generate",
            id,
            messages: payload.messages,
            maxNewTokens: payload.maxNewTokens,
          });
        }
      });
    },
    [],
  );

  const ensureSeedCorpus = useCallback(async (): Promise<void> => {
    const meta = await getCorpusMeta();
    // Count only the seed-job slice — *not* total documents — so that
    // user-ingested sources and the Bitcoin bundle don't trigger a
    // bogus "cache changed" wipe of everything on every reload.
    const seedCount = await countDocumentsByJob(SEED_JOB_ID);
    if (
      meta &&
      meta.version === SEED_CORPUS_VERSION &&
      meta.embedderName === EMBEDDER_MODEL_ID &&
      seedCount === SEED_CORPUS.length
    ) {
      return;
    }
    // Seed slice is missing or stale. Replace just the seed job;
    // leave user-ingested jobs and the Bitcoin bundle untouched.
    await deleteByJob(SEED_JOB_ID);
    const indexedAt = Date.now();
    for (const chunk of SEED_CORPUS) {
      const vec = await callWorker<number[]>("embed", { text: chunk.text });
      await putChunkWithVector(
        {
          id: chunk.id,
          job_id: SEED_JOB_ID,
          job_root_url: SEED_JOB_ROOT_URL,
          job_label: SEED_JOB_LABEL,
          job_kind: "seed",
          page_url: chunk.page_url,
          page_label: chunk.page_label,
          chunk_index: chunk.chunk_index,
          text: chunk.text,
          bias: chunk.bias ?? "neutral",
          indexed_at: indexedAt,
        },
        vec,
      );
    }
    await setCorpusMeta(
      SEED_CORPUS_VERSION,
      EMBEDDER_MODEL_ID,
      SEED_CORPUS.length,
    );
  }, [callWorker]);

  /**
   * On first run after seed corpus is installed, attempt to load the
   * proprietary Bitcoin knowledge bundle from `/seeds/bitcoin.json`.
   * The bundle is gitignored — the FOSS shell ships without it, so a
   * 404 is normal and silent. When present, it is embedded once and
   * persisted to IndexedDB; subsequent loads see the meta flag and
   * skip the work.
   */
  const ensureBitcoinBundle = useCallback(async (): Promise<void> => {
    const flag = await getMetaFlag(BITCOIN_BUNDLE_FLAG);
    if (flag?.value === BITCOIN_BUNDLE_VERSION) return;
    let bundle: BitcoinBundle | null = null;
    try {
      const res = await fetch(BITCOIN_BUNDLE_URL, { cache: "no-cache" });
      if (!res.ok) {
        // 404 is expected on FOSS deployments without the proprietary
        // bundle. Mark the flag so we don't keep re-checking.
        await setMetaFlag(BITCOIN_BUNDLE_FLAG, "absent");
        return;
      }
      bundle = (await res.json()) as BitcoinBundle;
    } catch {
      await setMetaFlag(BITCOIN_BUNDLE_FLAG, "absent");
      return;
    }

    if (!bundle?.documents?.length) {
      await setMetaFlag(BITCOIN_BUNDLE_FLAG, "absent");
      return;
    }

    const totalChunks = bundle.documents.reduce(
      (n, d) => n + d.chunks.length,
      0,
    );
    setBundleProgress({ total_chunks: totalChunks, done_chunks: 0, done: false });
    let done = 0;
    const installedAt = Date.now();
    for (const doc of bundle.documents) {
      const bias = doc.bias ?? "neutral";
      for (const ch of doc.chunks) {
        const vec = await callWorker<number[]>("embed", { text: ch.text });
        await putChunkWithVector(
          {
            id: `${BITCOIN_JOB_ID}::${doc.source_url}#${ch.chunk_index}`,
            job_id: BITCOIN_JOB_ID,
            job_root_url: BITCOIN_JOB_ROOT_URL,
            job_label: BITCOIN_JOB_LABEL,
            job_kind: "bitcoin-bundle",
            page_url: doc.source_url,
            page_label: doc.source_label,
            chunk_index: ch.chunk_index,
            text: ch.text,
            bias,
            indexed_at: installedAt,
          },
          vec,
        );
        done += 1;
        setBundleProgress({
          total_chunks: totalChunks,
          done_chunks: done,
          done: false,
        });
      }
    }
    await setMetaFlag(BITCOIN_BUNDLE_FLAG, BITCOIN_BUNDLE_VERSION);
    setBundleProgress({ total_chunks: totalChunks, done_chunks: done, done: true });
  }, [callWorker]);

  const startWorker = useCallback(() => {
    // Browsers without WebGPU permanently use cloud fallback.
    if (typeof navigator === "undefined" || !("gpu" in navigator)) {
      setStatus("unsupported");
      return;
    }
    if (workerRef.current) return; // already started

    try {
      // The `new URL(..., import.meta.url)` form is what tells Vite to
      // emit `llmWorker.ts` as a separate worker bundle (not as a main
      // thread import). This is the only reference to llmWorker.ts
      // anywhere in the main-thread code; constants live in ./config.
      const w = new Worker(
        new URL("./llmWorker.ts", import.meta.url),
        { type: "module" },
      );
      workerRef.current = w;

      w.onmessage = (e: MessageEvent<WorkerOutbound>) => {
        const msg = e.data;
        if (msg.type === "progress") {
          setStatus(
            msg.stage === "embedder" ? "loading-embedder" : "loading-llm",
          );
          setProgress(typeof msg.progress === "number" ? msg.progress : -1);
          setLoadStageLabel(
            msg.stage === "embedder"
              ? `Embedder · ${msg.status ?? "downloading"}`
              : `LLM · ${msg.status ?? "downloading"}`,
          );
        } else if (msg.type === "ready") {
          if (msg.stage === "embedder") {
            // Build the seed-corpus vector index in the background while
            // the LLM is still downloading. Embedding 20 chunks is fast.
            ensureSeedCorpus()
              .then(() => ensureBitcoinBundle())
              .catch((err) => {
                console.error("Seed corpus indexing failed:", err);
              });
          } else if (msg.stage === "all") {
            setStatus("ready");
            setProgress(100);
            setLoadStageLabel("");
            setLoadedAt(new Date());
          }
        } else if (msg.type === "error") {
          if (msg.id && pendingRef.current.has(msg.id)) {
            pendingRef.current.get(msg.id)!.reject(new Error(msg.message));
            pendingRef.current.delete(msg.id);
          } else {
            setStatus("error");
            setErrorMessage(msg.message);
          }
        } else if (msg.type === "embedResult") {
          const p = pendingRef.current.get(msg.id);
          if (p) {
            p.resolve((msg as EmbedResult).vector);
            pendingRef.current.delete(msg.id);
          }
        } else if (msg.type === "generateResult") {
          const p = pendingRef.current.get(msg.id);
          if (p) {
            p.resolve((msg as GenerateResult).text);
            pendingRef.current.delete(msg.id);
          }
        }
      };
      w.onerror = (e) => {
        setStatus("error");
        setErrorMessage(e.message || "Worker crashed");
      };
      w.postMessage({ type: "init" });
      setStatus("loading-embedder");
    } catch (err) {
      setStatus("error");
      setErrorMessage((err as Error).message);
    }
  }, [ensureSeedCorpus, ensureBitcoinBundle]);

  // Kick off the worker after first paint so the page stays interactive
  // through the model download.
  useEffect(() => {
    if (typeof window === "undefined") return;
    type IdleCallback = (cb: () => void, opts?: { timeout: number }) => number;
    type IdleCancel = (handle: number) => void;
    const w = window as unknown as {
      requestIdleCallback?: IdleCallback;
      cancelIdleCallback?: IdleCancel;
    };
    const handle = w.requestIdleCallback
      ? w.requestIdleCallback(() => startWorker(), { timeout: 1500 })
      : window.setTimeout(() => startWorker(), 250);
    return () => {
      if (w.requestIdleCallback && w.cancelIdleCallback) {
        w.cancelIdleCallback(handle);
      } else {
        window.clearTimeout(handle);
      }
    };
  }, [startWorker]);

  const ask = useCallback<LLMContextValue["ask"]>(
    async (history, userMessage, options) => {
      if (status !== "ready") {
        throw new Error("Local model not ready");
      }
      const queryVec = await callWorker<number[]>("embed", {
        text: userMessage,
      });
      // Pipe-aware retrieval: when the caller supplies a bias filter,
      // restrict scoring to chunks tagged with one of those biases.
      // Untagged ('neutral') chunks are always eligible — they are the
      // common ground that holds across forks.
      const retrieved = await topK(queryVec, 5, {
        biasFilter: options?.biasFilter,
      });
      const context = formatRetrievedForPrompt(retrieved);

      const baseSystemPrompt =
        options?.systemPrompt ??
        [
          "You are Greater, a support assistant for Blockstream products and",
          "Bitcoin self-custody. Answer ONLY from the provided knowledge",
          "snippets. If the snippets do not contain the answer, say so",
          "plainly and suggest opening a support ticket. Never ask for the",
          "user's seed phrase, PIN, or password — refuse if requested.",
        ].join("\n");

      const systemPrompt = [
        baseSystemPrompt,
        "",
        "Citation rules:",
        "- After every factual claim, cite the supporting snippet inline as",
        "  [N] where N is the snippet number you used (e.g. [1] or [2,3]).",
        "- Do not invent snippet numbers; only cite snippets shown below.",
        "- If no snippet supports a claim, do not make the claim.",
        "",
        "Knowledge snippets:",
        context,
      ].join("\n");

      const messages: ChatTurn[] = [
        { role: "system", content: systemPrompt },
        ...history.slice(-6),
        { role: "user", content: userMessage },
      ];

      const text = await callWorker<string>("generate", {
        messages,
        maxNewTokens: 384,
      });

      const trace: ThoughtTrace = {
        chunks: retrieved,
        reasoning: summarizeRetrieval(retrieved),
      };
      return { text, source: "local", thoughtTrace: trace };
    },
    [status, callWorker],
  );

  const clearCacheAndReload = useCallback(async () => {
    await clearAll();
    // Best-effort: clear the OPFS-backed Transformers.js cache too.
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.includes("transformers") || k.includes("hf"))
          .map((k) => caches.delete(k)),
      );
    }
    // We deliberately do not touch OPFS here — Transformers.js v3 owns
    // its own cache in OPFS and the safe way to invalidate it is to let
    // the library re-resolve on next load with a cleared Cache Storage.
    window.location.reload();
  }, []);

  const modelInfo: ModelInfo = useMemo(
    () => ({
      llmName: LLM_MODEL_ID,
      llmQuantization: LLM_QUANTIZATION_LABEL,
      embedderName: EMBEDDER_MODEL_ID,
      approxSizeMb: APPROX_SIZE_MB,
      loadedAt,
    }),
    [loadedAt],
  );

  const embed = useCallback(
    (text: string) => callWorker<number[]>("embed", { text }),
    [callWorker],
  );

  const ingest = useCallback<LLMContextValue["ingest"]>(
    async (options) => {
      if (status !== "ready") {
        // Surface a clear error to the orchestrator's progress callback.
        options.onProgress?.({
          total_pages: 0,
          done_pages: 0,
          done_chunks: 0,
          stage: "error",
          error: "Local model not ready — wait for download to finish.",
        } satisfies IngestProgress);
        throw new Error("Local model not ready");
      }
      return ingestUrl(embed, options);
    },
    [status, embed],
  );

  const value: LLMContextValue = {
    status,
    progress,
    loadStageLabel,
    errorMessage,
    modelInfo,
    ask,
    embed,
    ingest,
    bundleProgress,
    clearCacheAndReload,
  };

  return <LLMContext.Provider value={value}>{children}</LLMContext.Provider>;
}

export function useLLM(): LLMContextValue {
  const ctx = useContext(LLMContext);
  if (!ctx) throw new Error("useLLM must be used inside <LLMProvider>");
  return ctx;
}

function formatRetrievedForPrompt(chunks: RetrievedChunk[]): string {
  return chunks
    .map(
      (c, i) =>
        `[${i + 1}] ${c.page_label} (${c.page_url})\n${c.text}`,
    )
    .join("\n\n");
}

function summarizeRetrieval(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "No relevant chunks were found in the corpus.";
  const top = chunks[0];
  return `Retrieved ${chunks.length} chunks; top match was "${top.page_label}" (similarity ${top.score.toFixed(3)}).`;
}
