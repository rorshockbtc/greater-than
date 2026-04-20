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
  OpenClawConfig,
  OpenClawHealth,
  RetrievedChunk,
  ThoughtTrace,
  WorkerOutbound,
} from "./types";
import {
  ingestCrawl,
  ingestUrl,
  type CrawlOptions,
  type IngestOptions,
  type IngestResult,
} from "./ingest";
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
  cosine,
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
   * Run a streaming site crawl rooted at `options.root`. Embeds and
   * stores each fetched page locally as it arrives. Supports cancel
   * via `options.signal` from an `AbortController`.
   */
  crawl: (options: CrawlOptions) => Promise<IngestResult>;
  /**
   * Progress for whichever optional seed bundle is currently being
   * indexed. `null` when no bundle is loading. Multiple bundle requests
   * are processed serially; `bundleProgress.slug` identifies which one.
   */
  bundleProgress: (BundleLoadProgress & { slug: string }) | null;
  /**
   * Request that an optional seed bundle (`bitcoin`, `startups`,
   * `faith`, `schools`, `small-business`, `healthtech`, …) be loaded
   * into IndexedDB. Safe to call before the embedder is ready —
   * requests are queued and flushed on `embedder` `ready`. Idempotent:
   * already-installed bundles short-circuit on the persisted meta flag.
   */
  requestSeedBundle: (slug: string) => void;
  /**
   * Request that the curated Q&A cache for a persona be loaded.
   * Fetches `<base>/qa-bank/<slug>.json`, embeds each question
   * via the in-browser sentence-transformer, and stores the
   * vectors in memory. A 404 marks the bank as `absent` so the
   * FOSS fork doesn't keep re-checking. Idempotent.
   */
  requestQaBank: (slug: string) => void;
  /**
   * Per-session quota for cloud-fallback chat calls. When `remaining`
   * hits 0 the chat widget keeps the conversation going on the
   * in-browser model and surfaces a one-time inline notice. Persisted
   * across page refreshes (but not new tabs) via `sessionStorage`.
   */
  cloudBudget: { used: number; remaining: number; total: number };
  /**
   * Atomically check-and-decrement the cloud budget. Returns `true`
   * when a cloud call is permitted (and reserves one slot); returns
   * `false` when the cap has already been reached. Always call this
   * exactly once per intended cloud request.
   */
  consumeCloudCall: () => boolean;
  /**
   * Counterpart to `consumeCloudCall`: give back a slot when the
   * cloud request itself failed and the visitor never received a
   * paid answer. No-op if the counter is already at zero.
   */
  refundCloudCall: () => void;
  /**
   * BYO local LLM ("OpenClaw mode"). When `enabled` is true and the
   * health check has passed, every `ask()` call is routed to the
   * configured OpenAI-compatible endpoint instead of the in-browser
   * model or the cloud fallback. Persisted to `localStorage`.
   */
  openClawConfig: OpenClawConfig;
  openClawHealth: OpenClawHealth;
  /** True iff the BYO endpoint is currently the active inference path. */
  openClawActive: boolean;
  /** Merge a partial config and persist; resets health to idle. */
  setOpenClawConfig: (patch: Partial<OpenClawConfig>) => void;
  /**
   * Ping the configured `${baseUrl}/models` to verify the endpoint is
   * reachable and returns a sane shape. Updates `openClawHealth` and
   * also returns the result so callers can react synchronously.
   */
  testOpenClawConnection: (override?: Partial<OpenClawConfig>) => Promise<OpenClawHealth>;
  clearCacheAndReload: () => Promise<void>;
}

const OPENCLAW_STORAGE_KEY = "greater:openclaw-config";

const DEFAULT_OPENCLAW_CONFIG: OpenClawConfig = {
  enabled: false,
  baseUrl: "http://localhost:11434/v1",
  model: "llama3.2:1b",
  apiKey: "",
};

function loadOpenClawConfig(): OpenClawConfig {
  if (typeof window === "undefined") return DEFAULT_OPENCLAW_CONFIG;
  try {
    const raw = window.localStorage.getItem(OPENCLAW_STORAGE_KEY);
    if (!raw) return DEFAULT_OPENCLAW_CONFIG;
    const parsed = JSON.parse(raw) as Partial<OpenClawConfig>;
    return {
      ...DEFAULT_OPENCLAW_CONFIG,
      ...parsed,
      // Coerce booleans/strings so a tampered storage value can't
      // crash the provider during render.
      enabled: Boolean(parsed.enabled),
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : DEFAULT_OPENCLAW_CONFIG.baseUrl,
      model: typeof parsed.model === "string" ? parsed.model : DEFAULT_OPENCLAW_CONFIG.model,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
    };
  } catch {
    return DEFAULT_OPENCLAW_CONFIG;
  }
}

function persistOpenClawConfig(cfg: OpenClawConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OPENCLAW_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // localStorage can throw in private mode / quota-exceeded; the
    // config is best-effort persistence, not load-bearing.
  }
}

/**
 * Normalize the BYO base URL:
 *  - trim whitespace and trailing slashes
 *  - strip a trailing `/chat/completions` if the user pasted the full
 *    endpoint (a common mistake when copying from API docs)
 *
 * We deliberately do NOT auto-append `/v1`: some servers (notably
 * Ollama via its native API on `:11434/api`) expose the OpenAI-compat
 * surface at a non-`/v1` prefix, and silently appending would break
 * those configurations. The UI hint and quickstart already steer
 * users to the `/v1` form for the common cases.
 */
function normalizeBaseUrl(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/chat\/completions$/, "");
}

/**
 * Hard cap on cloud-fallback chat calls per visitor session.
 *
 * The cloud endpoint hits a paid third-party LLM on the maintainer's
 * dime, so unbounded use by passers-by would make the demo expensive
 * to leave online. Three calls is enough for a visitor to see the
 * cloud path work (during the local-model warmup) and then transition
 * to the in-browser model for the rest of the session. Resets only
 * when the browser tab is closed.
 */
const CLOUD_CALL_BUDGET = 3;
const CLOUD_CALLS_STORAGE_KEY = "greater:cloud-calls-used";

const LLMContext = createContext<LLMContextValue | null>(null);

export function LLMProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ModelStatus>("idle");
  const [progress, setProgress] = useState<number>(0);
  const [loadStageLabel, setLoadStageLabel] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [bundleProgress, setBundleProgress] = useState<
    (BundleLoadProgress & { slug: string }) | null
  >(null);
  /** Slugs requested before the embedder was ready, queued for flush. */
  const queuedBundleSlugsRef = useRef<Set<string>>(new Set());
  /** Slugs already installed (or marked absent) this session, to skip rework. */
  const installedBundleSlugsRef = useRef<Set<string>>(new Set());
  /** True once the embedder has signaled ready at least once. */
  const embedderReadyRef = useRef<boolean>(false);
  /** Serializes bundle loads so two requests can't interleave callWorker calls. */
  const bundleLoadChainRef = useRef<Promise<void>>(Promise.resolve());

  /**
   * Per-session cloud-call counter. Lazy-initialised from
   * `sessionStorage` so a page refresh doesn't reset the budget mid-
   * conversation. The setter is also responsible for writing the
   * value back to `sessionStorage`; never bypass it.
   */
  const [cloudCallsUsed, setCloudCallsUsed] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    try {
      const raw = window.sessionStorage.getItem(CLOUD_CALLS_STORAGE_KEY);
      const n = raw ? parseInt(raw, 10) : 0;
      if (!Number.isFinite(n) || n < 0) return 0;
      return Math.min(n, CLOUD_CALL_BUDGET);
    } catch {
      return 0;
    }
  });

  /**
   * Mirror of `cloudCallsUsed` kept in a ref so `consumeCloudCall`
   * stays referentially stable. The state copy drives renders; the
   * ref drives the atomic check-and-decrement logic so two concurrent
   * sends from the chat widget can't both squeak past the cap.
   */
  const cloudCallsUsedRef = useRef<number>(cloudCallsUsed);

  const consumeCloudCall = useCallback((): boolean => {
    if (cloudCallsUsedRef.current >= CLOUD_CALL_BUDGET) return false;
    const next = cloudCallsUsedRef.current + 1;
    cloudCallsUsedRef.current = next;
    setCloudCallsUsed(next);
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(
          CLOUD_CALLS_STORAGE_KEY,
          String(next),
        );
      } catch {
        // sessionStorage can throw in private mode / quota-exceeded —
        // the cap is best-effort, so swallow rather than break chat.
      }
    }
    return true;
  }, []);

  /**
   * Give a slot back to the cloud budget. Intended for the case where
   * a `consumeCloudCall()` was followed by a *failed* cloud request
   * (network drop, 5xx, abort) — the visitor never received a paid
   * answer, so the slot shouldn't be permanently spent. Bottom-bounded
   * at 0 so we never grow the effective budget past the cap.
   */
  const refundCloudCall = useCallback((): void => {
    if (cloudCallsUsedRef.current <= 0) return;
    const next = cloudCallsUsedRef.current - 1;
    cloudCallsUsedRef.current = next;
    setCloudCallsUsed(next);
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(
          CLOUD_CALLS_STORAGE_KEY,
          String(next),
        );
      } catch {
        // best-effort; see consumeCloudCall.
      }
    }
  }, []);

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
   * On demand, attempt to load an optional proprietary seed bundle
   * from `<base>/seeds/<slug>.json`. Each bundle is gitignored — the
   * FOSS shell ships without any, so a 404 is normal and silent. When
   * present, the bundle is embedded once and persisted to IndexedDB;
   * subsequent loads see the meta flag and skip the work. The
   * `bitcoin` slug uses the historical job_id `bitcoin-bundle` for
   * IndexedDB compatibility; new slugs use `seed-bundle:<slug>`.
   */
  const ensureSeedBundle = useCallback(
    async (slug: string): Promise<void> => {
      const cfg = SEED_BUNDLES[slug];
      if (!cfg) {
        console.warn(`[LLMProvider] Unknown seed bundle slug: ${slug}`);
        return;
      }
      if (installedBundleSlugsRef.current.has(slug)) return;
      const flagKey = bundleFlagKey(slug);
      const flag = await getMetaFlag(flagKey);
      if (flag?.value === cfg.version || flag?.value === "absent") {
        installedBundleSlugsRef.current.add(slug);
        return;
      }

      const url = `${import.meta.env.BASE_URL}seeds/${slug}.json`;
      let bundle: SeedBundle | null = null;
      try {
        const res = await fetch(url, { cache: "no-cache" });
        if (!res.ok) {
          await setMetaFlag(flagKey, "absent");
          installedBundleSlugsRef.current.add(slug);
          return;
        }
        bundle = (await res.json()) as SeedBundle;
      } catch {
        await setMetaFlag(flagKey, "absent");
        installedBundleSlugsRef.current.add(slug);
        return;
      }

      if (!bundle?.documents?.length) {
        await setMetaFlag(flagKey, "absent");
        installedBundleSlugsRef.current.add(slug);
        return;
      }

      const jobId = bundleJobId(slug);
      const jobRoot = bundleRootUrl(slug);
      const jobKind = slug === "bitcoin" ? "bitcoin-bundle" : "seed-bundle";
      const totalChunks = bundle.documents.reduce(
        (n, d) => n + d.chunks.length,
        0,
      );
      setBundleProgress({
        slug,
        total_chunks: totalChunks,
        done_chunks: 0,
        done: false,
      });
      let done = 0;
      const installedAt = Date.now();
      for (const doc of bundle.documents) {
        const bias = doc.bias ?? "neutral";
        for (const ch of doc.chunks) {
          const vec = await callWorker<number[]>("embed", { text: ch.text });
          await putChunkWithVector(
            {
              id: `${jobId}::${doc.source_url}#${ch.chunk_index}`,
              job_id: jobId,
              job_root_url: jobRoot,
              job_label: cfg.jobLabel,
              job_kind: jobKind,
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
            slug,
            total_chunks: totalChunks,
            done_chunks: done,
            done: false,
          });
        }
      }
      await setMetaFlag(flagKey, cfg.version);
      installedBundleSlugsRef.current.add(slug);
      setBundleProgress({
        slug,
        total_chunks: totalChunks,
        done_chunks: done,
        done: true,
      });
    },
    [callWorker],
  );

  /**
   * Public API for routes: queue a bundle slug. If the embedder is
   * already ready, kick off the install immediately (serialized via
   * `bundleLoadChainRef`); otherwise stash it for the embedder-ready
   * handler to flush.
   */
  const requestSeedBundle = useCallback(
    (slug: string) => {
      if (installedBundleSlugsRef.current.has(slug)) return;
      if (!embedderReadyRef.current) {
        queuedBundleSlugsRef.current.add(slug);
        return;
      }
      bundleLoadChainRef.current = bundleLoadChainRef.current
        .then(() => ensureSeedBundle(slug))
        .catch((err) =>
          console.error(`[LLMProvider] Bundle ${slug} failed:`, err),
        );
    },
    [ensureSeedBundle],
  );

  const startWorker = useCallback(() => {
    // Browsers without WebGPU permanently use cloud fallback.
    if (typeof navigator === "undefined" || !("gpu" in navigator)) {
      setStatus("unsupported");
      return;
    }
    // iOS / iPadOS Safari OOM-crashes the tab when the multi-hundred-MB
    // WebGPU model loads (the WebKit "A problem repeatedly occurred"
    // signature), even on iPadOS where WebGPU is partially available.
    // Production users were getting kicked back to the homepage
    // mid-chat. Force cloud-only on those platforms — the cloud path
    // still answers normally without crashing the browser.
    //
    // Detection: Safari user agent + (iOS OR iPadOS pretending to be
    // macOS — modern iPads report "Macintosh" with `maxTouchPoints>1`).
    const ua = navigator.userAgent;
    const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isIPadOSPretendingMac =
      /Macintosh/.test(ua) &&
      typeof navigator.maxTouchPoints === "number" &&
      navigator.maxTouchPoints > 1;
    if (isSafari && (isIOS || isIPadOSPretendingMac)) {
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
            embedderReadyRef.current = true;
            // Build the seed-corpus vector index in the background while
            // the LLM is still downloading. Embedding 20 chunks is fast.
            // Then flush any seed bundles requested before readiness.
            bundleLoadChainRef.current = bundleLoadChainRef.current
              .then(() => ensureSeedCorpus())
              .then(async () => {
                const queued = Array.from(queuedBundleSlugsRef.current);
                queuedBundleSlugsRef.current.clear();
                for (const slug of queued) {
                  await ensureSeedBundle(slug);
                }
              })
              .catch((err) => {
                console.error("Seed indexing failed:", err);
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
  }, [ensureSeedCorpus, ensureSeedBundle]);

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

  /* -------------------------------------------------------------- */
  /*  OpenClaw mode (BYO OpenAI-compatible endpoint)                */
  /* -------------------------------------------------------------- */

  const [openClawConfig, setOpenClawConfigState] = useState<OpenClawConfig>(
    () => loadOpenClawConfig(),
  );
  const [openClawHealth, setOpenClawHealth] = useState<OpenClawHealth>({
    state: "idle",
  });

  // Keep a ref so `ask()` can read the latest config without being
  // re-created on every keystroke in the settings panel.
  const openClawConfigRef = useRef<OpenClawConfig>(openClawConfig);
  const openClawHealthRef = useRef<OpenClawHealth>(openClawHealth);
  useEffect(() => {
    openClawConfigRef.current = openClawConfig;
  }, [openClawConfig]);
  useEffect(() => {
    openClawHealthRef.current = openClawHealth;
  }, [openClawHealth]);

  const setOpenClawConfig = useCallback((patch: Partial<OpenClawConfig>) => {
    setOpenClawConfigState((prev) => {
      const next: OpenClawConfig = { ...prev, ...patch };
      persistOpenClawConfig(next);
      // Only the connection-relevant fields invalidate health. Toggling
      // `enabled` on its own should NOT force a re-test — a user who
      // just successfully tested and is now flipping the master switch
      // expects the active state to engage immediately. (Note: the
      // current React state may not reflect this `prev` snapshot, but
      // the comparison against `next` vs `prev` is the right basis for
      // the invalidation decision.)
      const endpointChanged =
        next.baseUrl !== prev.baseUrl ||
        next.model !== prev.model ||
        next.apiKey !== prev.apiKey;
      if (endpointChanged) {
        setOpenClawHealth({ state: "idle" });
      }
      return next;
    });
  }, []);

  const testOpenClawConnection = useCallback(async (
    override?: Partial<OpenClawConfig>,
  ): Promise<OpenClawHealth> => {
    // Merge any caller-supplied overrides on top of the persisted
    // config so the panel can test "what the user just typed" without
    // racing the React effect that syncs the ref. This was the source
    // of a real bug where dirty edits were tested against stale values.
    const cfg: OpenClawConfig = { ...openClawConfigRef.current, ...override };
    setOpenClawHealth({ state: "testing" });
    const baseUrl = normalizeBaseUrl(cfg.baseUrl);
    if (!baseUrl) {
      const result: OpenClawHealth = {
        state: "error",
        message: "Base URL is empty.",
        testedAt: Date.now(),
      };
      setOpenClawHealth(result);
      return result;
    }
    try {
      const headers: Record<string, string> = { accept: "application/json" };
      if (cfg.apiKey.trim()) {
        headers.authorization = `Bearer ${cfg.apiKey.trim()}`;
      }
      const res = await fetch(`${baseUrl}/models`, { headers });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const result: OpenClawHealth = {
          state: "error",
          message: `${baseUrl}/models returned HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
          testedAt: Date.now(),
        };
        setOpenClawHealth(result);
        return result;
      }
      const data = (await res.json().catch(() => null)) as
        | { data?: Array<{ id?: string }> }
        | null;
      const models = Array.isArray(data?.data)
        ? data!.data
            .map((m) => (typeof m.id === "string" ? m.id : null))
            .filter((id): id is string => !!id)
        : [];
      const result: OpenClawHealth = {
        state: "ok",
        models,
        testedAt: Date.now(),
      };
      setOpenClawHealth(result);
      return result;
    } catch (err) {
      const result: OpenClawHealth = {
        state: "error",
        message:
          (err as Error)?.message ||
          "Network error. Is your local server running and CORS-enabled?",
        testedAt: Date.now(),
      };
      setOpenClawHealth(result);
      return result;
    }
  }, []);

  const openClawActive =
    openClawConfig.enabled && openClawHealth.state === "ok";

  /**
   * Forward an ask() turn to the BYO OpenAI-compatible endpoint. RAG
   * retrieval still runs when the embedder is ready, so the BYO model
   * gets the same grounding context as the in-browser model. When the
   * embedder isn't ready yet (e.g. the visitor enabled OpenClaw before
   * the page finished warming up), we just forward the messages plain.
   */
  const askViaOpenClaw = useCallback(
    async (
      history: ChatTurn[],
      userMessage: string,
      options: AskOptions | undefined,
    ): Promise<LocalAnswer> => {
      const cfg = openClawConfigRef.current;
      const baseUrl = normalizeBaseUrl(cfg.baseUrl);
      if (!baseUrl || !cfg.model.trim()) {
        throw new Error(
          "OpenClaw is enabled but the base URL or model name is missing.",
        );
      }

      // Only run retrieval when the embedder is up. status === 'ready'
      // means both stages done; 'loading-llm' means embedder ready and
      // LLM still downloading — in either case retrieval is available.
      let retrieved: RetrievedChunk[] = [];
      if (status === "ready" || status === "loading-llm") {
        try {
          const queryVec = await callWorker<number[]>("embed", {
            text: userMessage,
          });
          retrieved = await topK(queryVec, 5, {
            biasFilter: options?.biasFilter,
          });
        } catch {
          // Retrieval failure should NOT block the OpenClaw call —
          // the BYO model is still useful without grounding.
          retrieved = [];
        }
      }

      const baseSystemPrompt =
        options?.systemPrompt ??
        [
          "You are Greater, a support assistant for Blockstream products and",
          "Bitcoin self-custody. Answer ONLY from the provided knowledge",
          "snippets when they are present; otherwise answer from your",
          "general knowledge but say so. Never ask for the user's seed",
          "phrase, PIN, or password — refuse if requested.",
        ].join("\n");

      const systemPrompt =
        retrieved.length > 0
          ? [
              baseSystemPrompt,
              "",
              "Citation rules:",
              "- After every factual claim, cite the supporting snippet inline as",
              "  [N] where N is the snippet number you used.",
              "- Do not invent snippet numbers; only cite snippets shown below.",
              "",
              "Knowledge snippets:",
              formatRetrievedForPrompt(retrieved),
            ].join("\n")
          : baseSystemPrompt;

      const messages: ChatTurn[] = [
        { role: "system", content: systemPrompt },
        ...history.slice(-6),
        { role: "user", content: userMessage },
      ];

      const headers: Record<string, string> = {
        "content-type": "application/json",
        accept: "application/json",
      };
      if (cfg.apiKey.trim()) {
        headers.authorization = `Bearer ${cfg.apiKey.trim()}`;
      }

      let res: Response;
      try {
        res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: cfg.model.trim(),
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            // Keep parity with the in-browser model's generation cap.
            // Some BYO servers (Ollama) accept this; OpenAI-compat
            // servers ignore unknown fields rather than 400.
            max_tokens: 384,
            temperature: 0.4,
            stream: false,
          }),
        });
      } catch (err) {
        throw new Error(
          `OpenClaw fetch failed: ${(err as Error).message}. ` +
            `Verify that your local server is reachable from the browser ` +
            `(CORS may need to be enabled).`,
        );
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `OpenClaw endpoint returned HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
        );
      }
      const data = (await res.json().catch(() => null)) as {
        choices?: Array<{ message?: { content?: string } }>;
      } | null;
      const text =
        data?.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) {
        throw new Error(
          "OpenClaw endpoint returned an empty response. " +
            "Check that the configured model name matches one your server has loaded.",
        );
      }

      const trace: ThoughtTrace = {
        chunks: retrieved,
        reasoning:
          retrieved.length > 0
            ? summarizeRetrieval(retrieved)
            : "OpenClaw mode: BYO model answered without retrieved chunks (embedder not ready or no matches).",
      };
      return { text, source: "openclaw", thoughtTrace: trace };
    },
    [status, callWorker],
  );

  /* -------------------------------------------------------------- */
  /*  Curated Q&A cache (semantic short-circuit)                    */
  /* -------------------------------------------------------------- */

  /**
   * In-memory store of embedded curated Q&A banks, keyed by persona
   * slug. Loaded on demand by `requestQaBank` and consulted by `ask`
   * before doing any model inference. The bank ships as a static
   * JSON file at `<base>/qa-bank/<slug>.json`; a 404 (the FOSS-fork
   * shape) marks the slug `absent` so we don't keep re-checking.
   */
  type QaItem = { q: string; a: string; vec: number[] };
  const qaBankRef = useRef<
    Map<string, { items: QaItem[]; status: "loading" | "ready" | "absent" }>
  >(new Map());
  const QA_CACHE_THRESHOLD = 0.78;

  const lookupCachedAnswer = useCallback(
    async (
      text: string,
      slug: string,
    ): Promise<{ answer: string; score: number } | null> => {
      const entry = qaBankRef.current.get(slug);
      if (!entry || entry.status !== "ready" || entry.items.length === 0) {
        return null;
      }
      if (!embedderReadyRef.current) return null;
      const queryVec = await callWorker<number[]>("embed", { text });
      let best: { item: QaItem; score: number } | null = null;
      for (const item of entry.items) {
        const score = cosine(queryVec, item.vec);
        if (!best || score > best.score) best = { item, score };
      }
      if (!best || best.score < QA_CACHE_THRESHOLD) return null;
      return { answer: best.item.a, score: best.score };
    },
    [callWorker],
  );

  // Stable ref so `ask` (declared below) can call the latest version
  // without re-creating itself on every embedder-ready transition.
  const lookupCachedAnswerRef = useRef(lookupCachedAnswer);
  useEffect(() => {
    lookupCachedAnswerRef.current = lookupCachedAnswer;
  }, [lookupCachedAnswer]);

  const requestQaBank = useCallback(
    (slug: string) => {
      const existing = qaBankRef.current.get(slug);
      if (existing) return; // already loading, ready, or absent
      qaBankRef.current.set(slug, { items: [], status: "loading" });

      const load = async () => {
        const url = `${import.meta.env.BASE_URL}qa-bank/${slug}.json`;
        let bank: { items?: { q: string; a: string }[] } | null = null;
        try {
          const res = await fetch(url, { cache: "no-cache" });
          if (!res.ok) {
            qaBankRef.current.set(slug, { items: [], status: "absent" });
            return;
          }
          bank = (await res.json()) as { items?: { q: string; a: string }[] };
        } catch {
          qaBankRef.current.set(slug, { items: [], status: "absent" });
          return;
        }
        if (!bank?.items?.length) {
          qaBankRef.current.set(slug, { items: [], status: "absent" });
          return;
        }
        // Wait for the embedder. Polling is acceptable here — the
        // cache is a nice-to-have and we don't want to gate it on
        // the embedder-ready callback machinery.
        const start = Date.now();
        while (!embedderReadyRef.current && Date.now() - start < 60_000) {
          await new Promise((r) => setTimeout(r, 250));
        }
        if (!embedderReadyRef.current) {
          qaBankRef.current.set(slug, { items: [], status: "absent" });
          return;
        }
        const items: QaItem[] = [];
        for (const it of bank.items) {
          try {
            const vec = await callWorker<number[]>("embed", { text: it.q });
            items.push({ q: it.q, a: it.a, vec });
          } catch {
            // Skip individual failures rather than aborting the bank.
          }
        }
        qaBankRef.current.set(slug, { items, status: "ready" });
      };
      void load();
    },
    [callWorker],
  );

  const ask = useCallback<LLMContextValue["ask"]>(
    async (history, userMessage, options) => {
      // OpenClaw takes precedence over both the in-browser model and
      // the cloud fallback when the user has opted in and the health
      // check passed. This is the whole point of "Bring Your Own LLM".
      if (
        openClawConfigRef.current.enabled &&
        openClawHealthRef.current.state === "ok"
      ) {
        return askViaOpenClaw(history, userMessage, options);
      }
      // Curated Q&A cache short-circuit. When the visitor's question
      // semantically matches an entry in the persona's curated Q&A
      // bank above the configured threshold, return that answer
      // verbatim instead of doing model inference. This is BOTH the
      // demo-quality lever (every cached answer is hand-curated, no
      // hallucination) AND the cost lever (zero model tokens spent).
      // Skipped silently when no slug, no bank, or no embedder.
      if (options?.personaSlug) {
        try {
          const hit = await lookupCachedAnswerRef.current?.(
            userMessage,
            options.personaSlug,
          );
          if (hit) {
            return {
              text: hit.answer,
              source: "qa-cache",
              thoughtTrace: {
                chunks: [],
                reasoning: `Matched curated Q&A bank for "${options.personaSlug}" (cosine ${hit.score.toFixed(3)}).`,
              },
            };
          }
        } catch (err) {
          // Cache lookup failures must NEVER break the chat — fall
          // through to model inference.
          console.warn("[LLMProvider] qa-cache lookup failed:", err);
        }
      }
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
    [status, callWorker, askViaOpenClaw],
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

  const crawl = useCallback(
    async (options: CrawlOptions): Promise<IngestResult> => {
      // Mirrors the `ingest` guard — embedding requires the local
      // sentence-transformer to be ready, otherwise every fetched
      // page would error and burn the per-IP daily page cap.
      if (status !== "ready") {
        options.onProgress?.({
          total_pages: 0,
          done_pages: 0,
          done_chunks: 0,
          stage: "error",
          error: "Local model not ready — wait for download to finish.",
        } satisfies IngestProgress);
        throw new Error("Local model not ready");
      }
      return ingestCrawl(embed, options);
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
    crawl,
    bundleProgress,
    requestSeedBundle,
    requestQaBank,
    cloudBudget: {
      used: cloudCallsUsed,
      remaining: Math.max(0, CLOUD_CALL_BUDGET - cloudCallsUsed),
      total: CLOUD_CALL_BUDGET,
    },
    consumeCloudCall,
    refundCloudCall,
    openClawConfig,
    openClawHealth,
    openClawActive,
    setOpenClawConfig,
    testOpenClawConnection,
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
