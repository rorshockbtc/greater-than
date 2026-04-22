/**
 * Runtime Pipe registry.
 *
 * Build-time, the `greater-pipes-loader` Vite plugin reads any
 * `*.manifest.json` from `<repo>/data/pipes/` (gitignored) and
 * inlines them into the `virtual:greater-pipes` module. At runtime
 * this registry is the only place the rest of the app talks to:
 *
 *  - `getActivePipe(persona)` — the Pipe applicable to a demo route,
 *    or `null` if the FOSS shell is running with no Pipe mounted.
 *  - `listPipes()` — every loaded Pipe (status panel uses this).
 *  - `getDefaultBias(pipe)` — the first declared bias (typically
 *    "neutral"), used when the chat widget mounts.
 *
 * The registry is intentionally synchronous: Pipes are inlined at
 * build time, so there is no async load step at runtime.
 */
import type { PipeManifest, PipePersona } from "@workspace/pipes";
import { PIPES } from "virtual:greater-pipes";

export function listPipes(): PipeManifest[] {
  return PIPES;
}

export function getActivePipe(persona: PipePersona): PipeManifest | null {
  return PIPES.find((p) => p.persona === persona) ?? null;
}

export function getDefaultBias(pipe: PipeManifest): string {
  return pipe.bias_options[0]?.id ?? "neutral";
}

export function findBiasOption(pipe: PipeManifest, biasId: string) {
  return pipe.bias_options.find((b) => b.id === biasId);
}

/**
 * Greater mode is on iff at least one Pipe is loaded for the current
 * demo. Used by the header badge and the chat widget's mode-indicator.
 */
export function isGreaterMode(persona: PipePersona): boolean {
  return getActivePipe(persona) !== null;
}

/**
 * connectPipe — future hot-load entry-point for runtime Pipe mounting.
 *
 * Today, Pipes are inlined at build time via the `greater-pipes-loader`
 * Vite plugin. `connectPipe` is stubbed here as the logical place for a
 * future fetch-and-register path where the operator supplies a manifest
 * URL (e.g. `https://pipes.pink/manifests/acme-corp.json`) and Greater
 * loads it at runtime without a rebuild.
 *
 * V1 design notes (do not implement until the manifest schema stabilises):
 *  - Fetch the manifest from `url`; validate against the PipeManifest
 *    schema (zod parse).
 *  - Write the validated manifest into a runtime registry (e.g. a Zustand
 *    store or React context) so downstream `listPipes()` / `getActivePipe()`
 *    calls can merge build-time + runtime entries.
 *  - Persist to IndexedDB (not localStorage — manifests can exceed 8 KB)
 *    so the mounted Pipe survives a hard refresh.
 *  - Return the parsed manifest on success so the caller can reflect the
 *    loaded state in the UI.
 *
 * @throws NotImplementedError — remove this when the implementation lands.
 */
export function connectPipe(_url: string): never {
  throw new Error(
    "connectPipe is not yet implemented. " +
      "Runtime Pipe mounting is planned for V1.5. " +
      "For now, add the Pipe manifest to data/pipes/ and rebuild.",
  );
}
