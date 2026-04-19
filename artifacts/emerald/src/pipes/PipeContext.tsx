import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PipeManifest, PipePersona } from "@workspace/pipes";
import {
  getActivePipe,
  getDefaultBias,
  findBiasOption,
} from "@/pipes/registry";

/**
 * Per-conversation Pipe state.
 *
 * The Pipe itself is selected by the demo route's persona and is
 * effectively immutable within a session — what changes is:
 *  - `activeBiasId`: the user-selected bias (Neutral/Core/Knots…)
 *  - `connected`: whether the user has clicked "Disconnect Pipe" in
 *    the status panel; when `false`, the chat widget treats this
 *    session as Generic mode even though the manifest is still
 *    loaded. Reload restores the connection.
 */
export interface PipeContextValue {
  pipe: PipeManifest | null;
  /** Currently selected bias id (validated against pipe.bias_options). */
  activeBiasId: string;
  setActiveBias: (biasId: string) => void;
  /** True when a Pipe is loaded *and* the user has not disconnected. */
  connected: boolean;
  /** Drop the Pipe for this session; chat falls back to Generic mode. */
  disconnect: () => void;
  /** Re-attach a previously-disconnected Pipe within the same session. */
  reconnect: () => void;
}

const PipeContext = createContext<PipeContextValue | null>(null);

export function PipeProvider({
  persona,
  children,
}: {
  persona: PipePersona;
  children: ReactNode;
}) {
  const pipe = useMemo(() => getActivePipe(persona), [persona]);
  const [connected, setConnected] = useState<boolean>(pipe !== null);
  const [activeBiasId, setActiveBiasIdState] = useState<string>(() =>
    pipe ? getDefaultBias(pipe) : "neutral",
  );

  // If the Pipe definition changes (HMR after editing a manifest),
  // reset the bias to its default so we don't leave a stale id.
  useEffect(() => {
    if (pipe && !findBiasOption(pipe, activeBiasId)) {
      setActiveBiasIdState(getDefaultBias(pipe));
    }
  }, [pipe, activeBiasId]);

  const setActiveBias = useCallback(
    (biasId: string) => {
      if (!pipe) return;
      if (!findBiasOption(pipe, biasId)) return;
      setActiveBiasIdState(biasId);
    },
    [pipe],
  );

  const disconnect = useCallback(() => setConnected(false), []);
  const reconnect = useCallback(() => {
    if (pipe) setConnected(true);
  }, [pipe]);

  const value = useMemo<PipeContextValue>(
    () => ({
      pipe: connected ? pipe : null,
      activeBiasId,
      setActiveBias,
      connected: connected && pipe !== null,
      disconnect,
      reconnect,
    }),
    [pipe, connected, activeBiasId, setActiveBias, disconnect, reconnect],
  );

  return <PipeContext.Provider value={value}>{children}</PipeContext.Provider>;
}

export function usePipe(): PipeContextValue {
  const ctx = useContext(PipeContext);
  if (!ctx) {
    throw new Error("usePipe must be used inside <PipeProvider>");
  }
  return ctx;
}
