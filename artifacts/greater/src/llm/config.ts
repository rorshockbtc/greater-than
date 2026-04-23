/**
 * Worker-safe constants shared between `llmWorker.ts` and the main
 * thread (`LLMProvider.tsx`, `ModelInfoPopover.tsx`).
 *
 * IMPORTANT: This module must NEVER import `@huggingface/transformers`
 * or any worker-only runtime. Anything that imports the worker
 * directly drags the entire transformers bundle into the main thread,
 * defeating the lazy-load architecture.
 */

export const LLM_MODEL_ID = "onnx-community/Llama-3.2-1B-Instruct-q4f16";
// Switched from `Xenova/bge-small-en-v1.5` to the onnx-community port
// of the same model. Same architecture, same 384-dim sentence
// embeddings, same ~30MB download. The Xenova upload was built for
// transformers.js v2/v3 and its ONNX files lack the `data location`
// metadata the v4 JSEP wasm runtime now requires — every embed call
// throws `invalid data location: undefined for input "input_ids"`
// regardless of dtype/device pinning. The onnx-community port is
// rebuilt for v4 and runs cleanly on the same backend. Visitors
// with cached embeddings under the old name will be re-embedded
// transparently — `LLMProvider` keys IndexedDB by `embedderName`
// and reseeds when the saved name doesn't match the current
// EMBEDDER_MODEL_ID, so the swap is graceful, not breaking.
export const EMBEDDER_MODEL_ID = "onnx-community/bge-small-en-v1.5";
export const APPROX_SIZE_MB = 830;
export const LLM_QUANTIZATION_LABEL = "q4f16 · WebGPU";
