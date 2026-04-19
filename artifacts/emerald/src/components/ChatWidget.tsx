import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Bot, Loader2, ChevronDown, Maximize2, Minimize2, ShieldCheck, PhoneCall, AlertOctagon, CircleDashed, Settings, Database, Cable, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSendMessage, useEscalateTicket } from '@workspace/api-client-react';
import { ChatMessage, type MessageProps } from './ChatMessage';
import { SecurityPanel } from './SecurityPanel';
import { KnowledgePanel } from './KnowledgePanel';
import { PipeStatusPanel } from './PipeStatusPanel';
import { BiasToggle } from './BiasToggle';
import { ModelInfoPopover } from '@/llm/ModelInfoPopover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLLM } from '@/llm/LLMProvider';
import { usePipe } from '@/pipes/PipeContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { AskOptions, Bias, ChatTurn, CloudReason, ModelStatus } from '@/llm/types';

function uuidv4() {
  return crypto.randomUUID();
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
}

export function ChatWidget({
  welcomeMessage,
  placeholder,
  bundleLabel,
  onReopenScenario,
}: ChatWidgetProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [sessionId] = useState(() => uuidv4());
  const [startTime] = useState(() => new Date());
  const [input, setInput] = useState('');
  const [showSecurityPanel, setShowSecurityPanel] = useState(false);
  const [showKnowledgePanel, setShowKnowledgePanel] = useState(false);
  const [showPipePanel, setShowPipePanel] = useState(false);
  const [hasSecurityAlertSession, setHasSecurityAlertSession] = useState(false);
  const [isLocalGenerating, setIsLocalGenerating] = useState(false);
  /**
   * Tracks whether we've already injected the "cloud is rate-limited"
   * inline notice for this widget instance. The first denied cloud
   * call shows the notice; subsequent ones silently route to local.
   */
  const cloudCapNoticeShownRef = useRef<boolean>(false);
  const [messages, setMessages] = useState<MessageProps[]>([
    {
      id: uuidv4(),
      role: 'bot',
      content:
        welcomeMessage ??
        "Hello! I'm Greater's Blockstream support bot. Ask me about Jade, Green, hardware-wallet recovery, fees, or self-custody.",
      timestamp: new Date(),
      trustScore: 0.99,
      ciBreakdown: "System initialization verified.",
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const chatMutation = useSendMessage();
  const escalateMutation = useEscalateTicket();
  const llm = useLLM();
  const pipe = usePipe();
  const activeBiasOption = pipe.pipe?.bias_options.find(
    (b) => b.id === pipe.activeBiasId,
  );

  // When the user switches bias mid-conversation, drop a small inline
  // note so the *visible transcript* explains why the next answer may
  // contradict an earlier one. The note is also added to the model's
  // history (as a system message) so the model knows its perspective
  // changed and is allowed to disagree with prior turns.
  const handleBiasChange = (nextBiasId: string) => {
    if (!pipe.pipe) return;
    if (nextBiasId === pipe.activeBiasId) return;
    const next = pipe.pipe.bias_options.find((b) => b.id === nextBiasId);
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

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const isPending = chatMutation.isPending || isLocalGenerating;

  const handleSend = async () => {
    if (!input.trim() || isPending) return;

    const userText = input.trim();
    setInput('');

    const userMsg: MessageProps = {
      id: uuidv4(),
      role: 'user',
      content: userText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Local-first when ready; cloud fallback otherwise. The label on
    // the response always says which path served it.
    if (llm.status === 'ready') {
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
      const askOptions: AskOptions | undefined = pipe.pipe
        ? {
            systemPrompt:
              pipe.pipe.system_prompts[pipe.activeBiasId] ?? undefined,
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
          }
        : undefined;
      const answer = await llm.ask(history, userText, askOptions);
      const botMsg: MessageProps = {
        id: uuidv4(),
        role: 'bot',
        content: answer.text,
        timestamp: new Date(),
        trustScore: 0.96,
        ciBreakdown: 'Local inference · WebGPU · grounded in retrieved chunks.',
        responseSource: 'local',
        thoughtTrace: answer.thoughtTrace,
        biasLabel: activeBiasOption?.label,
        biasId: pipe.pipe ? pipe.activeBiasId : undefined,
        localOnly: localOnlyDueToCap,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      // Local failed mid-conversation. If the cloud cap still has
      // room, fall back to cloud honestly; otherwise surface the
      // failure inline (we can't quietly hammer the paid endpoint
      // forever just because local crashed).
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
          content:
            'In-browser inference failed and the cloud fallback is rate-limited for this session. Please try again in a new session, or refresh to reload the local model.',
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
        content:
          'Cloud fallback is rate-limited for this session and the in-browser model is still loading. Please try again once the model finishes downloading.',
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

  const handleEscalate = async () => {
    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
      }));

      const res = await escalateMutation.mutateAsync({
        data: {
          sessionId,
          subject: hasSecurityAlertSession ? 'URGENT: Possible Account Compromise' : 'General Support Escalation',
          chatHistory: history,
        },
      });

      if (res.success) {
        toast({
          title: 'Ticket Escalated',
          description: 'A human agent has been notified and will review your session shortly.',
        });
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
            className={cn(
              'chat-widget fixed z-50 flex flex-col bg-[hsl(var(--widget-bg))] shadow-2xl overflow-hidden',
              isFullScreen ? 'inset-0 rounded-none' : 'bottom-6 right-6 rounded-2xl border border-[hsl(var(--widget-border))]',
            )}
            style={!isFullScreen ? { width: 400, height: 560 } : undefined}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-[hsl(220,13%,8%)] border-b border-[hsl(var(--widget-border))]">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => { setIsOpen(false); setIsFullScreen(false); }}
                  className="p-1 text-[hsl(var(--widget-muted))] hover:text-[hsl(var(--widget-fg))] transition-colors"
                  aria-label="Back"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-[hsl(var(--widget-fg))] truncate flex items-center gap-1.5">
                    Started {formattedStartTime}
                    <ModeBadge connected={pipe.connected} pipeName={pipe.pipe?.name} />
                  </span>
                  <ReadinessPill status={llm.status} progress={llm.progress} stageLabel={llm.loadStageLabel} />
                </div>
              </div>
              <div className="flex items-center gap-1">
                {onReopenScenario && (
                  <button
                    onClick={onReopenScenario}
                    className="p-1.5 text-[hsl(var(--widget-muted))] hover:text-[hsl(var(--widget-fg))] transition-colors"
                    title="What's this demo?"
                    aria-label="What's this demo?"
                    data-testid="button-reopen-scenario"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                )}
                <ModelInfoPopover />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="p-1.5 text-[hsl(var(--widget-muted))] hover:text-[hsl(var(--widget-fg))] transition-colors"
                      title="Settings"
                      aria-label="Settings"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onSelect={() => setShowKnowledgePanel(true)}>
                      <Database className="w-3.5 h-3.5 mr-2" />
                      Manage knowledge base
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setShowPipePanel(true)}>
                      <Cable className="w-3.5 h-3.5 mr-2" />
                      Pipe status
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button
                  onClick={handleEscalate}
                  disabled={escalateMutation.isPending}
                  className="p-1.5 text-[hsl(var(--widget-muted))] hover:text-[hsl(var(--widget-fg))] transition-colors"
                  title="Escalate to Human"
                  aria-label="Escalate to Human"
                >
                  {escalateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <PhoneCall className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="p-1.5 text-[hsl(var(--widget-muted))] hover:text-[hsl(var(--widget-fg))] transition-colors"
                  title={isFullScreen ? 'Exit Full Screen' : 'Enter Full Screen'}
                  aria-label={isFullScreen ? 'Exit Full Screen' : 'Enter Full Screen'}
                >
                  {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

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
              <div className="bg-emerald-900/30 border-b border-emerald-700/40 px-4 py-2 text-[11px] text-emerald-100 leading-relaxed shrink-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading {bundleLabel ?? 'Bitcoin knowledge bundle'} into your browser…
                  </span>
                  <span className="tabular-nums text-emerald-200/80">
                    {llm.bundleProgress.done_chunks}/{llm.bundleProgress.total_chunks}
                  </span>
                </div>
                <div className="h-1 bg-white/5 rounded overflow-hidden">
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
              <div className="bg-sky-900/30 border-b border-sky-700/40 px-4 py-2 text-[11px] text-sky-200 leading-relaxed shrink-0">
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

            <div className="flex-1 overflow-y-auto p-4">
              <div className={cn(isFullScreen ? 'max-w-3xl mx-auto' : '')}>
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} {...msg} compact={!isFullScreen} />
                ))}

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

            <div className="px-4 py-3 border-t border-[hsl(var(--widget-border))] bg-[hsl(220,13%,8%)]">
              {pipe.pipe && pipe.pipe.bias_options.length > 1 && (
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--widget-muted))]">
                    Perspective
                  </span>
                  <BiasToggle
                    options={pipe.pipe.bias_options}
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
                    className="w-full bg-transparent border-none resize-none focus:outline-none focus:ring-0 text-[hsl(var(--widget-fg))] text-sm placeholder:text-[hsl(var(--widget-muted))] py-1 max-h-20"
                    rows={1}
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isPending}
                  className="p-2 text-emerald-400 hover:text-emerald-300 disabled:text-[hsl(var(--widget-muted))] disabled:opacity-50 transition-colors"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="text-center mt-1 text-[9px] text-[hsl(var(--widget-muted))] opacity-60">
                {llm.status === 'ready' ? 'Local inference · WebGPU · no telemetry' : 'Powered by Greater'}
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
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#1a1c20] hover:bg-[#25282d] text-white shadow-xl flex items-center justify-center transition-colors border border-white/10"
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
              className="fixed bottom-6 right-6 z-[49] w-14 h-14 rounded-full bg-[#1a1c20] hover:bg-[#25282d] text-white shadow-xl flex items-center justify-center transition-colors border border-white/10"
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
      />

      <PipeStatusPanel
        isOpen={showPipePanel}
        onClose={() => setShowPipePanel(false)}
      />
    </>
  );
}

/**
 * Mode indicator next to the session-start timestamp. Tells the user
 * at a glance whether they're talking to the FOSS shell on its own
 * (Generic) or the shell amplified by a curated Pipe (Greater).
 */
function ModeBadge({ connected, pipeName }: { connected: boolean; pipeName?: string }) {
  if (connected) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider px-1.5 py-px rounded border border-pink-500/40 bg-pink-500/10 text-pink-200"
        title={
          pipeName
            ? `Greater mode · ${pipeName} — running with a curated Pipe loaded from data/pipes/. The shell is FOSS; the Pipe is the part that's for hire.`
            : 'Greater mode — running with a curated Pipe loaded from data/pipes/. The shell is FOSS; the Pipe is the part that\u2019s for hire.'
        }
        data-testid="badge-mode"
      >
        <span className="text-pink-400 font-bold">&gt;</span>
        Greater mode
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider px-1.5 py-px rounded border border-[hsl(var(--widget-border))] bg-white/5 text-[hsl(var(--widget-muted))]"
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
}: {
  status: ModelStatus;
  progress: number;
  stageLabel: string;
}) {
  let label = '';
  let color = 'text-[hsl(var(--widget-muted))]';
  let icon: React.ReactNode = <CircleDashed className="w-3 h-3" />;

  if (status === 'ready') {
    label = 'Local AI ready';
    color = 'text-emerald-400';
    icon = <ShieldCheck className="w-3 h-3" />;
  } else if (status === 'unsupported') {
    label = 'Cloud mode';
    color = 'text-sky-300';
  } else if (status === 'error') {
    label = 'Cloud mode (local AI failed)';
    color = 'text-amber-400';
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
      className={cn('flex items-center gap-1 text-[10px] uppercase tracking-wider truncate', color)}
      data-testid="status-llm-pill"
      title={label}
    >
      {icon}
      <span className="truncate">{label}</span>
    </span>
  );
}
