import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { MessageSquare, Send, Bot, Loader2, ChevronDown, Maximize2, Minimize2, ShieldCheck, PhoneCall, AlertOctagon, CircleDashed, Settings, Database, Cable, Info, Ticket, Cpu, BookOpen, Sun, Moon, Code2, Mail, ScrollText, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSendMessage, useEscalateTicket } from '@workspace/api-client-react';
import { ChatMessage, type MessageProps } from './ChatMessage';
import { SecurityPanel } from './SecurityPanel';
import { KnowledgePanel } from './KnowledgePanel';
import { QaBankPanel } from './QaBankPanel';
import { OpenClawPanel } from './OpenClawPanel';
import { HarnessPanel } from './HarnessPanel';
import { TerminalPanel, type TerminalLogLine } from './TerminalPanel';
import { PipeStatusPanel } from './PipeStatusPanel';
import { BiasToggle } from './BiasToggle';
import { DisclaimerBanner } from './DisclaimerBanner';
import { ModelInfoPopover } from '@/llm/ModelInfoPopover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLLM } from '@/llm/LLMProvider';
import { usePipe } from '@/pipes/PipeContext';
import { useToast } from '@/hooks/use-toast';
import { useContact } from '@/components/ContactContext';
import { cn } from '@/lib/utils';
import type { AskOptions, Bias, ChatTurn, CloudReason, ModelStatus } from '@/llm/types';
import { saveTranscript } from '@/lib/ticketTranscript';

function uuidv4() {
  return crypto.randomUUID();
}

/**
 * Structured "this is a lightweight demo persona" fallback. Replaces
 * the prior "we can't help, refresh the session" dead-end so visitors
 * understand WHY the bot can't answer right now and what they CAN ask
 * next. Per the production-feedback note, every "I don't know" should
 * convert into a clear redirect rather than a no-recourse error.
 */
function buildLightweightDemoFallback({
  personaBrand,
  personaExampleTopics,
  reason,
}: {
  personaBrand?: string;
  personaExampleTopics?: string[];
  reason: string;
}): string {
  const brandLine = personaBrand
    ? `I'm a lightweight demo persona for ${personaBrand}, built on the Greater framework`
    : "I'm a lightweight demo persona built on the Greater framework";
  const topicsBlock =
    personaExampleTopics && personaExampleTopics.length > 0
      ? `\n\nTry asking me about:\n${personaExampleTopics
          .map((t) => `• ${t}`)
          .join('\n')}`
      : '';
  return [
    `${reason} ${brandLine} — in a real production deployment, the company would build out a comprehensive knowledge base so I could answer questions like yours accurately.`,
    `${topicsBlock ? topicsBlock + '\n\n' : '\n\n'}You can also try again in a new session, or refresh to reload the local model. Curious about how Greater works? Visit the homepage.`,
  ].join('');
}

/**
 * Per-persona chrome for the chat widget. Every demo route passes its
 * own copy so the bot greets the visitor in-character (Cornerstone,
 * Vellum, Heritage, Pinecrest, MutualHealth) instead of always opening
 * with the Blockstream welcome.
 */
export interface ChatWidgetProps {
  /** Initial bot greeting. Defaults to the Blockstream copy. */
  welcomeMessage?: string;
  /** Placeholder text for the input. Defaults to "Type a message". */
  placeholder?: string;
  /**
   * Friendly label shown in the bundle-loading banner (e.g. "MutualHealth
   * member-portal corpus"). Defaults to "Bitcoin knowledge bundle"
   * for backward compatibility with the original Blockstream demo.
   */
  bundleLabel?: string;
  /**
   * If provided, renders a small "What's this demo?" header button
   * that re-opens the persona's ScenarioModal. Demo shells supply
   * the callback via `useScenarioModal().reopen`.
   */
  onReopenScenario?: () => void;
  /**
   * URL slug of the demo route (e.g. "blockstream", "startups").
   * Used as the sessionStorage key for the transcript and as the
   * navigation target for the support-ticket preview screen
   * (`/demo/<routeSlug>/ticket`). Required to enable the
   * "Show what would have been escalated" menu item.
   */
  routeSlug?: string;
  /**
   * Persona slug from `data/personas` (e.g. "fintech"). Stored on
   * the transcript so the ticket preview can label the payload with
   * the right persona regardless of the URL slug.
   */
  personaSlug?: string;
  /**
   * Brand the visitor saw in the chat header (e.g. "Blockstream",
   * "Vellum"). Used in the ticket preview's back-link and tags.
   */
  personaBrand?: string;
  /**
   * Self-contained system prompt for this persona. When provided AND no
   * curated Pipe is mounted, this overrides the LLMProvider's default
   * "You are Greater, support assistant for Blockstream..." prompt.
   * Without this, the model hallucinates a Blockstream/Bitcoin identity
   * on non-FinTech personas (the "I'm Greater, Blockstream's support
   * assistant" leak on MutualHealth, etc.).
   *
   * Sourced from `data/personas.ts` → `scenario.systemPrompt`. The
   * FinTech persona supplies its own Blockstream-flavoured prompt so
   * the live demo keeps its grounded behaviour.
   */
  personaSystemPrompt?: string;
  /**
   * 2–3 example topics this persona handles well. Used in the
   * structured "lightweight demo" fallback message when the bot
   * cannot answer (cloud rate-limited + local failed/loading) so the
   * dead-end becomes a redirect to questions that DO work.
   */
  personaExampleTopics?: string[];
  /**
   * Tappable suggested-prompt chips shown in the empty state, above
   * the input. Each chip pre-fills the input on tap. Designed for
   * the lead-gen path: visitors who don't know what to ask see the
   * shape of what's possible and convert at a higher rate.
   */
  suggestedPrompts?: string[];
  /**
   * Short noun phrase describing what this bot covers, threaded through
   * to LLMProvider.ask so the strict-grounding refusal can name the
   * bot's scope ("I can only answer questions about Greater itself —
   * the FOSS shell, OpenClaw, …") instead of falling back to the
   * generic "topics in this bot's curated knowledge base."
   */
  refusalScope?: string;
  /**
   * Default harness charter text used when no operator-saved harness
   * exists in localStorage for this persona. Lets each demo ship with
   * a pre-authored system persona rather than an empty harness slot.
   * Any value saved by the operator via the Harness Panel takes
   * precedence over this default.
   */
  defaultHarnessText?: string;
}

export function ChatWidget({
  welcomeMessage,
  placeholder,
  bundleLabel,
  onReopenScenario,
  routeSlug,
  personaSlug,
  personaBrand,
  personaSystemPrompt,
  personaExampleTopics,
  suggestedPrompts,
  refusalScope,
  defaultHarnessText,
}: ChatWidgetProps = {}) {
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [sessionId] = useState(() => uuidv4());
  const [startTime] = useState(() => new Date());
  const [input, setInput] = useState('');
  const [showSecurityPanel, setShowSecurityPanel] = useState(false);
  const [showKnowledgePanel, setShowKnowledgePanel] = useState(false);
  const [showQaBankPanel, setShowQaBankPanel] = useState(false);
  const [showPipePanel, setShowPipePanel] = useState(false);
  const [showOpenClawPanel, setShowOpenClawPanel] = useState(false);
  const [showHarnessPanel, setShowHarnessPanel] = useState(false);
  const [showTerminalPanel, setShowTerminalPanel] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('greater:terminal:enabled') === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('greater:terminal:enabled', String(showTerminalPanel));
    } catch {
      // best-effort
    }
  }, [showTerminalPanel]);
  const terminalLinesRef = useRef<TerminalLogLine[]>([]);
  const terminalLineCounterRef = useRef(0);
  const [terminalLines, setTerminalLines] = useState<TerminalLogLine[]>([]);
  const MAX_TERMINAL_LINES = 200;

  const appendTerminalLine = useCallback((tag: string, text: string) => {
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    const line: TerminalLogLine = {
      id: terminalLineCounterRef.current++,
      ts,
      tag,
      text,
    };
    terminalLinesRef.current = [
      ...terminalLinesRef.current,
      line,
    ].slice(-MAX_TERMINAL_LINES);
    setTerminalLines([...terminalLinesRef.current]);
  }, []);
  const [importedHarnessText, setImportedHarnessText] = useState<string>("");
  // Local Harness charter — user-authored text read from localStorage and
  // threaded into every llm.ask() call as the outermost system-prompt frame.
  // Keyed by persona so different bots carry different harnesses independently.
  const [harnessText, setHarnessText] = useState<string>(() => {
    if (!personaSlug) return defaultHarnessText ?? "";
    try {
      return localStorage.getItem(`greater:harness:${personaSlug}`) ?? defaultHarnessText ?? "";
    } catch {
      return defaultHarnessText ?? "";
    }
  });
  // Reload harness from localStorage whenever the visitor navigates to a
  // different persona — each bot is scoped independently so the wrong
  // charter is never injected after a persona switch.
  useEffect(() => {
    if (!personaSlug) { setHarnessText(defaultHarnessText ?? ""); return; }
    try {
      setHarnessText(localStorage.getItem(`greater:harness:${personaSlug}`) ?? defaultHarnessText ?? "");
    } catch {
      setHarnessText(defaultHarnessText ?? "");
    }
  }, [personaSlug, defaultHarnessText]);
  const [hasSecurityAlertSession, setHasSecurityAlertSession] = useState(false);
  /**
   * Escalation preview dialog state. Clicking the phone icon used to
   * fire the network call immediately — surfacing the visitor's
   * transcript to a human without warning. The dialog now intercepts
   * that click and shows the visitor exactly what will be sent
   * (transcript + optional contact field) BEFORE any network call,
   * so the LOCAL · PRIVATE badge stays honest right up until the
   * moment the visitor explicitly opts in to escalation.
   */
  const [showEscalateDialog, setShowEscalateDialog] = useState(false);
  const [escalateContactInfo, setEscalateContactInfo] = useState('');
  const [escalateShowJson, setEscalateShowJson] = useState(false);
  /**
   * Chat-widget color theme. Defaults to dark to preserve current
   * behavior; visitor preference is persisted in localStorage so it
   * survives reloads. Toggled via the moon/sun item in the header
   * settings menu. We intentionally scope this to the widget rather
   * than the whole site because the surrounding page chrome already
   * has its own light/dark posture (operators may want a dark page
   * with a light chat, or vice versa).
   */
  const [chatTheme, setChatTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = window.localStorage.getItem('greater:chat-theme');
    return saved === 'light' ? 'light' : 'dark';
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('greater:chat-theme', chatTheme);
  }, [chatTheme]);
  const [isLocalGenerating, setIsLocalGenerating] = useState(false);
  /**
   * Tracks whether we've already injected the "cloud is rate-limited"
   * inline notice for this widget instance. The first denied cloud
   * call shows the notice; subsequent ones silently route to local.
   */
  const cloudCapNoticeShownRef = useRef<boolean>(false);
  // Catalog-first sticky context (Task #68). Tracks the leaf ids the
  // navigator landed on across the current chat session so multi-turn
  // threads stay on a coherent branch unless the visitor visibly
  // switches topic. Capped at the most recent 5; older entries fall
  // off so a long session doesn't permanently bias the ranker.
  const recentCatalogLeafIdsRef = useRef<string[]>([]);
  /**
   * Stable id of the seeded welcome message. The widget always
   * injects a welcome turn (with or without the `welcomeMessage`
   * prop), and we need to be able to exclude it from "real turn"
   * counts and from the persisted ticket transcript without relying
   * on prop-presence as a proxy. Captured once at mount via the
   * `useState` initializer so it stays stable across re-renders.
   */
  const welcomeMessageIdRef = useRef<string>(uuidv4());
  const [messages, setMessages] = useState<MessageProps[]>(() => [
    {
      id: welcomeMessageIdRef.current,
      role: 'bot',
      content:
        welcomeMessage ??
        "Hello! I'm Greater's Blockstream support bot. Ask me about Jade, Green, hardware-wallet recovery, fees, or self-custody.",
      timestamp: new Date(),
      trustScore: 0.99,
      ciBreakdown: "System initialization verified.",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const { open: openContact } = useContact();

  const chatMutation = useSendMessage();
  const escalateMutation = useEscalateTicket();
  const llm = useLLM();
  const pipe = usePipe();
  const activeBiasOption = pipe.effectiveBiasOption;

  // When the user switches bias mid-conversation, drop a small inline
  // note so the *visible transcript* explains why the next answer may
  // contradict an earlier one. The note is also added to the model's
  // history (as a system message) so the model knows its perspective
  // changed and is allowed to disagree with prior turns.
  const handleBiasChange = (nextBiasId: string) => {
    if (nextBiasId === pipe.activeBiasId) return;
    const next = pipe.effectiveBiasOptions.find((b) => b.id === nextBiasId);
    const prev = activeBiasOption;
    if (!next) return;
    pipe.setActiveBias(nextBiasId);
    setMessages((prevMsgs) => [
      ...prevMsgs,
      {
        id: uuidv4(),
        role: 'bot',
        content: `Switched perspective: ${prev?.label ?? 'Neutral'} → ${next.label}. Subsequent answers may differ from earlier ones — that's expected when the bias changes.`,
        timestamp: new Date(),
        isModeNote: true,
      },
    ]);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatMutation.isPending, isLocalGenerating]);

  // Kick the curated Q&A bank load as soon as we know the persona.
  // Idempotent inside LLMProvider; safe to call multiple times.
  useEffect(() => {
    if (personaSlug) {
      llm.requestQaBank(personaSlug);
    }
  }, [personaSlug, llm]);

  /**
   * "Real" turns: user/bot only, mode-notes excluded, and the
   * seeded welcome explicitly dropped by id. We key off the
   * captured welcome id rather than `welcomeMessage` prop presence
   * so the gating works identically on demos that supply the prop
   * (PersonaDemoShell) and demos that rely on the default
   * (BlockstreamDemo). Memoised so it can be a stable useEffect dep
   * for the transcript-persistence effect.
   */
  const realTurns = React.useMemo(
    () =>
      messages.filter(
        (m) =>
          m.id !== welcomeMessageIdRef.current &&
          !m.isModeNote &&
          (m.role === 'user' || m.role === 'bot'),
      ),
    [messages],
  );
  const userTurnCount = realTurns.filter((m) => m.role === 'user').length;
  const botTurnCount = realTurns.filter((m) => m.role === 'bot').length;
  const ticketPreviewEnabled =
    !!routeSlug && userTurnCount >= 1 && botTurnCount >= 1;

  /**
   * Persist the redacted-eligible transcript to sessionStorage on
   * every real-turn change so the support-ticket preview screen at
   * `/demo/<slug>/ticket` has something to read. Skipped when the
   * host page didn't supply `routeSlug` (keeps the storage key
   * honest about what produced it).
   */
  useEffect(() => {
    if (!routeSlug || !personaSlug || !personaBrand) return;
    const turns = realTurns.map((m) => ({
      role: m.role as 'user' | 'bot',
      content: m.content,
      timestamp: m.timestamp.toISOString(),
    }));
    if (!turns.length) return;
    saveTranscript({
      updatedAt: new Date().toISOString(),
      sessionId,
      routeSlug,
      personaSlug,
      personaBrand,
      biasId: activeBiasOption ? pipe.activeBiasId : undefined,
      biasLabel: activeBiasOption?.label,
      turns,
    });
  }, [
    realTurns,
    routeSlug,
    personaSlug,
    personaBrand,
    sessionId,
    pipe.activeBiasId,
    activeBiasOption,
  ]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Auto-grow the textarea so the user can see what they've typed
  // when their message wraps past one line. We reset the height to
  // 'auto' first so the scrollHeight measurement reflects the new
  // content (otherwise it'd only grow, never shrink). The CSS
  // `max-h-40` cap keeps a runaway paste from eating the whole
  // chat surface — the textarea becomes scrollable past that.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  const isPending = chatMutation.isPending || isLocalGenerating;

  const handleSend = async (overrideText?: string) => {
    const userText = (overrideText ?? input).trim();
    if (!userText || isPending) return;

    setInput('');

    const userMsg: MessageProps = {
      id: uuidv4(),
      role: 'user',
      content: userText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Curated Q&A cache wins over EVERY other path — local, cloud,
    // OpenClaw — when the bank has loaded for this persona AND the
    // visitor's question matches above the cosine threshold. Doing
    // this BEFORE the model-readiness branch means early-session
    // questions during model warmup also benefit instead of burning
    // a cloud call. Failures here are silent: the cache is best-effort.
    // Bias-aware skip: when the visitor has dialled in a non-neutral
    // perspective (e.g. Bitcoin Core or Knots), bypass the bias-blind
    // curated cache so the bias toggle is never silently ignored. The
    // bias-aware retrieval + bias-specific system prompt downstream
    // will handle the answer. Without this, the headline UX claim of
    // the platform — "the bias strip is real, switch it and watch the
    // answer move" — silently breaks on every cached question.
    const biasIsNonNeutral =
      !!activeBiasOption &&
      pipe.activeBiasId !== undefined &&
      pipe.activeBiasId !== 'neutral';
    // Catalog-mode personas (Task #68 — currently fintech/Bitcoin)
    // MUST bypass the QA cache. The whole point of catalog-first
    // retrieval is that every Bitcoin answer carries structural
    // citations from a curated leaf and passes through the anti-drift
    // gate; a stale qa-bank cache hit would short-circuit both. The
    // cache layer remains active for every other persona.
    const personaUsesCatalog = personaSlug === 'fintech';
    if (personaSlug && !biasIsNonNeutral && !personaUsesCatalog) {
      try {
        const cacheStart = performance.now();
        const hit = await llm.tryQaCache(userText, personaSlug);
        if (hit) {
          // Latency floor on canned responses. The cache returns in
          // 20-80ms, which makes the bot feel like a precanned FAQ
          // (the friend review's exact complaint). 600-900ms reads
          // as "thinking" without becoming annoying. Floor is
          // applied AFTER we know we have a hit so genuine cache
          // misses still feel snappy. We use the elapsed cache time
          // as part of the budget — not adding on top of it — so
          // total perceived latency stays in the 600-900ms band.
          const elapsed = performance.now() - cacheStart;
          const target = 600 + Math.random() * 300;
          const remaining = Math.max(0, target - elapsed);
          if (remaining > 0) {
            await new Promise((r) => setTimeout(r, remaining));
          }
          const botMsg: MessageProps = {
            id: uuidv4(),
            role: 'bot',
            content: hit.answer,
            timestamp: new Date(),
            trustScore: 0.96,
            ciBreakdown:
              'Curated Q&A bank · semantic match above threshold · zero model tokens spent.',
            responseSource: 'qa-cache',
            biasLabel: activeBiasOption?.label,
            biasId: activeBiasOption ? pipe.activeBiasId : undefined,
            cosineScore: hit.score,
            latencyMs: Math.round(performance.now() - cacheStart),
          };
          setMessages((prev) => [...prev, botMsg]);
          return;
        }
      } catch {
        // Best-effort cache; on failure fall through to normal path.
      }
    }

    // OpenClaw mode (BYO local LLM) takes precedence over both the
    // in-browser model and the cloud fallback. The visitor is paying
    // their own compute, so we should never hit the cloud endpoint
    // while OpenClaw is active.
    if (llm.openClawActive) {
      await runLocal(userText);
      return;
    }

    // Local-first when ready; cloud fallback otherwise. The label on
    // the response always says which path served it.
    if (llm.status === 'ready') {
      await runLocal(userText);
      return;
    }

    // Catalog-mode personas (Task #68 — currently fintech/Bitcoin)
    // don't depend on the WebGPU model for retrieval. The navigator
    // returns a verbatim leaf brief in zero-LLM mode and only uses
    // the model for an optional polish pass when it's ready. So the
    // catalog path is safe — and required, per the <2s first-paint
    // goal — to run BEFORE `llm.status === 'ready'`. Routing fintech
    // to the cloud while the model loads would defeat the whole
    // reason the catalog architecture exists.
    if (personaSlug === 'fintech') {
      await runLocal(userText);
      return;
    }

    // Local isn't ready yet — try cloud, but honor the per-session
    // cap. When the cap is hit we route through local even though
    // the model isn't ready (the call will surface a clear error in
    // the rare case it actually fails); see `tryCloudOrLocal`.
    const reason: CloudReason =
      llm.status === 'unsupported'
        ? 'unsupported'
        : llm.status === 'error'
          ? 'local-error'
          : 'loading';
    await tryCloudOrLocal(userText, reason);
  };

  /**
   * Run the local-first happy path. Factored out so it can also be
   * called as a fallback from the cloud path (either when the cap is
   * hit or when local was the original error and we need to bounce
   * back). `localOnlyDueToCap` flips the per-message badge from
   * "Local · Private" to "Local-only · cloud rate-limited" so the
   * provenance stays honest.
   */
  const runLocal = async (userText: string, localOnlyDueToCap = false) => {
    setIsLocalGenerating(true);
    try {
      const history: ChatTurn[] = messages
        .filter((m) => (m.role === 'user' || m.role === 'bot') && !m.isModeNote)
        .map((m) => ({
          role: m.role === 'bot' ? 'assistant' : 'user',
          content: m.content,
        }));
      // Build ask options from whichever bias source is active for this
      // session — Pipe (curated, includes biasFilter for retrieval)
      // wins; persona-default audience bias still ships a system-prompt
      // hint and the bias label so the response shifts visibly.
      let askOptions: AskOptions | undefined;
      if (pipe.pipe) {
        // A curated Pipe is mounted — its system prompt wins because it
        // already knows about the persona AND any bias-specific
        // overrides. Pipe takes precedence over personaSystemPrompt.
        askOptions = {
          systemPrompt: pipe.effectivePromptHint,
          // Always include 'neutral' so common-ground material remains
          // eligible regardless of fork. The active bias adds the
          // perspective-specific material on top.
          biasFilter: Array.from(
            new Set<Bias>([
              'neutral',
              pipe.activeBiasId as Bias,
            ]),
          ),
          biasId: pipe.activeBiasId,
          biasLabel: activeBiasOption?.label,
        };
      } else if (pipe.effectivePromptHint) {
        // No Pipe, but the audience-bias toggle has a prompt hint.
        // Compose: persona identity FIRST (so the bot knows whose
        // brand it speaks for), audience-hint AFTER (so tone shifts
        // for the active bias). Without the persona prefix the model
        // falls back to LLMProvider's Blockstream/Bitcoin default and
        // hallucinates "I'm Greater, Blockstream's support assistant"
        // on every persona.
        askOptions = {
          systemPrompt: personaSystemPrompt
            ? `${personaSystemPrompt}\n\n${pipe.effectivePromptHint}`
            : pipe.effectivePromptHint,
          biasId: pipe.activeBiasId,
          biasLabel: activeBiasOption?.label,
        };
      } else if (personaSystemPrompt) {
        // No Pipe, no audience-bias hint — just the persona's identity.
        // Critical: without this, askOptions stays undefined and
        // LLMProvider falls back to its "You are Greater, support
        // assistant for Blockstream..." default → persona leak.
        askOptions = {
          systemPrompt: personaSystemPrompt,
        };
      }
      // Always carry the persona slug so the curated Q&A cache (in
      // LLMProvider.ask) can short-circuit on a semantic match.
      // Adds the field even when no other ask options are set.
      if (personaSlug) {
        askOptions = { ...(askOptions ?? {}), personaSlug };
      }
      // Catalog-first retrieval (Task #68). The fintech persona is
      // backed by the Bitcoin pack, which has been migrated off the
      // 11 MB monolithic seed bundle and onto the hand-curated
      // catalog tree under public/catalog/bitcoin/. Other personas
      // continue on the cosine path until they're authored too.
      // BASE_URL already ends with "/" by Vite convention.
      if (personaSlug === 'fintech') {
        askOptions = {
          ...(askOptions ?? {}),
          useCatalog: {
            packSlug: 'bitcoin',
            catalogBaseUrl: `${import.meta.env.BASE_URL}catalog/bitcoin/`,
            recentLeafIds: recentCatalogLeafIdsRef.current.slice(),
            // JIT-fetch up to 3 per-doc local copies per turn so the
            // trace panel shows substantive source-derived bodies
            // (excerpt + every citing leaf's brief), not just the
            // inline excerpt. Files live under public/corpus/bitcoin/
            // and are emitted by `build-catalog-corpus`.
            jitLoadBodies: true,
            corpusBaseUrl: `${import.meta.env.BASE_URL}corpus/bitcoin/`,
            jitMaxDocs: 3,
          },
        };
      }
      // Carry the refusal scope so the strict-grounding refusal in
      // LLMProvider.ask can name THIS bot's territory instead of
      // falling back to generic copy. Always added when supplied,
      // independent of whichever bias-source branch above ran.
      if (refusalScope) {
        askOptions = { ...(askOptions ?? {}), refusalScope };
      }
      // Local Harness: inject user-authored charter as the outermost
      // frame of every system prompt. Trimmed before use; blank string
      // is a no-op inside LLMProvider so safe to always pass through.
      if (harnessText.trim()) {
        askOptions = { ...(askOptions ?? {}), harnessText };
      }
      // Glass Engine terminal: pipe telemetry to the log buffer so
      // the terminal panel shows live events. The callback is always
      // wired (not gated on panel visibility) so the buffer is already
      // populated when the visitor opens the panel mid-turn.
      askOptions = { ...(askOptions ?? {}), onTelemetry: appendTerminalLine };
      const askStart = performance.now();
      const answer = await llm.ask(history, userText, askOptions);
      const askLatency = Math.round(performance.now() - askStart);
      const isOpenClaw = answer.source === 'openclaw';
      const isQaCache = answer.source === 'qa-cache';
      // Hard refusals are deterministic too (no model tokens spent —
      // they're produced by the retrieval-floor branch in
      // LLMProvider.ask). Without a latency floor they snap back in
      // ~30ms which reads as "the bot didn't even try", which is
      // exactly the wrong tone for what is supposed to be an honest
      // "I can't ground this" message. Match the qa-cache band so
      // refusals feel deliberated, not reflexive. Detected via the
      // thoughtTrace.reasoning sentinel that LLMProvider sets on
      // hard-refusal returns.
      const reasoning = answer.thoughtTrace?.reasoning ?? '';
      const isHardRefusal =
        answer.source === 'local' && reasoning.startsWith('Hard refusal');
      const isWeakContextReply =
        answer.source === 'local' && reasoning.startsWith('Weak context');
      if (isHardRefusal) {
        const target = 600 + Math.random() * 300;
        const remaining = Math.max(0, target - askLatency);
        if (remaining > 0) {
          await new Promise((r) => setTimeout(r, remaining));
        }
      } else {
        // Universal "thinking floor" for all substantive answers
        // (in-browser WebGPU, cloud fallback, OpenClaw). The cloud
        // fallback in particular can return in 200-400ms which makes
        // the bot feel like it didn't actually consider the question.
        // 1200-1500ms reads as "deliberated" without becoming sluggish,
        // and matches the cadence visitors already feel when the local
        // WebGPU model is in use. Applied AFTER the answer is in hand
        // so we never delay anything that already took longer than
        // the floor.
        const target = 1200 + Math.random() * 300;
        const remaining = Math.max(0, target - askLatency);
        if (remaining > 0) {
          await new Promise((r) => setTimeout(r, remaining));
        }
      }
      // Either flag triggers the in-bubble 3-action row. We carry
      // the union under the existing `isHardRefusal` MessageProps
      // field rather than threading a second boolean through —
      // the row's contract is "this answer wasn't a confident hit;
      // here are your escape hatches", and that contract holds
      // identically for hard refusals and weak-context replies.
      const showRefusalActions = isHardRefusal || isWeakContextReply;
      // Top retrieval similarity from the thought trace (when present)
      // is a useful retrieval-quality signal alongside the binary
      // thumbs rating; record it on the message so it's posted with
      // any feedback the visitor leaves.
      const topRetrievalScore =
        answer.thoughtTrace?.chunks?.[0]?.score ??
        undefined;
      const botMsg: MessageProps = {
        id: uuidv4(),
        role: 'bot',
        content: answer.text,
        timestamp: new Date(),
        trustScore: 0.96,
        ciBreakdown: isQaCache
          ? 'Curated Q&A bank · semantic match above threshold · zero model tokens spent.'
          : isOpenClaw
            ? 'OpenClaw · BYO model · grounded in retrieved chunks where available.'
            : 'Local inference · WebGPU · grounded in retrieved chunks.',
        responseSource: isQaCache ? 'qa-cache' : isOpenClaw ? 'openclaw' : 'local',
        thoughtTrace: answer.thoughtTrace,
        biasLabel: activeBiasOption?.label,
        biasId: activeBiasOption ? pipe.activeBiasId : undefined,
        localOnly: localOnlyDueToCap,
        latencyMs: askLatency,
        cosineScore: topRetrievalScore,
        isHardRefusal: showRefusalActions,
      };
      setMessages((prev) => [...prev, botMsg]);
      // Push the catalog leaf id (when present) into the sticky-context
      // ring buffer so the next turn's navigator can prefer the same
      // branch on near-tie scores. De-duped so revisiting a leaf
      // doesn't crowd out the rest of the trail. Capped at 5.
      if (answer.catalogLeafId) {
        const next = [
          answer.catalogLeafId,
          ...recentCatalogLeafIdsRef.current.filter(
            (id) => id !== answer.catalogLeafId,
          ),
        ].slice(0, 5);
        recentCatalogLeafIdsRef.current = next;
      }
    } catch (err) {
      // OpenClaw failures should NOT fall back to the cloud — the
      // visitor explicitly opted into BYO inference. Surface the
      // error inline so they can fix the endpoint and try again.
      if (llm.openClawActive) {
        console.error('OpenClaw inference failed:', err);
        const detail =
          (err as Error)?.message ?? 'Unknown error reaching your endpoint.';
        setMessages((prev) => [
          ...prev,
          {
            id: uuidv4(),
            role: 'bot',
            content: `OpenClaw call failed: ${detail}\n\nOpen the OpenClaw settings to re-test the connection.`,
            timestamp: new Date(),
            responseSource: 'openclaw',
          },
        ]);
        return;
      }
      // In-browser model failed mid-conversation. If the cloud cap
      // still has room, fall back to cloud honestly; otherwise
      // surface the failure inline (we can't quietly hammer the paid
      // endpoint forever just because local crashed).
      console.error('Local inference failed, falling back to cloud:', err);
      await tryCloudOrLocal(userText, 'local-error');
    } finally {
      setIsLocalGenerating(false);
    }
  };

  /**
   * Cloud fallback gated by the per-session cap. When the cap has
   * room, this is just `sendViaCloud`. When the cap is hit, we drop
   * the one-time "rate-limited" notice into the transcript and route
   * the request through the local model instead.
   */
  const tryCloudOrLocal = async (userText: string, cloudReason: CloudReason) => {
    if (llm.consumeCloudCall()) {
      await sendViaCloud(userText, cloudReason);
      return;
    }
    if (!cloudCapNoticeShownRef.current) {
      cloudCapNoticeShownRef.current = true;
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          role: 'bot',
          content:
            'Cloud help is rate-limited — Greater is local-only from here. The in-browser model is still answering your questions.',
          timestamp: new Date(),
          isModeNote: true,
        },
      ]);
    }
    // Critical: do NOT re-enter runLocal when we got here *because*
    // local just failed. That path would recurse indefinitely
    // (local throws → tryCloudOrLocal → cap denied → runLocal → throws…).
    // In that case there's no safe way forward this turn — surface a
    // terminal inline error and stop.
    if (cloudReason === 'local-error') {
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          role: 'bot',
          content: buildLightweightDemoFallback({
            personaBrand,
            personaExampleTopics,
            reason:
              'The in-browser model hit an error and the cloud fallback is rate-limited for this session.',
          }),
          timestamp: new Date(),
          responseSource: 'local',
          localOnly: true,
        },
      ]);
      return;
    }
    if (llm.status === 'ready') {
      await runLocal(userText, true);
      return;
    }
    // Pathological case: cap hit *and* local not ready yet. Don't
    // burn the user's input — surface a clear inline message and
    // stop. Don't recurse to cloud (that's exactly what the cap
    // forbids). Don't recurse to local either (it would throw).
    setMessages((prev) => [
      ...prev,
      {
        id: uuidv4(),
        role: 'bot',
        content: buildLightweightDemoFallback({
          personaBrand,
          personaExampleTopics,
          reason:
            'The cloud fallback is rate-limited for this session and the in-browser model is still loading.',
        }),
        timestamp: new Date(),
        responseSource: 'local',
        localOnly: true,
      },
    ]);
  };

  const sendViaCloud = async (userText: string, cloudReason: CloudReason) => {
    try {
      const response = await chatMutation.mutateAsync({
        data: {
          message: userText,
          sessionId,
          // Pass the active bias through so the server can prepend a
          // bias-specific system prompt and the per-message bias chip
          // on the cloud reply matches what the visitor was viewing.
          biasId: pipe.pipe ? pipe.activeBiasId : undefined,
          biasLabel: activeBiasOption?.label,
        },
      });

      if (response.isSecurityAlert) {
        setHasSecurityAlertSession(true);
      }

      const botMsg: MessageProps = {
        id: uuidv4(),
        role: 'bot',
        content: response.reply,
        timestamp: new Date(),
        trustScore: response.trustScore,
        ciBreakdown: response.ciBreakdown,
        sources: response.sources,
        lastUpdated: response.lastUpdated,
        isFinancialAdvice: response.isFinancialAdvice,
        relatedArticles: response.relatedArticles,
        responseSource: 'cloud',
        cloudReason,
        // Prefer the bias the *server* actually honored (echoed back
        // on the response) over the current UI state. If the user
        // toggles bias mid-flight, the chip on this message should
        // reflect what produced the answer, not what's selected now.
        biasLabel:
          response.biasLabel ?? activeBiasOption?.label,
        biasId:
          response.biasId ?? (pipe.pipe ? pipe.activeBiasId : undefined),
      };

      setMessages((prev) => [...prev, botMsg]);
      if (cloudReason === 'local-error') {
        toast({
          title: 'Used cloud fallback',
          description: 'Local inference hit an error; this reply came from the cloud endpoint.',
        });
      }
    } catch {
      // The cloud request itself failed — refund the slot so a
      // single network blip doesn't permanently shrink the visitor's
      // budget. The cap is meant to bound *successful* paid calls.
      llm.refundCloudCall();
      toast({
        title: 'Connection Error',
        description: 'Failed to reach the support backend. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /**
   * Build the exact payload the escalation network call will send,
   * given the current transcript and the visitor's optional contact
   * field. Pure function (no side effects, no network) so the preview
   * dialog can render it AND the actual send can use the identical
   * value — no risk of the preview drifting from what's actually
   * transmitted.
   *
   * Contact info is appended as a synthetic system turn rather than
   * a separate API field so we don't have to change the backend
   * schema; the human reading the ticket sees it inline at the end
   * of the transcript where they'd expect "how to reach this
   * person" to live.
   */
  const buildEscalationPayload = () => {
    const realTranscript = messages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp.toISOString(),
    }));
    const contact = escalateContactInfo.trim();
    const chatHistory = contact
      ? [
          ...realTranscript,
          {
            role: 'system' as const,
            content: `Visitor's preferred contact: ${contact}`,
            timestamp: new Date().toISOString(),
          },
        ]
      : realTranscript;
    return {
      sessionId,
      subject: hasSecurityAlertSession
        ? 'URGENT: Possible Account Compromise'
        : 'General Support Escalation',
      chatHistory,
    };
  };

  /**
   * Click handler on the header phone icon. Replaces the prior
   * fire-immediately behavior — now opens the preview dialog so
   * the visitor sees what will be sent before consenting.
   */
  const handleEscalate = () => {
    setShowEscalateDialog(true);
  };

  /**
   * Actually send the escalation. Called only after the visitor
   * explicitly clicks "Send to Support" in the preview dialog.
   */
  const confirmEscalate = async () => {
    try {
      const payload = buildEscalationPayload();
      const res = await escalateMutation.mutateAsync({ data: payload });
      if (res.success) {
        toast({
          title: 'Ticket Escalated',
          description: 'A human agent has been notified and will review your session shortly.',
        });
        setShowEscalateDialog(false);
        setEscalateContactInfo('');
        setEscalateShowJson(false);
      }
    } catch {
      toast({
        title: 'Escalation Failed',
        description: 'Could not create support ticket. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const formattedStartTime = startTime.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={isFullScreen ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
            animate={isFullScreen ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={isFullScreen ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            data-theme={chatTheme}
            className={cn(
              'chat-widget fixed z-50 flex flex-col bg-[hsl(var(--widget-bg))] shadow-2xl overflow-hidden',
              isFullScreen ? 'inset-0 rounded-none' : 'bottom-6 right-6 rounded-2xl border border-[hsl(var(--widget-border))]',
            )}
            style={!isFullScreen ? { width: 400, height: 560 } : undefined}
          >
            <TooltipProvider delayDuration={200}>
            <div className="flex items-center justify-between px-4 py-3 bg-[hsl(var(--widget-card))] border-b border-[hsl(var(--widget-border))]">
              <div className="flex items-center gap-3 min-w-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { setIsOpen(false); setIsFullScreen(false); }}
                      className="p-1 text-[hsl(var(--widget-muted))] hover:text-[hsl(var(--widget-fg))] transition-colors"
                      aria-label="Close chat"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Close chat</TooltipContent>
                </Tooltip>
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-[hsl(var(--widget-fg))] truncate flex items-center gap-1.5">
                    Started {formattedStartTime}
                    <ModeBadge
                      connected={pipe.connected}
                      pipeName={pipe.pipe?.name}
                      openClawActive={llm.openClawActive}
                      chatTheme={chatTheme}
                    />
                  </span>
                  <ReadinessPill status={llm.status} progress={llm.progress} stageLabel={llm.loadStageLabel} chatTheme={chatTheme} />
                </div>
              </div>
              <div className="flex items-center gap-1">
                {onReopenScenario && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={onReopenScenario}
                        className="p-1.5 text-[hsl(var(--widget-muted))] hover:text-[hsl(var(--widget-fg))] transition-colors"
                        aria-label="What's this demo?"
                        data-testid="button-reopen-scenario"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">What&apos;s this demo?</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowTerminalPanel(true)}
                      className="relative p-1.5 text-[hsl(var(--widget-muted))] hover:text-[hsl(var(--widget-fg))] transition-colors"
                      aria-label="Glass Engine live logs"
                      data-testid="button-terminal"
                    >
                      <Terminal className="w-4 h-4" />
                      {terminalLines.length > 0 && (
                        <span
                          className={cn(
                            "absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full text-[9px] font-bold tabular-nums flex items-center justify-center leading-none bg-emerald-500 text-black select-none",
                            isLocalGenerating && "animate-pulse",
                          )}
                        >
                          {terminalLines.length > 99 ? "99+" : terminalLines.length}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Glass Engine (live logs)</TooltipContent>
                </Tooltip>
                <ModelInfoPopover />
                <DropdownMenu>
                  {/*
                    Intentionally NOT wrapped in <Tooltip> — Radix's
                    nested asChild (TooltipTrigger > DropdownMenuTrigger)
                    has known ref-forwarding edge cases and the menu
                    opens on click anyway, making intent self-evident.
                    aria-label keeps screen-reader users covered.
                  */}
                  <DropdownMenuTrigger asChild>
                    <button
                      className="p-1.5 text-[hsl(var(--widget-muted))] hover:text-[hsl(var(--widget-fg))] transition-colors"
                      aria-label="Settings menu"
                      title="Settings"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onSelect={() => setShowKnowledgePanel(true)}>
                      <Database className="w-3.5 h-3.5 mr-2" />
                      Manage knowledge base
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setShowQaBankPanel(true)}
                      data-testid="menuitem-qa-bank"
                    >
                      <BookOpen className="w-3.5 h-3.5 mr-2" />
                      Browse Q&amp;A bank
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setShowPipePanel(true)}>
                      <Cable className="w-3.5 h-3.5 mr-2" />
                      Pipe status
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setShowOpenClawPanel(true)}
                      data-testid="menuitem-openclaw"
                    >
                      <Cpu className="w-3.5 h-3.5 mr-2" />
                      OpenClaw mode (BYO LLM)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setShowHarnessPanel(true)}
                      data-testid="menuitem-harness"
                    >
                      <ScrollText className="w-3.5 h-3.5 mr-2" />
                      Local Harness (system charter)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setShowTerminalPanel(true)}
                      data-testid="menuitem-terminal"
                    >
                      <Terminal className="w-3.5 h-3.5 mr-2" />
                      Glass Engine (live logs)
                      {terminalLines.length > 0 && (
                        <span className="ml-auto text-[10px] tabular-nums text-[hsl(var(--widget-muted))]">
                          {terminalLines.length}
                        </span>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!ticketPreviewEnabled}
                      onSelect={() => {
                        if (!ticketPreviewEnabled || !routeSlug) return;
                        navigate(`/demo/${routeSlug}/ticket`);
                      }}
                      data-testid="menuitem-ticket-preview"
                    >
                      <Ticket className="w-3.5 h-3.5 mr-2" />
                      Show what would have been escalated
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(e) => {
                        // Prevent the menu's default close-on-select so the
                        // visitor can flip themes and immediately see the
                        // result without re-opening the menu.
                        e.preventDefault();
                        setChatTheme((t) => (t === 'dark' ? 'light' : 'dark'));
                      }}
                      data-testid="menuitem-theme-toggle"
                    >
                      {chatTheme === 'dark' ? (
                        <>
                          <Sun className="w-3.5 h-3.5 mr-2" />
                          Switch to light mode
                        </>
                      ) : (
                        <>
                          <Moon className="w-3.5 h-3.5 mr-2" />
                          Switch to dark mode
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleEscalate}
                      disabled={escalateMutation.isPending}
                      className="p-1.5 text-[hsl(var(--widget-muted))] hover:text-[hsl(var(--widget-fg))] transition-colors"
                      aria-label="Send transcript to a human"
                      data-testid="button-escalate"
                    >
                      {escalateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <PhoneCall className="w-4 h-4" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Send transcript to a human (preview first)
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setIsFullScreen(!isFullScreen)}
                      className="p-1.5 text-[hsl(var(--widget-muted))] hover:text-[hsl(var(--widget-fg))] transition-colors"
                      aria-label={isFullScreen ? 'Exit full screen' : 'Enter full screen'}
                    >
                      {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {isFullScreen ? 'Exit full screen' : 'Enter full screen'}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            </TooltipProvider>

            <AnimatePresence>
              {hasSecurityAlertSession && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="bg-red-600 overflow-hidden shrink-0"
                >
                  <div className="px-4 py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-white text-xs font-medium">
                      <AlertOctagon className="w-3.5 h-3.5 animate-pulse" />
                      <span>Account Compromise Detected</span>
                    </div>
                    <button
                      onClick={() => setShowSecurityPanel(true)}
                      className="text-xs font-bold text-white bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors"
                    >
                      Secure Now
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {llm.bundleProgress && !llm.bundleProgress.done && (
              <div className="bg-[hsl(var(--widget-card))] border-b border-[hsl(var(--widget-border))] px-4 py-2 text-xs text-[hsl(var(--widget-fg))] leading-relaxed shrink-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-500 dark:text-emerald-400" />
                    Loading {bundleLabel ?? 'Bitcoin knowledge bundle'} into your browser…
                  </span>
                  <span className="tabular-nums text-[hsl(var(--widget-muted))]">
                    {llm.bundleProgress.done_chunks}/{llm.bundleProgress.total_chunks}
                  </span>
                </div>
                <div className="h-1 bg-[hsl(var(--widget-muted))]/20 rounded overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{
                      width: `${
                        llm.bundleProgress.total_chunks > 0
                          ? Math.min(
                              100,
                              Math.round(
                                (llm.bundleProgress.done_chunks /
                                  llm.bundleProgress.total_chunks) *
                                  100,
                              ),
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}

            {llm.status === 'unsupported' && (
              <div className="bg-sky-900/30 border-b border-sky-700/40 px-4 py-2 text-xs text-sky-200 leading-relaxed shrink-0">
                Your browser doesn't support local AI &mdash; using cloud mode.
                {' '}
                <a
                  href="https://caniuse.com/webgpu"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline hover:text-white"
                >
                  Why?
                </a>
              </div>
            )}

            <div
              className="flex-1 overflow-y-auto p-4"
              role="log"
              aria-live="polite"
              aria-label="Conversation transcript"
            >
              <div className={cn(isFullScreen ? 'max-w-3xl mx-auto' : '')}>
                {/*
                  Per-persona compliance disclaimer banner. Rendered as
                  the first transcript entry so it lives where the
                  visitor's eye already is, dismissible per session,
                  announced as `role="status"`. Honesty rules + per-
                  persona copy live in `data/disclaimers.ts`.
                */}
                {personaSlug && (
                  <DisclaimerBanner personaSlug={personaSlug} />
                )}
                {messages.map((msg, idx) => {
                  // The preceding user message is what the visitor
                  // actually asked — needed for the feedback row so
                  // the admin export shows "what they asked → what
                  // we replied → thumbs". Walk backwards from the
                  // current bot turn to find it.
                  let precedingUser: string | undefined;
                  if (msg.role === 'bot') {
                    for (let i = idx - 1; i >= 0; i--) {
                      if (messages[i].role === 'user') {
                        precedingUser = messages[i].content;
                        break;
                      }
                    }
                  }
                  return (
                    <ChatMessage
                      key={msg.id}
                      {...msg}
                      compact={!isFullScreen}
                      sessionId={sessionId}
                      personaSlug={personaSlug}
                      precedingUserMessage={precedingUser}
                      onBrowseKb={
                        msg.isHardRefusal
                          ? () => setShowQaBankPanel(true)
                          : undefined
                      }
                      onContact={
                        msg.isHardRefusal ? openContact : undefined
                      }
                      onRephrase={
                        msg.isHardRefusal
                          ? () => {
                              // Pre-fill the input with the visitor's
                              // last question so they can edit it
                              // instead of retyping from scratch.
                              if (precedingUser) {
                                setInput(precedingUser);
                              }
                              inputRef.current?.focus();
                            }
                          : undefined
                      }
                    />
                  );
                })}

                {/* Gear-menu hint — rendered only in the empty state
                    so first-time visitors discover the settings menu
                    where the depth lives (Q&A bank, OpenClaw BYO LLM,
                    support-ticket export, theme toggle). Disappears
                    after the first user turn. */}
                {realTurns.length === 0 && (
                  <div
                    className="mt-2 mx-1 flex items-start gap-2 rounded-md border border-[hsl(var(--widget-border))] bg-[hsl(var(--widget-card))] px-3 py-2 text-xs leading-snug text-[hsl(var(--widget-muted))]"
                    data-testid="empty-state-gear-hint"
                  >
                    <Settings className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                    <span>
                      Tap the <span className="font-semibold text-[hsl(var(--widget-fg))]">gear</span>{" "}
                      for the Q&amp;A bank, support-ticket export, BYO-LLM (OpenClaw), and the Local Harness system charter.
                    </span>
                  </div>
                )}

                {/* Suggested-prompt chips — rendered only in the empty
                    state (no real turns yet) so they don't clutter
                    the transcript once the conversation starts. */}
                {realTurns.length === 0 && suggestedPrompts && suggestedPrompts.length > 0 && (
                  <div
                    className="mt-2 flex flex-wrap gap-2 px-1"
                    data-testid="suggested-prompts"
                  >
                    <span className="w-full text-xs tracking-wide text-[hsl(var(--widget-muted))] mb-1">
                      Try asking
                    </span>
                    {suggestedPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => {
                          // Send the chip text directly. handleSend takes
                          // an optional override so we don't have to wait
                          // for the controlled input to round-trip
                          // through state — the previous rAF approach
                          // raced against React's batching and dropped
                          // sends in production builds.
                          void handleSend(prompt);
                        }}
                        disabled={isPending}
                        className="text-xs px-3 py-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-500/20 hover:border-emerald-500/60 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                        data-testid={`button-suggested-prompt-${prompt.slice(0, 16).replace(/\W+/g, '-').toLowerCase()}`}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}

                {isPending && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex w-full gap-3 mb-4 justify-start"
                  >
                    <div className="w-7 h-7 rounded-full bg-emerald-600/20 border border-emerald-600/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-emerald-400 animate-pulse" />
                    </div>
                    <div className="px-4 py-3 bg-[hsl(var(--widget-card))] border border-[hsl(var(--widget-border))] rounded-2xl rounded-tl-sm flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-emerald-500/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-emerald-500/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-emerald-500/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} className="h-2" />
              </div>
            </div>

            <div className="px-4 py-3 border-t border-[hsl(var(--widget-border))] bg-[hsl(var(--widget-card))]">
              {pipe.effectiveBiasOptions.length > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] tracking-wide text-[hsl(var(--widget-muted))] shrink-0">
                    {pipe.biasSource === 'pipe' ? 'Perspective' : 'Audience'}
                  </span>
                  <BiasToggle
                    options={pipe.effectiveBiasOptions}
                    activeId={pipe.activeBiasId}
                    onChange={handleBiasChange}
                    disabled={isPending}
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="p-2 text-[hsl(var(--widget-muted))]">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder ?? 'Type a message'}
                    className="w-full bg-transparent border-none resize-none focus:outline-none focus:ring-0 text-[hsl(var(--widget-fg))] text-sm placeholder:text-[hsl(var(--widget-muted))] py-1 max-h-40 overflow-y-auto leading-snug"
                    rows={1}
                  />
                </div>
                <button
                  onClick={() => void handleSend()}
                  disabled={!input.trim() || isPending}
                  className="p-2 text-emerald-400 hover:text-emerald-300 disabled:text-[hsl(var(--widget-muted))] disabled:opacity-50 transition-colors"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="text-center mt-1 text-[9px] text-[hsl(var(--widget-muted))] opacity-60">
                {llm.status === 'ready' ? 'Local inference · WebGPU · message content stays in-browser' : 'Powered by Greater'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#01a9f4] hover:bg-[#0394d8] text-white shadow-xl flex items-center justify-center transition-colors border border-white/15"
            aria-label="Open chat"
          >
            <MessageSquare className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {isOpen && (
        <AnimatePresence>
          {isOpen && !isFullScreen && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed bottom-6 right-6 z-[49] w-14 h-14 rounded-full bg-[#01a9f4] hover:bg-[#0394d8] text-white shadow-xl flex items-center justify-center transition-colors border border-white/15"
              style={{ transform: 'translateY(580px)' }}
              aria-label="Close chat"
            >
              <ChevronDown className="w-6 h-6" />
            </motion.button>
          )}
        </AnimatePresence>
      )}

      <SecurityPanel
        isOpen={showSecurityPanel}
        onClose={() => setShowSecurityPanel(false)}
      />

      <KnowledgePanel
        isOpen={showKnowledgePanel}
        onClose={() => setShowKnowledgePanel(false)}
        personaSlug={personaSlug}
        onImportHarnesses={(harnesses) => {
          const slug = personaSlug ?? "default";
          const text =
            harnesses[slug] ??
            harnesses["__global__"] ??
            Object.values(harnesses)[0] ??
            "";
          if (text) {
            setImportedHarnessText(text);
            setShowKnowledgePanel(false);
            setShowHarnessPanel(true);
          }
        }}
      />

      <QaBankPanel
        isOpen={showQaBankPanel}
        onClose={() => setShowQaBankPanel(false)}
        personaSlug={personaSlug}
        sessionId={sessionId}
        onAskQuestion={(q) => { void handleSend(q); }}
      />

      <PipeStatusPanel
        isOpen={showPipePanel}
        onClose={() => setShowPipePanel(false)}
      />

      <OpenClawPanel
        isOpen={showOpenClawPanel}
        onClose={() => setShowOpenClawPanel(false)}
      />

      <HarnessPanel
        isOpen={showHarnessPanel}
        onClose={() => setShowHarnessPanel(false)}
        personaSlug={personaSlug ?? "default"}
        onHarnessChange={setHarnessText}
        importedText={importedHarnessText}
        onImportedTextConsumed={() => setImportedHarnessText("")}
      />

      <TerminalPanel
        isOpen={showTerminalPanel}
        onClose={() => setShowTerminalPanel(false)}
        lines={terminalLines}
        isActive={isLocalGenerating}
        onClear={() => {
          terminalLinesRef.current = [];
          setTerminalLines([]);
        }}
      />

      {/*
        Escalation preview dialog. Replaces the prior fire-immediately
        behavior on the phone-icon click. The whole point of Greater is
        that message content stays in the visitor's browser; the
        moment they click "send to a human" we have to break that
        guarantee, so the visitor needs to see exactly what's about
        to leave their machine — including the ability to inspect the
        raw JSON payload — and explicitly opt in. We also offer (but
        do not require) an optional contact field so the responding
        human knows where to reach back; without it, the company sees
        an anonymous transcript and a session id only.
      */}
      <Dialog
        open={showEscalateDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowEscalateDialog(false);
            setEscalateShowJson(false);
          }
        }}
      >
        <DialogContent
          className="max-w-2xl max-h-[85vh] flex flex-col"
          data-testid="dialog-escalate-preview"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-primary" />
              Send transcript to a human?
            </DialogTitle>
            <DialogDescription>
              Until now, every message in this chat has stayed in your
              browser. Sending will transmit the full transcript below
              to the support team — review it first, redact anything
              sensitive by editing the chat or starting over, and
              optionally tell us how to reach you.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground">
                  Transcript ({messages.length} {messages.length === 1 ? 'message' : 'messages'})
                </span>
                <button
                  type="button"
                  onClick={() => setEscalateShowJson((v) => !v)}
                  className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-toggle-escalate-json"
                >
                  <Code2 className="w-3 h-3" />
                  {escalateShowJson ? 'Hide raw JSON' : 'Show raw JSON'}
                </button>
              </div>
              {escalateShowJson ? (
                <pre className="text-xs font-mono bg-background border border-border rounded p-2 overflow-x-auto max-h-64 whitespace-pre-wrap break-all">
                  {JSON.stringify(buildEscalationPayload(), null, 2)}
                </pre>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {messages.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      (No messages yet — escalating now would only send
                      the session id and your contact, if provided.)
                    </p>
                  ) : (
                    messages.map((m, i) => (
                      <div
                        key={i}
                        className="text-xs border-l-2 pl-2"
                        style={{
                          borderColor:
                            m.role === 'user'
                              ? 'hsl(var(--primary))'
                              : 'hsl(var(--muted-foreground) / 0.4)',
                        }}
                      >
                        <span className="font-semibold tracking-wide opacity-70">
                          {m.role === 'user' ? 'You' : 'Bot'}
                        </span>
                        <p className="whitespace-pre-wrap mt-0.5">{m.content}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="escalate-contact"
                className="text-xs font-semibold tracking-wide text-muted-foreground flex items-center gap-1 mb-1.5"
              >
                <Mail className="w-3 h-3" />
                How can we reach you? (optional)
              </label>
              <Input
                id="escalate-contact"
                type="text"
                placeholder="email, username, or however you prefer"
                value={escalateContactInfo}
                onChange={(e) => setEscalateContactInfo(e.target.value)}
                data-testid="input-escalate-contact"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Leave blank to send anonymously — the team will see the
                transcript and a session id only.
              </p>
            </div>

            {hasSecurityAlertSession && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
                <strong>This will be flagged URGENT</strong> because a
                possible-compromise alert is active in this session.
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowEscalateDialog(false);
                setEscalateShowJson(false);
              }}
              data-testid="button-escalate-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmEscalate}
              disabled={escalateMutation.isPending}
              data-testid="button-escalate-confirm"
            >
              {escalateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <PhoneCall className="w-4 h-4 mr-2" />
                  Send to support
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Mode indicator next to the session-start timestamp. Tells the user
 * at a glance whether they're talking to the FOSS shell on its own
 * (Generic) or the shell amplified by a curated Pipe (Greater).
 */
function ModeBadge({
  connected,
  pipeName,
  openClawActive,
  chatTheme,
}: {
  connected: boolean;
  pipeName?: string;
  openClawActive: boolean;
  chatTheme: 'dark' | 'light';
}) {
  // Widget theme is controlled by `data-theme` on the widget root,
  // NOT by Tailwind's document-level `.dark` class — so a `dark:`
  // modifier here would key off the wrong source of truth. Pick the
  // per-mode text/chevron pair explicitly from `chatTheme`. The 200
  // tints render as near-invisible on the pale light surface; the 700
  // tints pass WCAG AA against the matching tinted background.
  const isDark = chatTheme === 'dark';
  if (openClawActive) {
    return (
      <span
        className={cn(
          'chb-chat-pill',
          isDark ? 'text-violet-300' : 'text-violet-700',
        )}
        title="OpenClaw mode — chat is being served by your own OpenAI-compatible endpoint. Greater is not making any cloud calls."
        data-testid="badge-mode"
      >
        OpenClaw mode
      </span>
    );
  }
  if (connected) {
    return (
      <span
        className={cn(
          'chb-chat-pill',
          isDark ? 'text-pink-300' : 'text-pink-700',
        )}
        title={
          pipeName
            ? `Greater mode · ${pipeName} — running with a curated Pipe loaded from data/pipes/. The shell is FOSS; the Pipe is the part that's for hire.`
            : 'Greater mode — running with a curated Pipe loaded from data/pipes/. The shell is FOSS; the Pipe is the part that\u2019s for hire.'
        }
        data-testid="badge-mode"
      >
        Greater mode
      </span>
    );
  }
  return (
    <span
      className="chb-chat-pill text-[hsl(var(--widget-muted))]"
      title="Generic mode — no Pipe is loaded for this demo. The FOSS shell runs honestly without one; mounting a Pipe under data/pipes/ unlocks Greater mode for this persona."
      data-testid="badge-mode"
    >
      Generic mode
    </span>
  );
}

/**
 * Pill that reflects the LLM provider's current status. Spec wording:
 *   - "Spooling local AI…" during download
 *   - "Local AI ready" once warm
 *   - "Cloud mode" on unsupported browsers
 */
function ReadinessPill({
  status,
  progress,
  stageLabel,
  chatTheme,
}: {
  status: ModelStatus;
  progress: number;
  stageLabel: string;
  chatTheme: 'dark' | 'light';
}) {
  // Widget theme is controlled by `data-theme` on the widget root,
  // NOT by Tailwind's document-level `.dark` class — so a `dark:`
  // modifier here would key off the wrong source of truth and the
  // pill colour would invert relative to the surface it sits on.
  // Pick the per-status pair explicitly from `chatTheme`.
  const isDark = chatTheme === 'dark';
  let label = '';
  let color = 'text-[hsl(var(--widget-muted))]';
  let icon: React.ReactNode = <CircleDashed className="w-3 h-3" />;

  if (status === 'ready') {
    label = 'Local AI ready';
    // Friend-review feedback: text-emerald-400 was unreadable on the
    // light widget background. Light variant (700) passes WCAG AA on
    // white; dark variant keeps the original glow.
    color = isDark ? 'text-emerald-400' : 'text-emerald-700';
    icon = <ShieldCheck className="w-3 h-3" />;
  } else if (status === 'unsupported') {
    label = 'Cloud mode';
    color = isDark ? 'text-sky-300' : 'text-sky-700';
  } else if (status === 'error') {
    label = 'Cloud mode (local AI failed)';
    color = isDark ? 'text-amber-400' : 'text-amber-700';
  } else if (status === 'idle') {
    label = 'Preparing local AI…';
  } else {
    const pct = progress >= 0 && progress <= 100 ? ` ${Math.round(progress)}%` : '';
    const stageHint = stageLabel ? ` · ${stageLabel}` : '';
    label = `Spooling local AI…${pct}${stageHint}`;
    icon = <Loader2 className="w-3 h-3 animate-spin" />;
  }

  return (
    <span
      className={cn('chb-chat-meta inline-flex items-center gap-1.5 truncate', color)}
      data-testid="status-llm-pill"
      title={label}
    >
      {icon}
      <span className="truncate">{label}</span>
    </span>
  );
}
