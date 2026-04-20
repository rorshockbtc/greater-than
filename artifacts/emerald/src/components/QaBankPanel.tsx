import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Search, Send, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

/**
 * Visitor-facing browser for the curated Q&A bank that ships with
 * each persona at `/qa-bank/<slug>.json`. Two jobs:
 *
 *  1. Browse + search the bank without having to guess at a
 *     question. Clicking a row asks the bot the question through
 *     the existing chat path so the visitor sees the cached answer
 *     in-stream (and the qa-cache hit gets recorded).
 *
 *  2. "I wish you could answer this." A short suggestion form that
 *     POSTs to `/api/suggestions`. Submissions land in the same
 *     admin feedback table with `kind="suggestion"` so the triage
 *     surface stays unified.
 *
 * The Q&A bank is fetched directly here rather than reading the
 * embedded copy that LLMProvider keeps. The provider's copy is
 * keyed by embedded vectors and not exposed as plain rows; for
 * read-only browsing the static JSON is the right source of truth
 * and avoids coupling this panel to the provider's internals.
 */

interface QaItem {
  q: string;
  a: string;
}

interface QaBankFile {
  version?: string;
  generated_at?: string;
  persona?: string;
  items?: QaItem[];
}

interface QaBankPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Persona slug used to pick the right bank file. */
  personaSlug?: string;
  /** Stable session id to attribute suggestions to. */
  sessionId: string;
  /**
   * Called when the visitor clicks a question. The widget is
   * expected to close the panel and route the question through the
   * normal chat send path so the bot's reply (cached or otherwise)
   * appears in the transcript.
   */
  onAskQuestion: (question: string) => void;
}

type LoadStatus = "idle" | "loading" | "ready" | "absent" | "error";

export function QaBankPanel({
  isOpen,
  onClose,
  personaSlug,
  sessionId,
  onAskQuestion,
}: QaBankPanelProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<QaItem[]>([]);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [search, setSearch] = useState("");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // Suggestion form state
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inflightRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen || !personaSlug) return;
    setStatus("loading");
    setExpandedIdx(null);
    const ctrl = new AbortController();
    const url = `${import.meta.env.BASE_URL}qa-bank/${personaSlug}.json`;
    fetch(url, { signal: ctrl.signal, cache: "no-cache" })
      .then(async (res) => {
        if (res.status === 404) {
          setItems([]);
          setStatus("absent");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const bank = (await res.json()) as QaBankFile;
        setItems(bank.items ?? []);
        setStatus("ready");
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setStatus("error");
      });
    return () => ctrl.abort();
  }, [isOpen, personaSlug]);

  // Reset suggestion form whenever the panel closes so it's fresh
  // next time. We keep the bank itself cached because re-fetching a
  // 30-row JSON on every open is wasteful.
  useEffect(() => {
    if (!isOpen) {
      setQuestion("");
      setContext("");
      setSubmitted(false);
      setSubmitting(false);
      setSubmitError(null);
      setSearch("");
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) => it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q),
    );
  }, [items, search]);

  const trimmedQuestion = question.trim();
  const trimmedContext = context.trim();
  const questionLen = trimmedQuestion.length;
  const contextLen = trimmedContext.length;
  // 8/280 mirrors the server-side validator. The form is disabled
  // (not silently rejected) so the visitor sees why.
  const questionValid = questionLen >= 8 && questionLen <= 280;
  const contextValid = contextLen <= 500;
  const formValid = questionValid && contextValid && !submitting;

  const handleSubmitSuggestion = async () => {
    if (!formValid || !personaSlug) return;
    setSubmitting(true);
    setSubmitError(null);
    inflightRef.current?.abort();
    const ctrl = new AbortController();
    inflightRef.current = ctrl;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          sessionId,
          personaSlug,
          question: trimmedQuestion,
          context: trimmedContext || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        // 429 from express-rate-limit comes through as a plain
        // string body, not JSON — surface a sensible default.
        const friendly =
          body.error ??
          (res.status === 429
            ? "Too many suggestions; try again in a minute."
            : `Couldn't send your suggestion (HTTP ${res.status}).`);
        throw new Error(friendly);
      }
      setSubmitted(true);
      setQuestion("");
      setContext("");
      toast({
        title: "Suggestion received",
        description: "Thanks — we'll review it and add what we can.",
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const msg = (err as Error).message || "Try again in a moment.";
      // Inline error stays under the form so the visitor sees it
      // without having to chase a toast that may have already
      // dismissed; the toast is kept as a redundant signal for
      // visitors who scroll away from the form.
      setSubmitError(msg);
      toast({
        variant: "destructive",
        title: "Couldn't send your suggestion",
        description: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-[hsl(var(--widget-bg))] border-[hsl(var(--widget-border))] text-[hsl(var(--widget-fg))] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            Browse Q&amp;A bank
          </DialogTitle>
          <DialogDescription className="text-[hsl(var(--widget-muted))]">
            Curated questions this persona answers from a vetted
            corpus. Click one to ask it, or suggest a new question
            you'd like the bot to handle.
          </DialogDescription>
        </DialogHeader>

        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--widget-muted))]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions or answers…"
            className="w-full pl-9 pr-3 py-2 bg-[hsl(220,13%,10%)] border border-[hsl(var(--widget-border))] rounded text-sm text-[hsl(var(--widget-fg))] placeholder:text-[hsl(var(--widget-muted))] focus:outline-none focus:border-emerald-500"
            data-testid="qa-search"
          />
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {status === "loading" && (
            <div className="flex items-center gap-2 text-sm text-[hsl(var(--widget-muted))] py-6">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading questions…
            </div>
          )}
          {status === "absent" && (
            <p className="text-sm text-[hsl(var(--widget-muted))] py-6">
              No curated Q&amp;A bank for this persona yet. You can
              still suggest a question below.
            </p>
          )}
          {status === "error" && (
            <p className="text-sm text-rose-300 py-6">
              Couldn't load the Q&amp;A bank. Try reopening this
              panel.
            </p>
          )}
          {status === "ready" && filtered.length === 0 && (
            <p className="text-sm text-[hsl(var(--widget-muted))] py-6">
              No questions match "{search}".
            </p>
          )}
          {status === "ready" && filtered.length > 0 && (
            <ul className="divide-y divide-[hsl(var(--widget-border))]">
              {filtered.map((it, idx) => {
                const open = expandedIdx === idx;
                return (
                  <li key={`${idx}-${it.q.slice(0, 24)}`} className="py-2">
                    <button
                      type="button"
                      onClick={() => setExpandedIdx(open ? null : idx)}
                      className="w-full text-left text-sm font-medium text-[hsl(var(--widget-fg))] hover:text-emerald-300 transition-colors"
                      data-testid={`qa-row-${idx}`}
                    >
                      {it.q}
                    </button>
                    {open && (
                      <div className="mt-2 ml-1 pl-3 border-l-2 border-emerald-500/40 text-xs text-[hsl(var(--widget-muted))] leading-relaxed">
                        <p className="whitespace-pre-wrap mb-2">{it.a}</p>
                        <button
                          type="button"
                          onClick={() => {
                            onAskQuestion(it.q);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-300 hover:text-emerald-200"
                          data-testid={`qa-ask-${idx}`}
                        >
                          <Send className="w-3 h-3" />
                          Ask this in chat
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="shrink-0 border-t border-[hsl(var(--widget-border))] pt-3">
          <div className="text-xs font-semibold text-[hsl(var(--widget-fg))] mb-1">
            Suggest a question
          </div>
          <p className="text-[11px] text-[hsl(var(--widget-muted))] mb-2">
            Tell us a question you wish this bot could answer. We
            review submissions and expand the bank where it makes
            sense.
          </p>
          <textarea
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              if (submitError) setSubmitError(null);
            }}
            placeholder="Your question (8–280 characters)"
            maxLength={280}
            rows={2}
            className="w-full px-3 py-2 bg-[hsl(220,13%,10%)] border border-[hsl(var(--widget-border))] rounded text-sm text-[hsl(var(--widget-fg))] placeholder:text-[hsl(var(--widget-muted))] focus:outline-none focus:border-emerald-500 resize-none"
            data-testid="qa-suggest-question"
            disabled={submitting}
          />
          <textarea
            value={context}
            onChange={(e) => {
              setContext(e.target.value);
              if (submitError) setSubmitError(null);
            }}
            placeholder="Optional context (≤ 500 characters)"
            maxLength={500}
            rows={2}
            className="w-full mt-2 px-3 py-2 bg-[hsl(220,13%,10%)] border border-[hsl(var(--widget-border))] rounded text-sm text-[hsl(var(--widget-fg))] placeholder:text-[hsl(var(--widget-muted))] focus:outline-none focus:border-emerald-500 resize-none"
            data-testid="qa-suggest-context"
            disabled={submitting}
          />
          {submitError && (
            <p
              className="mt-2 text-[11px] text-rose-300"
              role="alert"
              data-testid="qa-suggest-error"
            >
              {submitError}
            </p>
          )}
          <div className="flex items-center justify-between mt-2 text-[10px] text-[hsl(var(--widget-muted))]">
            <span
              className={cn(
                questionLen > 0 && !questionValid && "text-rose-300",
              )}
            >
              {questionLen}/280
              {contextLen > 0 && (
                <span className="ml-2">· context {contextLen}/500</span>
              )}
            </span>
            <button
              type="button"
              onClick={handleSubmitSuggestion}
              disabled={!formValid}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors",
                formValid
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-[hsl(220,13%,14%)] text-[hsl(var(--widget-muted))] cursor-not-allowed",
              )}
              data-testid="qa-suggest-submit"
            >
              {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
              {submitting ? "Sending…" : submitted ? "Send another" : "Send suggestion"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
