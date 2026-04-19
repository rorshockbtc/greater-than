import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, User, AlertTriangle, FileText, ShieldCheck, Cloud, Brain, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
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
}: MessageProps) {
  const isBot = role === 'bot';
  const { toast } = useToast();
  const [traceOpen, setTraceOpen] = useState(false);

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
              <SourceBadge source={responseSource} cloudReason={cloudReason} />
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
              ? renderWithCitations(content, thoughtTrace.chunks)
              : content}
          </div>
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
              <div className="mt-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]/50 p-3 space-y-3">
                <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                  {thoughtTrace.reasoning}
                </p>
                <ol className="space-y-2 text-[12px]">
                  {thoughtTrace.chunks.map((c, i) => (
                    <li key={c.id} className="border-l-2 border-emerald-500/40 pl-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          [{i + 1}] sim {c.score.toFixed(3)}
                        </span>
                        <a
                          href={c.page_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-emerald-400 hover:underline"
                        >
                          {c.page_label}
                          <ExternalLink className="w-3 h-3" />
                        </a>
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
function renderWithCitations(text: string, chunks: RetrievedChunk[]): React.ReactNode[] {
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
                <a
                  href={c.page_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={c.page_label}
                  className="text-emerald-400 hover:text-emerald-300 hover:underline font-medium"
                  data-testid={`link-citation-${n}`}
                >
                  [{n}]
                </a>
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

function SourceBadge({
  source,
  cloudReason,
}: {
  source: ResponseSource;
  cloudReason?: CloudReason;
}) {
  if (source === "local") {
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
