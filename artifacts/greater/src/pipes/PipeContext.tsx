import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BiasOption, PipeManifest, PipePersona } from "@workspace/pipes";
import {
  getActivePipe,
  getDefaultBias,
  findBiasOption,
} from "@/pipes/registry";

/**
 * Generalised "audience" bias that every persona's demo ships with,
 * even when no curated Pipe is mounted. Sourced from the persona's
 * `defaultBias` field in `data/personas.ts`. Lets the chat widget
 * surface a meaningful bias toggle on every demo, not just the
 * FinTech one with the curated Bitcoin Pipe.
 */
export interface PersonaDefaultBias {
  options: BiasOption[];
  defaultId: string;
  promptHints: Record<string, string>;
}

/**
 * Per-conversation Pipe state.
 *
 * The Pipe itself is selected by the demo route's persona and is
 * effectively immutable within a session — what changes is:
 *  - `activeBiasId`: the user-selected bias (Neutral/Core/Knots…
 *    or, when no Pipe is mounted, the persona-default audience).
 *  - `connected`: whether the user has clicked "Disconnect Pipe" in
 *    the status panel; when `false`, the chat widget treats this
 *    session as Generic mode even though the manifest is still
 *    loaded. Reload restores the connection.
 *
 * `effectiveBiasOptions` is the list the chat widget should render
 * the toggle from. It comes from the Pipe when one is mounted, and
 * falls back to the persona's default audience options otherwise.
 */
export interface PipeContextValue {
  pipe: PipeManifest | null;
  /** Currently selected bias id (validated against the active option list). */
  activeBiasId: string;
  setActiveBias: (biasId: string) => void;
  /** True when a Pipe is loaded *and* the user has not disconnected. */
  connected: boolean;
  /** Drop the Pipe for this session; chat falls back to Generic mode. */
  disconnect: () => void;
  /** Re-attach a previously-disconnected Pipe within the same session. */
  reconnect: () => void;
  /** Bias options the chat UI should render — Pipe wins, persona defaults otherwise. */
  effectiveBiasOptions: BiasOption[];
  /** Currently selected option resolved against `effectiveBiasOptions`. */
  effectiveBiasOption: BiasOption | undefined;
  /** Source of the active bias options ("pipe" | "persona" | "none"). */
  biasSource: "pipe" | "persona" | "none";
  /**
   * Prompt hint to append to the system message for the active bias.
   * Pipe-mounted demos use the Pipe's `system_prompts[biasId]`; demos
   * with only persona-default bias use `defaultBias.promptHints[biasId]`.
   */
  effectivePromptHint: string | undefined;
}

const PipeContext = createContext<PipeContextValue | null>(null);

export function PipeProvider({
  persona,
  personaDefaults,
  children,
}: {
  persona: PipePersona;
  personaDefaults?: PersonaDefaultBias;
  children: ReactNode;
}) {
  const pipe = useMemo(() => getActivePipe(persona), [persona]);
  const [connected, setConnected] = useState<boolean>(pipe !== null);

  // Initial bias id: prefer localStorage, then Pipe default, then persona default.
  const lsKey = `greater:bias:${persona}`;
  const [activeBiasId, setActiveBiasIdState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(lsKey);
      if (saved) {
        // Validate the saved id is still valid for this Pipe/persona defaults.
        if (pipe && pipe.bias_options.some((o) => o.id === saved)) return saved;
        if (personaDefaults?.options.some((o) => o.id === saved)) return saved;
      }
    } catch {
      // Private-browsing or storage disabled — silently fall through.
    }
    if (pipe) return getDefaultBias(pipe);
    if (personaDefaults) return personaDefaults.defaultId;
    return "neutral";
  });

  // If the active option set shifts under us (HMR, or the user toggled
  // disconnect and persona defaults take over), snap back to a valid id.
  useEffect(() => {
    if (pipe && connected) {
      if (!findBiasOption(pipe, activeBiasId)) {
        setActiveBiasIdState(getDefaultBias(pipe));
      }
      return;
    }
    if (personaDefaults) {
      const ok = personaDefaults.options.some((o) => o.id === activeBiasId);
      if (!ok) setActiveBiasIdState(personaDefaults.defaultId);
    }
  }, [pipe, connected, personaDefaults, activeBiasId]);

  const setActiveBias = useCallback(
    (biasId: string) => {
      if (pipe && connected) {
        if (!findBiasOption(pipe, biasId)) return;
        setActiveBiasIdState(biasId);
        try { localStorage.setItem(lsKey, biasId); } catch { /* ignore */ }
        return;
      }
      if (personaDefaults?.options.some((o) => o.id === biasId)) {
        setActiveBiasIdState(biasId);
        try { localStorage.setItem(lsKey, biasId); } catch { /* ignore */ }
      }
    },
    [pipe, connected, personaDefaults, lsKey],
  );

  const disconnect = useCallback(() => setConnected(false), []);
  const reconnect = useCallback(() => {
    if (pipe) setConnected(true);
  }, [pipe]);

  const value = useMemo<PipeContextValue>(() => {
    const pipeActive = connected && pipe !== null;
    const effectiveBiasOptions: BiasOption[] = pipeActive
      ? pipe!.bias_options
      : (personaDefaults?.options ?? []);
    const effectiveBiasOption = effectiveBiasOptions.find(
      (o) => o.id === activeBiasId,
    );
    const biasSource: "pipe" | "persona" | "none" = pipeActive
      ? "pipe"
      : personaDefaults
        ? "persona"
        : "none";
    const effectivePromptHint = pipeActive
      ? (pipe!.system_prompts[activeBiasId] ?? undefined)
      : (personaDefaults?.promptHints[activeBiasId] ?? undefined);
    return {
      pipe: pipeActive ? pipe : null,
      activeBiasId,
      setActiveBias,
      connected: pipeActive,
      disconnect,
      reconnect,
      effectiveBiasOptions,
      effectiveBiasOption,
      biasSource,
      effectivePromptHint,
    };
  }, [
    pipe,
    connected,
    activeBiasId,
    setActiveBias,
    disconnect,
    reconnect,
    personaDefaults,
  ]);

  return <PipeContext.Provider value={value}>{children}</PipeContext.Provider>;
}

export function usePipe(): PipeContextValue {
  const ctx = useContext(PipeContext);
  if (!ctx) {
    throw new Error("usePipe must be used inside <PipeProvider>");
  }
  return ctx;
}
