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
 * connectPipe — resolve the active Pipe for a known demo persona slug.
 *
 * Resolves the mounted PipeManifest for any Pipe inlined at build time,
 * matched on `pipe_id` (canonical) or `persona` (convenience alias).
 * For the FOSS shell this covers whichever manifest files live in
 * `data/pipes/` — typically the bitcoin-greater demo Pipe. Everything
 * outside the build-time set is a production Pipe that requires a
 * Greater Studio deployment and triggers the consulting-boundary error.
 *
 * V1.5 design notes (runtime manifest loading, not yet implemented):
 *  - The future signature will accept a URL, fetch + zod-validate the
 *    manifest, write it into a runtime Zustand registry alongside the
 *    build-time Pipes, and persist to IndexedDB.
 *  - Remove the consulting-boundary throw and replace with the fetch path
 *    once the PipeManifest schema stabilises and pipes.pink is live.
 */
export function connectPipe(pipeId: string): PipeManifest {
  // Try to find the requested Pipe among the build-time-inlined set.
  // Match on `pipe_id` (canonical) or `persona` (convenience alias used
  // by FOSS forks that only know the demo route slug).
  const pipe = PIPES.find(
    (p) => p.pipe_id === pipeId || p.persona === pipeId,
  );
  if (pipe) return pipe;

  // Everything outside the build-time set is a production Pipe — those
  // require a Greater Studio deployment and are not distributable via
  // the FOSS shell. Surface a clear consulting-boundary message so FOSS
  // forks discover the limit immediately without hunting for it.
  throw new Error(
    `Production Pipes require a Greater Studio deployment — ` +
      `see HARNESS_BEST_PRACTICES.md to build a local harness, ` +
      `or contact colonhyphenbracket.pink for a curated Pipe.`,
  );
}
