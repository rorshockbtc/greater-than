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
