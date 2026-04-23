/// <reference lib="webworker" />

/**
 * In-browser LLM + embedder worker for Greater.
 *
 * - Embedder: onnx-community/bge-small-en-v1.5 (small, fast, ~30MB).
 * - LLM:     SmolLM2-135M-Instruct by default (~90MB, q4 on WebGPU).
 *            The main thread picks the model id at init time so we
 *            can ship a tiny conversational default and opt into a
 *            larger model on demand without a second worker.
 *
 * The worker is intentionally stateless about the corpus: the main
 * thread owns IndexedDB. The worker just embeds and generates.
 */

import {
  pipeline,
  env,
  type FeatureExtractionPipeline,
  type TextGenerationPipeline,
  type ProgressInfo,
  type Tensor,
} from "@huggingface/transformers";
import type { WorkerInbound, WorkerOutbound, ChatTurn } from "./types";
import { EMBEDDER_MODEL_ID } from "./config";

// Don't try to look up models on the local filesystem; always use the
// HuggingFace hub (which is browser-cached via OPFS by Transformers.js).
env.allowLocalModels = false;

let embedder: FeatureExtractionPipeline | null = null;
let llm: TextGenerationPipeline | null = null;
let activeLlmModelId: string | null = null;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function send(msg: WorkerOutbound) {
  ctx.postMessage(msg);
}

function readProgress(p: ProgressInfo): {
  file?: string;
  progress: number;
  status?: string;
} {
  const rec = p as unknown as Record<string, unknown>;
  const file = typeof rec.file === "string" ? rec.file : undefined;
  const status = typeof rec.status === "string" ? rec.status : undefined;
  const progress =
    typeof rec.progress === "number" ? (rec.progress as number) : -1;
  return { file, progress, status };
}

/**
 * Mirror progress to the worker's own console so a developer can
 * actually see what the model load is doing without staring at React
 * state. This was invisible before and made "is the model even
 * downloading?" unanswerable from the browser console.
 */
function logProgress(stage: "embedder" | "llm", p: ProgressInfo) {
  const { file, progress, status } = readProgress(p);
  const pct = progress >= 0 ? `${progress.toFixed(0)}%` : "?";
  // eslint-disable-next-line no-console
  console.info(`[llmWorker] ${stage} · ${status ?? "…"} · ${file ?? ""} · ${pct}`);
}

/**
 * Internal helper used by both the initial load and the in-place
 * swap. Returns the constructed pipeline rather than mutating the
 * module-level `llm` so callers can decide *when* (and whether) to
 * commit the new pipeline. This is what makes `swapLlm` transactional:
 * if the download / pipeline construction throws, the previous
 * `llm` is left untouched.
 */
async function buildLlmPipeline(
  modelId: string,
  dtype: string,
): Promise<TextGenerationPipeline> {
  // eslint-disable-next-line no-console
  console.info(`[llmWorker] loading LLM: ${modelId} · ${dtype}`);
  return (await pipeline("text-generation", modelId, {
    device: "webgpu",
    dtype: dtype as "q4" | "q4f16" | "q8" | "fp16" | "fp32",
    progress_callback: (p: ProgressInfo) => {
      logProgress("llm", p);
      const { file, progress, status } = readProgress(p);
      send({ type: "progress", stage: "llm", file, progress, status });
    },
  })) as TextGenerationPipeline;
}

async function loadEmbedder() {
  embedder = await pipeline("feature-extraction", EMBEDDER_MODEL_ID, {
    device: "wasm",
    dtype: "fp32",
    progress_callback: (p: ProgressInfo) => {
      logProgress("embedder", p);
      const { file, progress, status } = readProgress(p);
      send({ type: "progress", stage: "embedder", file, progress, status });
    },
  });
  send({ type: "ready", stage: "embedder" });
}

async function loadLlm(modelId: string, dtype: string) {
  llm = await buildLlmPipeline(modelId, dtype);
  activeLlmModelId = modelId;
  send({ type: "ready", stage: "llm", modelId });
}

async function loadAll(llmModelId: string, llmDtype: string) {
  try {
    await loadEmbedder();
    await loadLlm(llmModelId, llmDtype);
    send({ type: "ready", stage: "all", modelId: llmModelId });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[llmWorker] load failed:", err);
    send({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

async function swapLlm(modelId: string, dtype: string) {
  if (modelId === activeLlmModelId) return;
  try {
    // Build the replacement pipeline FIRST. Don't drop `llm` yet —
    // if the download or pipeline construction throws (network, OOM,
    // cancelled fetch, model id typo), we want the previously loaded
    // model to remain usable. This is what makes the swap
    // transactional: either we end up holding a working new model,
    // or we end up holding the previous working model. We never
    // strand the worker between two unloaded states.
    const next = await buildLlmPipeline(modelId, dtype);
    llm = next;
    activeLlmModelId = modelId;
    // Best-effort dispose of the prior pipeline. The transformers.js
    // types don't expose a uniform dispose contract, so we hint the
    // GC by dropping our last reference; WebGPU buffers backing the
    // old model will free on the next idle.
    send({ type: "ready", stage: "all", modelId });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[llmWorker] swap failed:", err);
    send({
      type: "error",
      stage: "llm",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handleEmbed(id: string, text: string) {
  if (!embedder) throw new Error("Embedder not ready");
  const out = (await embedder(text, {
    pooling: "mean",
    normalize: true,
  })) as Tensor;
  const vector = Array.from(out.data as Float32Array);
  send({ type: "embedResult", id, vector });
}

interface AssistantTurn {
  role: string;
  content: string;
}
interface GeneratedItem {
  generated_text: string | AssistantTurn[];
}

function extractAssistantText(out: unknown): string {
  const first: unknown = Array.isArray(out) ? out[0] : out;
  const gen = (first as GeneratedItem | undefined)?.generated_text;
  if (Array.isArray(gen)) {
    const last = gen[gen.length - 1];
    return typeof last?.content === "string" ? last.content : "";
  }
  if (typeof gen === "string") return gen;
  return "";
}

async function handleGenerate(
  id: string,
  messages: ChatTurn[],
  maxNewTokens: number,
) {
  if (!llm) throw new Error("LLM not ready");
  send({
    type: "telemetry",
    tag: "[WebGPU]",
    text: `Starting generation (max ${maxNewTokens} tokens)…`,
  });
  const genStart = Date.now();
  let firstTokenMs: number | null = null;
  let tokenCount = 0;
  const out = await llm(messages, {
    max_new_tokens: maxNewTokens,
    do_sample: false,
    return_full_text: false,
    callback_function: (_: unknown) => {
      tokenCount += 1;
      if (firstTokenMs === null) {
        firstTokenMs = Date.now() - genStart;
        send({
          type: "telemetry",
          tag: "[WebGPU]",
          text: `First token in ${firstTokenMs}ms`,
        });
      }
      if (tokenCount % 10 === 0) {
        send({
          type: "telemetry",
          tag: "[WebGPU]",
          text: `Generating… token ${tokenCount}`,
        });
      }
    },
  });
  const totalMs = Date.now() - genStart;
  send({
    type: "telemetry",
    tag: "[WebGPU]",
    text: `Done — ${tokenCount} tokens in ${totalMs}ms (${(tokenCount / (totalMs / 1000)).toFixed(1)} tok/s)`,
  });
  send({ type: "generateResult", id, text: extractAssistantText(out).trim() });
}

ctx.onmessage = async (e: MessageEvent<WorkerInbound>) => {
  const msg = e.data;
  try {
    if (msg.type === "init") {
      await loadAll(msg.llmModelId, msg.llmDtype);
    } else if (msg.type === "swapLlm") {
      await swapLlm(msg.llmModelId, msg.llmDtype);
    } else if (msg.type === "embed") {
      await handleEmbed(msg.id, msg.text);
    } else if (msg.type === "generate") {
      await handleGenerate(msg.id, msg.messages, msg.maxNewTokens ?? 256);
    }
  } catch (err) {
    const id = "id" in msg ? msg.id : undefined;
    send({
      type: "error",
      id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
