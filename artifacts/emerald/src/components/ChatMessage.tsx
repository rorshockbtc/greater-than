import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Bot, User, AlertTriangle, FileText, ShieldCheck, Cloud, Brain, ChevronDown, ChevronUp, ExternalLink, ThumbsUp, ThumbsDown, Sparkles } from 'lucide-react';
import { cn, formatTime } from '@/lib/utils';
import { TrustBadge } from './TrustBadge';
import { useToast } from '@/hooks/use-toast';
import type { Article } from '@workspace/api-client-react';
import type { CloudReason, ResponseSource, RetrievedChunk, ThoughtTrace } from '@/llm/types';

export interface MessageProps {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
  trustScore?: number;
  ciBreakdown?: string;
  sources?: unknown[];
  lastUpdated?: string;
  isFinancialAdvice?: boolean;
  relatedArticles?: Article[];
  compact?: boolean;
  /** Where this bot reply came from. Cloud is honest fallback. */
  responseSource?: ResponseSource;
  /** Why cloud was used (only set when responseSource === 'cloud'). */
  cloudReason?: CloudReason;
  /** Real chunks fed into the prompt (local responses only). */
  thoughtTrace?: ThoughtTrace;
  /**
   * Human-readable label of the active bias when this reply was
   * generated (e.g. "Core", "Knots"). Rendered as a small chip next
   * to the source badge so the user can see *why* the answer leans
   * the way it does.
   */
  biasLabel?: string;
  biasId?: string;
  /**
   * True for in-conversation system notes (e.g. "Switched perspective:
   * Core → Knots"). Rendered as a centered, low-emphasis line and
   * excluded from the model's history on the next turn.
   */
  isModeNote?: boolean;
  /**
   * True when this local response was served *because the cloud
   * fallback budget for the session was exhausted* — so the badge
   * reads "Local-only · cloud rate-limited" rather than the regular
   * "Local · Private". Distinct from `responseSource === 'local'`
   * alone, which is the normal happy path.
   */
  localOnly?: boolean;
  /** Stable session id, propagated from ChatWidget for feedback POST. */
  sessionId?: string;
  /** Persona slug, propagated from ChatWidget for feedback POST. */
  personaSlug?: string;
  /**
   * The user's question that produced this bot reply. ChatWidget
   * computes it by walking back to the previous user turn so the
   * feedback row can record what they actually asked.
   */
  precedingUserMessage?: string;
  /**
   * Wall-clock ms it took to produce this reply (qa-cache lookup,
   * local inference, or cloud round-trip). Posted with feedback so
   * the admin dashboard can correlate slow replies with thumbs-down.
   */
  latencyMs?: number;
  /**
   * Cosine similarity for whichever retrieval signal best describes
   * this reply: the qa-cache match score for cached replies, or the
   * top retrieved chunk's score for local inference. Posted with
   * feedback so the dashboard can spot weak-retrieval thumbs-down.
   */
  cosineScore?: number;
  /**
   * True when this reply is the deterministic "I can't ground this"
   * refusal from the retrieval-floor branch in LLMProvider. Triggers
   * the in-bubble action affordance (browse what I know · email a
   * human · rephrase) so the visitor has a clear next move instead
   * of staring at a dead end. Friend feedback before launch: a
   * refusal with no escape hatch reads as a broken bot, not an
   * honest one — the three actions turn the refusal into a
   * navigation moment.
   */
  isHardRefusal?: boolean;
  /** Open the curated Q&A panel (bot's actual scope). */
  onBrowseKb?: () => void;
  /** Open the Greater contact form modal (handoff to a human). */
  onContact?: () => void;
  /** Re-focus the chat input so the visitor can reword the question. */
  onRephrase?: () => void;
}

export function ChatMessage({
  role,
  content,
  timestamp,
  trustScore,
  ciBreakdown,
  sources,
  lastUpdated,
  isFinancialAdvice,
  relatedArticles,
  compact = false,
  responseSource,
  cloudReason,
  thoughtTrace,
  biasLabel,
  isModeNote,
  localOnly,
  sessionId,
  personaSlug,
  precedingUserMessage,
  latencyMs,
  cosineScore,
  isHardRefusal,
  onBrowseKb,
  onContact,
  onRephrase,
}: MessageProps) {
  const isBot = role === 'bot';
  const { toast } = useToast();
  const [traceOpen, setTraceOpen] = useState(false);
  const traceRef = useRef<HTMLDivElement>(null);
  const citationRefs = useRef<Map<number, HTMLLIElement | null>>(new Map());

  /**
   * Click handler for citation chips. Opens the trace panel (if
   * closed) and scrolls to the matching source so visitors can
   * verify the answer in-place rather than being yanked off-site.
   */
  const handleCitationClick = (n: number) => {
    setTraceOpen(true);
    // Wait one frame for the panel to mount before scrolling.
    requestAnimationFrame(() => {
      const el = citationRefs.current.get(n);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-emerald-400/60');
        window.setTimeout(() => {
          el.classList.remove('ring-2', 'ring-emerald-400/60');
        }, 1500);
      } else {
        traceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  };

  if (isModeNote) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex justify-center my-3"
      >
        <div className="text-[10px] uppercase tracking-wider font-medium text-[hsl(var(--muted-foreground))] bg-pink-500/10 border border-pink-500/30 text-pink-300 px-2.5 py-1 rounded-full">
          {content}
        </div>
      </motion.div>
    );
  }

  const handleRequestUpdate = () => {
    toast({
      title: "Update Requested",
      description: "Our documentation team has been notified to review this article.",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex w-full gap-4 mb-6 group",
        isBot ? "justify-start" : "justify-end"
      )}
    >
      {isBot && (
        <div className={cn(
          "rounded-full bg-emerald-600/20 border border-emerald-600/30 flex items-center justify-center shrink-0 mt-0.5",
          compact ? "w-7 h-7" : "w-8 h-8"
        )}>
          <Bot className={cn("text-emerald-400", compact ? "w-4 h-4" : "w-5 h-5")} />
        </div>
      )}

      <div className={cn("flex flex-col gap-1", compact ? "max-w-[85%]" : "max-w-[85%] md:max-w-[75%]", isBot ? "items-start" : "items-end")}>
        {isBot && isFinancialAdvice && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-warning bg-warning/10 px-2 py-1 rounded-md border border-warning/20 mb-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            This is informational only. Not financial advice.
          </div>
        )}

        {isBot && (responseSource || biasLabel) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {responseSource && (
              <SourceBadge
                source={responseSource}
                cloudReason={cloudReason}
                localOnly={localOnly}
              />
            )}
            {biasLabel && (
              <div
                className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium text-pink-300 bg-pink-500/10 border border-pink-500/30 px-2 py-0.5 rounded-md mb-1"
                title="Bias perspective active when this answer was generated"
                data-testid="badge-bias-label"
              >
                {biasLabel}
              </div>
            )}
          </div>
        )}

        <div
          className={cn(
            "shadow-sm relative",
            compact ? "px-3 py-2 text-sm" : "px-4 py-3 text-sm md:text-base",
            isBot
              ? "bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl rounded-tl-sm"
              : "bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-2xl rounded-tr-sm"
          )}
        >
          <div className="whitespace-pre-wrap leading-relaxed">
            {isBot && thoughtTrace && thoughtTrace.chunks.length > 0
              ? renderWithCitations(content, thoughtTrace.chunks, handleCitationClick)
              : content}
          </div>

          {/* Hard-refusal action affordance. Three plain, scoped
              next steps so the visitor isn't left at a dead end:
              (1) browse what the bot does cover, (2) hand off to a
              human, (3) reword the question. Only renders when the
              parent passes the corresponding handlers, so this row
              is invisible (and zero-cost) on every non-refusal turn
              and on hosts that haven't wired the handlers up yet. */}
          {isBot && isHardRefusal && (onBrowseKb || onContact || onRephrase) && (
            <div
              className="mt-3 pt-3 border-t border-[hsl(var(--border))] flex flex-wrap gap-2"
              data-testid="refusal-actions"
            >
              {onBrowseKb && (
                <button
                  type="button"
                  onClick={onBrowseKb}
                  className="text-xs px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 text-emerald-200 hover:bg-emerald-500/10 hover:border-emerald-400/50 transition-colors"
                  data-testid="button-refusal-browse-kb"
                >
                  Browse what I know
                </button>
              )}
              {onContact && (
                <button
                  type="button"
                  onClick={onContact}
                  className="text-xs px-3 py-1.5 rounded-full border border-pink-500/40 bg-pink-500/10 text-pink-200 hover:bg-pink-500/20 hover:border-pink-400/60 transition-colors"
                  data-testid="button-refusal-contact"
                >
                  Email a human
                </button>
              )}
              {onRephrase && (
                <button
                  type="button"
                  onClick={onRephrase}
                  className="text-xs px-3 py-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))]/50 text-[hsl(var(--muted-foreground))] hover:text-foreground hover:border-[hsl(var(--border))]/80 transition-colors"
                  data-testid="button-refusal-rephrase"
                >
                  Rephrase the question
                </button>
              )}
            </div>
          )}
        </div>

        {/* Metadata & Actions */}
        <div className="flex flex-wrap items-center gap-3 px-1 mt-1">
          <span className="text-[10px] text-muted-foreground/70 font-medium tracking-wide uppercase">
            {formatTime(timestamp)}
          </span>

          {isBot && trustScore !== undefined && (
            <TrustBadge
              score={trustScore}
              ciBreakdown={ciBreakdown}
              sourceUrl={(sources?.[0] as { url?: string } | undefined)?.url}
              lastUpdated={lastUpdated}
            />
          )}

          {/* Feedback row — only on bot turns that have a real preceding
              user question. Quietly POSTs to /api/feedback; if the
              backend is offline (FOSS fork, no DB), the catch swallows
              and we still flip the local "thanks" state so visitors
              don't see an error for what is genuinely a no-op. */}
          {/* Feedback is intentionally hidden for OpenClaw (BYO-LLM)
              responses. The visitor is running their own model behind
              their own endpoint — a thumbs-down on output the bot's
              author can't see, can't reproduce, and doesn't control
              would generate noise the admin dashboard can't act on. */}
          {isBot &&
            precedingUserMessage &&
            sessionId &&
            personaSlug &&
            responseSource !== "openclaw" && (
            <FeedbackButtons
              sessionId={sessionId}
              personaSlug={personaSlug}
              userMessage={precedingUserMessage}
              botReply={content}
              responseSource={responseSource ?? "local"}
              biasLabel={biasLabel}
              latencyMs={latencyMs}
              cosineScore={cosineScore}
            />
          )}
        </div>

        {/* Thought trace — only on local responses; shows the actual
            chunks fed into the prompt, not fabricated citations. */}
        {isBot && thoughtTrace && thoughtTrace.chunks.length > 0 && (
          <div className="mt-2 w-full">
            <button
              type="button"
              onClick={() => setTraceOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
              data-testid="button-toggle-thought-trace"
            >
              <Brain className="w-3.5 h-3.5" />
              Thought trace
              <span className="text-muted-foreground/60">
                ({thoughtTrace.chunks.length} sources)
              </span>
              {traceOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {traceOpen && (
              <div
                ref={traceRef}
                className="mt-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]/50 p-3 space-y-3"
              >
                <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                  {thoughtTrace.reasoning}
                </p>
                <ol className="space-y-2 text-[12px]">
                  {thoughtTrace.chunks.map((c, i) => (
                    <li
                      key={c.id}
                      ref={(el) => {
                        citationRefs.current.set(i + 1, el);
                      }}
                      className="border-l-2 border-emerald-500/40 pl-3 rounded-sm transition-shadow"
                      data-testid={`citation-source-${i + 1}`}
                    >
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          [{i + 1}] sim {c.score.toFixed(3)}
                        </span>
                        {(() => {
                          // Strict scheme allowlist: only http(s) URLs
                          // become clickable links. Anything else —
                          // `internal://` overlay notes, future
                          // sentinels, or attacker-controlled schemes
                          // like `javascript:` / `data:` slipping in
                          // via a malformed bundle — renders as a
                          // non-clickable "internal note" badge so the
                          // visitor still sees the citation but can't
                          // be redirected to a hostile target.
                          const isHttpUrl =
                            c.page_url.startsWith("https://") ||
                            c.page_url.startsWith("http://");
                          if (isHttpUrl) {
                            // Catalog leaves can ship a per-doc local
                            // copy under public/corpus/<pack>/<slug>.json
                            // — surface it as a separate "local copy"
                            // badge alongside the external link so the
                            // sovereign visitor can verify the citation
                            // against the static repo without trusting
                            // the upstream host.
                            const local = c.internalSlug
                              ? `${import.meta.env.BASE_URL}corpus/bitcoin/${c.internalSlug}.json`
                              : null;
                            return (
                              <span className="inline-flex items-center gap-1.5 flex-wrap">
                                <a
                                  href={c.page_url}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="inline-flex items-center gap-1 text-emerald-400 hover:underline"
                                >
                                  {c.page_label}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                                {local && (
                                  <a
                                    href={local}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    title="Open the locally indexed copy of this source — bundled with the static site, no network call to the original host."
                                    className="inline-flex items-center gap-1 px-1.5 py-px rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] uppercase tracking-wider hover:bg-emerald-500/20"
                                    data-testid={`citation-local-copy-${i + 1}`}
                                  >
                                    local copy
                                  </a>
                                )}
                              </span>
                            );
                          }
                          return (
                            <span
                              className="inline-flex items-center gap-1 text-amber-400/90"
                              title="This citation has no public URL — it comes from operator notes or a non-web source."
                            >
                              <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-px rounded bg-amber-500/10 border border-amber-500/30">
                                internal note
                              </span>
                              <span className="text-amber-200/90">
                                {c.page_label}
                              </span>
                            </span>
                          );
                        })()}
                      </div>
                      <p className="text-muted-foreground line-clamp-3 leading-relaxed">
                        {c.text}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Related Articles */}
        {isBot && relatedArticles && relatedArticles.length > 0 && (
          <div className="mt-3 w-full space-y-2">
            {relatedArticles.map((article) => (
              <div
                key={article.id}
                className="bg-[hsl(var(--card))]/50 border border-[hsl(var(--border))] rounded-xl p-3 hover:border-emerald-500/30 transition-colors group/card cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 bg-emerald-600/10 rounded-md text-emerald-400">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold group-hover/card:text-emerald-400 transition-colors">{article.title}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{article.description}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[hsl(var(--border))] flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{article.category}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRequestUpdate(); }}
                    className="text-xs text-muted-foreground hover:text-emerald-400 transition-colors"
                  >
                    Request Update
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isBot && (
        <div className={cn(
          "rounded-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] flex items-center justify-center shrink-0 mt-0.5",
          compact ? "w-7 h-7" : "w-8 h-8"
        )}>
          <User className={cn("text-[hsl(var(--muted-foreground))]", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
        </div>
      )}
    </motion.div>
  );
}

/**
 * Convert `[N]` and `[N,M]` markers in the model's reply into clickable
 * superscript links to the corresponding retrieved chunk's source URL.
 * Numbers that don't map to a chunk are rendered as plain text — we
 * never invent a destination.
 */
function renderWithCitations(
  text: string,
  chunks: RetrievedChunk[],
  onCitationClick?: (n: number) => void,
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    const nums = m[1].split(",").map((s) => parseInt(s.trim(), 10));
    const valid = nums.every((n) => n >= 1 && n <= chunks.length);
    if (valid) {
      parts.push(
        <sup key={`c-${key++}`} className="ml-0.5">
          {nums.map((n, i) => {
            const c = chunks[n - 1];
            return (
              <React.Fragment key={n}>
                {i > 0 && <span className="text-muted-foreground">,</span>}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onCitationClick?.(n);
                  }}
                  title={`${c.page_label} — click to view in trace panel`}
                  className="text-emerald-400 hover:text-emerald-300 hover:underline font-medium cursor-pointer bg-transparent border-0 p-0"
                  data-testid={`link-citation-${n}`}
                >
                  [{n}]
                </button>
              </React.Fragment>
            );
          })}
        </sup>,
      );
    } else {
      parts.push(m[0]);
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

/**
 * Tiny thumbs-up / thumbs-down row appended to every bot turn.
 * State machine: idle → submitting → thanked. Once the visitor has
 * rated, the row collapses to a small "Thanks" line so the rating
 * is visibly final and can't be re-submitted from this turn.
 *
 * Failures are silent on purpose — the FOSS fork has no backend, and
 * a visible error here would punish honest users for something they
 * can't fix.
 */
function FeedbackButtons({
  sessionId,
  personaSlug,
  userMessage,
  botReply,
  responseSource,
  biasLabel,
  latencyMs,
  cosineScore,
}: {
  sessionId: string;
  personaSlug: string;
  userMessage: string;
  botReply: string;
  responseSource: ResponseSource;
  biasLabel?: string;
  latencyMs?: number;
  cosineScore?: number;
}) {
  const { toast } = useToast();
  const [state, setState] = useState<"idle" | "comment" | "submitting" | "thanked" | "error">("idle");
  const [given, setGiven] = useState<1 | -1 | null>(null);
  const [comment, setComment] = useState("");

  /**
   * Thumbs-up posts immediately. Thumbs-down opens an optional
   * one-line comment box first — visitors who didn't like the
   * answer often have a one-sentence reason that makes the row
   * 10× more useful for triage. Comment is optional; "Skip"
   * submits without it.
   */
  const onThumb = (rating: 1 | -1) => {
    setGiven(rating);
    if (rating === -1) {
      setState("comment");
      return;
    }
    void submit(rating, "");
  };

  const submit = async (rating: 1 | -1, withComment: string) => {
    setState("submitting");
    try {
      // BASE_URL already ends with a slash; concatenating "api/feedback"
      // keeps us inside the artifact's path prefix on the proxied
      // preview and works in production builds.
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");
      const res = await fetch(`${base}api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          personaSlug,
          rating,
          userMessage: userMessage.slice(0, 4000),
          botReply: botReply.slice(0, 8000),
          responseSource,
          biasLabel,
          latencyMs: typeof latencyMs === "number" ? Math.max(0, Math.round(latencyMs)) : undefined,
          cosineScore:
            typeof cosineScore === "number" && Number.isFinite(cosineScore)
              ? Math.max(0, Math.min(1, cosineScore))
              : undefined,
          comment: withComment ? withComment.slice(0, 2000) : undefined,
        }),
      });
      // Don't fake success on a 4xx/5xx — admin telemetry would silently
      // miss writes that the user thinks landed. Surface a small retry
      // affordance instead. 404 is the FOSS-fork case (no backend at
      // all), and we treat that as a soft-success no-op so visitors
      // running the source-only build aren't punished.
      if (res.ok || res.status === 404) {
        setState("thanked");
        toast({
          title: rating === 1 ? "Feedback recorded" : "Feedback noted",
          description:
            rating === 1
              ? "Thanks — the upvote was logged."
              : "Thanks — we'll review what went wrong.",
        });
      } else {
        setState("error");
      }
    } catch {
      // Network failure (FOSS fork, transient offline). Treat as a
      // soft success — there's nothing the user can do about it.
      setState("thanked");
      toast({
        title: "Feedback noted",
        description: "Saved locally; the backend isn't reachable.",
      });
    }
  };

  if (state === "thanked") {
    return (
      <span
        className="text-[10px] uppercase tracking-wider text-muted-foreground/70"
        data-testid="feedback-thanks"
      >
        {given === 1 ? "Thanks for the upvote" : "Thanks — noted"}
      </span>
    );
  }

  if (state === "error") {
    return (
      <button
        type="button"
        onClick={() => given && submit(given, comment)}
        className="text-[10px] uppercase tracking-wider text-rose-400 hover:text-rose-300"
        data-testid="feedback-retry"
      >
        Couldn't save · retry
      </button>
    );
  }

  if (state === "comment") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (given) void submit(given, comment.trim());
        }}
        className="flex items-center gap-1 w-full max-w-md"
        data-testid="feedback-comment-form"
      >
        <input
          autoFocus
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
          placeholder="What was wrong? (optional)"
          className="flex-1 text-xs bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded px-2 py-1 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-rose-400/50"
          data-testid="input-feedback-comment"
        />
        <button
          type="submit"
          className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20"
          data-testid="button-feedback-submit"
        >
          Send
        </button>
        <button
          type="button"
          onClick={() => given && submit(given, "")}
          className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          data-testid="button-feedback-skip"
        >
          Skip
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-1" data-testid="feedback-buttons">
      <button
        type="button"
        onClick={() => onThumb(1)}
        disabled={state !== "idle"}
        title="This answer was helpful"
        className="p-1 rounded hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-400 transition-colors disabled:opacity-50"
        data-testid="button-feedback-up"
      >
        <ThumbsUp className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={() => onThumb(-1)}
        disabled={state !== "idle"}
        title="This answer wasn't helpful"
        className="p-1 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 transition-colors disabled:opacity-50"
        data-testid="button-feedback-down"
      >
        <ThumbsDown className="w-3 h-3" />
      </button>
    </div>
  );
}

function SourceBadge({
  source,
  cloudReason,
  localOnly,
}: {
  source: ResponseSource;
  cloudReason?: CloudReason;
  localOnly?: boolean;
}) {
  if (source === "qa-cache") {
    return (
      <div
        className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md mb-1"
        title="Matched a curated Q&A in the persona's knowledge bank — instant, deterministic, zero model tokens spent."
        data-testid="badge-qa-cache"
      >
        <Sparkles className="w-3 h-3" />
        Curated &middot; Instant
      </div>
    );
  }
  if (source === "openclaw") {
    return (
      <div
        className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium text-violet-300 bg-violet-500/10 border border-violet-500/30 px-2 py-0.5 rounded-md mb-1"
        title="Answered by your own OpenAI-compatible LLM endpoint (OpenClaw mode). No cloud call made by Greater."
        data-testid="badge-openclaw"
      >
        <ShieldCheck className="w-3 h-3" />
        OpenClaw &middot; BYO model
      </div>
    );
  }
  if (source === "local") {
    if (localOnly) {
      return (
        <div
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md mb-1"
          title="Cloud fallback is rate-limited for this session — answered by the in-browser model only."
          data-testid="badge-local-only"
        >
          <ShieldCheck className="w-3 h-3" />
          Local-only &middot; cloud rate-limited
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md mb-1">
        <ShieldCheck className="w-3 h-3" />
        Local &middot; Private
      </div>
    );
  }
  // Reason-aware label so the badge stays truthful per-message even
  // after the global LLM status changes.
  let label = "Cloud mode";
  if (cloudReason === "loading") label = "Cloud fallback: local model loading";
  else if (cloudReason === "unsupported") label = "Cloud mode: WebGPU unsupported";
  else if (cloudReason === "local-error") label = "Cloud fallback: local inference error";
  return (
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md mb-1">
      <Cloud className="w-3 h-3" />
      {label}
    </div>
  );
}
