/**
 * pipes.pink client — *stub*.
 *
 * pipes.pink is the eventual hosted directory of curated Greater
 * Pipes. The real client will open a websocket to pipes.pink, perform
 * a CHB-SSO handshake, receive a signed PipeManifest, and subscribe
 * to corpus diff updates. None of that exists yet.
 *
 * For now this module is shaped like the real client will be — same
 * function signatures, same return types — but every call resolves
 * locally against the `virtual:greater-pipes` registry that the
 * Vite plugin wires up from `data/pipes/` (gitignored). Replacing
 * this stub with the real implementation should be a swap of one
 * function body, not a refactor of every call site.
 */
import type { PipeManifest } from "@workspace/pipes";
import { listPipes } from "@/pipes/registry";

export type PipeConnectionStatus =
  | { kind: "disconnected" }
  | { kind: "connecting"; pipeUrl: string }
  | { kind: "connected"; manifest: PipeManifest; transport: "local" | "websocket" }
  | { kind: "error"; message: string };

let currentStatus: PipeConnectionStatus = { kind: "disconnected" };

/**
 * Connect to a remote Pipe by URL. The real implementation will:
 *
 *   TODO(websocket):
 *     1) parse the pipe URL (pipes.pink/p/<pipe_id>) for the pipe id;
 *     2) open a websocket to wss://pipes.pink/p/<pipe_id>;
 *     3) send a CHB-SSO handshake frame with the user's auth token;
 *     4) receive a signed PipeManifest frame; verify the PGP signature
 *        against the pipes.pink keyring; reject and surface diagnostic
 *        on signature failure;
 *     5) subscribe to corpus-diff frames for incremental bundle
 *        updates; persist accepted diffs into IndexedDB.
 *
 * The stub ignores `pipeUrl` entirely and resolves with the first
 * locally-available manifest. If no manifest is mounted the call
 * rejects with a useful diagnostic so callers can present a real
 * "Pipe not available" state rather than a silent no-op.
 */
export async function connectPipe(pipeUrl: string): Promise<PipeManifest> {
  currentStatus = { kind: "connecting", pipeUrl };
  const local = listPipes();
  if (local.length === 0) {
    currentStatus = {
      kind: "error",
      message:
        "No Pipe is available. The FOSS shell ships without bundled Pipes; mount one under data/pipes/ to test locally, or wait for pipes.pink to come online.",
    };
    throw new Error(currentStatus.message);
  }
  const manifest = local[0]!;
  currentStatus = { kind: "connected", manifest, transport: "local" };
  return manifest;
}

/**
 * Drop the active Pipe for the current session. The real client will
 * close the websocket; the stub just clears local state so the
 * Greater shell falls back to Generic mode for this tab.
 */
export async function disconnect(): Promise<void> {
  currentStatus = { kind: "disconnected" };
}

export function getStatus(): PipeConnectionStatus {
  return currentStatus;
}
