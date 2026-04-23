/**
 * Worker-safe constants shared between `llmWorker.ts` and the main
 * thread (`LLMProvider.tsx`, `ModelInfoPopover.tsx`).
 *
 * IMPORTANT: This module must NEVER import `@huggingface/transformers`
 * or any worker-only runtime. Anything that imports the worker
 * directly drags the entire transformers bundle into the main thread,
 * defeating the lazy-load architecture.
 */

/**
 * Default in-browser LLM. SmolLM2-135M-Instruct at q4 — ~90 MB on
 * disk, downloads in seconds even on a moderate mobile connection
 * and runs on WebGPU. Coherent enough for the conversational glue
 * the chat widget needs (greetings, smalltalk, light synthesis over
 * a hand-curated catalog brief). The catalog itself is the knowledge
 * layer; the model is just the writing voice.
 *
 * The previous default (Llama-3.2-1B-Instruct, 830 MB) was
 * mobile-data-irresponsible and made the bot feel permanently
 * "loading" because the download rarely completed in a real session.
 */
export const LLM_MODEL_ID = "HuggingFaceTB/SmolLM2-135M-Instruct";
export const LLM_DTYPE = "q4";
export const APPROX_SIZE_MB = 90;
export const LLM_QUANTIZATION_LABEL = "q4 · WebGPU";

/**
 * Optional upgrade. Loaded only when the user explicitly opts in
 * via the "Load deeper model" button in the model info popover —
 * never as part of the default page load. Worth ~250 MB to a user
 * who wants sharper synthesis on harder questions; not worth
 * forcing on every mobile visitor.
 */
export const LLM_MODEL_ID_DEEP = "HuggingFaceTB/SmolLM2-360M-Instruct";
export const LLM_DTYPE_DEEP = "q4";
export const APPROX_SIZE_MB_DEEP = 250;
export const LLM_QUANTIZATION_LABEL_DEEP = "q4 · WebGPU";

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
