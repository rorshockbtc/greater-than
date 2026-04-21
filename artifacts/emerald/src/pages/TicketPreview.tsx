import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { ArrowLeft, Clipboard, Check, Loader2, Ticket, ShieldCheck } from "lucide-react";
import { useLLM } from "@/llm/LLMProvider";
import { useToast } from "@/hooks/use-toast";
import {
  loadTranscript,
  type StoredTranscript,
} from "@/lib/ticketTranscript";
import {
  redactTranscript,
  type RedactedTranscript,
  type Redaction,
  type RedactionKind,
} from "@/lib/redactPii";
import {
  buildTicketPayload,
  synthesizeTicketId,
  type TicketSummary,
} from "@/lib/buildTicket";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { SkipToContent } from "@/components/SkipToContent";

/**
 * Support-ticket preview screen. Lives at `/demo/:slug/ticket` and
 * makes the "Greater is a preprocessor for your existing helpdesk"
 * pitch concrete: the visitor sees their own redacted transcript,
 * a locally-summarized intent block, and the exact JSON Greater
 * would have POSTed to a Zendesk-shaped endpoint.
 *
 * Everything on this page is client-side. No data leaves the browser.
 */
export default function TicketPreview() {
  const [, params] = useRoute("/demo/:slug/ticket");
  const slug = params?.slug ?? "";
  const stored = useMemo(() => (slug ? loadTranscript(slug) : null), [slug]);

  useDocumentTitle("Ticket preview");

  if (!stored) return <EmptyState slug={slug} />;
  return <TicketPreviewInner stored={stored} />;
}

function EmptyState({ slug }: { slug: string }) {
  // Building a back-link to the demo route. Some persona demos use
  // bespoke base paths via wouter's basename, so we use a relative
  // Link rather than a hardcoded absolute path.
  const backHref = slug ? `/demo/${slug}` : "/";
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <Ticket className="w-10 h-10 mx-auto text-slate-400 mb-4" />
        <h1 className="text-xl font-semibold mb-2">No transcript yet</h1>
        <p className="text-sm text-slate-600 mb-6">
          Open the chat widget on the demo and ask Greater a question.
          Once there's at least one back-and-forth, this preview will
          show the redacted transcript and the support-ticket payload
          that would have been escalated.
        </p>
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to the demo
        </Link>
      </div>
    </main>
  );
}

interface SummaryState {
  status: "loading" | "ready" | "fallback";
  summary: TicketSummary;
}

/**
 * Heuristic fallback summary used when the in-browser LLM isn't
 * ready (mobile / unsupported browsers, or the visitor opened the
 * preview before the model finished downloading). Better than a
 * spinner that never resolves.
 */
function heuristicSummary(stored: StoredTranscript): TicketSummary {
  const firstUser =
    stored.turns.find((t) => t.role === "user")?.content?.slice(0, 200) ?? "";
  const lastBot =
    [...stored.turns].reverse().find((t) => t.role === "bot")?.content
      ?.slice(0, 200) ?? "";
  return {
    intent: firstUser || "Visitor opened the chat widget.",
    answered:
      lastBot ||
      "Greater responded with information from the embedded knowledge base.",
    unresolved:
      "Could not be auto-determined without the in-browser model — review the transcript.",
    recommendedAction:
      "Read the transcript and follow up with the visitor via the requester email.",
  };
}

function TicketPreviewInner({ stored }: { stored: StoredTranscript }) {
  const llm = useLLM();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState(false);

  const redacted = useMemo<RedactedTranscript>(
    () => redactTranscript(stored.turns),
    [stored.turns],
  );

  const [summaryState, setSummaryState] = useState<SummaryState>(() => ({
    status: llm.status === "ready" ? "loading" : "fallback",
    summary: heuristicSummary(stored),
  }));

  // Run the local summarizer once per stored transcript. We
  // deliberately use the *redacted* transcript as input so PII
  // never reaches the model — same posture as the eventual
  // helpdesk payload.
  useEffect(() => {
    if (llm.status !== "ready") {
      setSummaryState({ status: "fallback", summary: heuristicSummary(stored) });
      return;
    }
    let cancelled = false;
    setSummaryState((s) => ({ ...s, status: "loading" }));
    const transcriptText = redacted.turns
      .map((t) => `${t.role === "user" ? "Visitor" : "Greater"}: ${t.content}`)
      .join("\n");
    const prompt = [
      "You are summarizing a support-bot transcript for the human agent",
      "who will pick it up. Reply with EXACTLY four short lines, one per",
      "label, no extra commentary, no markdown:",
      "INTENT: <one sentence — what the visitor wanted>",
      "ANSWERED: <one sentence — what the bot said>",
      "UNRESOLVED: <one sentence — what the bot could not resolve>",
      "ACTION: <one sentence — recommended next step for the human agent>",
      "",
      "Transcript:",
      transcriptText,
    ].join("\n");

    /**
     * Hard 5s cap on local summarization. WebGPU generation is
     * usually sub-second after the model is warm, but cold-start or
     * a backed-up CPU fallback can stall for tens of seconds — we'd
     * rather show the heuristic summary than leave the spinner up.
     * The race resolves to either the model answer or a `__timeout`
     * sentinel; either way the spinner clears.
     */
    const TIMEOUT_MS = 5000;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<{ text: "__timeout" }>((resolve) => {
      timeoutHandle = setTimeout(
        () => resolve({ text: "__timeout" }),
        TIMEOUT_MS,
      );
    });

    (async () => {
      try {
        const ans = await Promise.race([
          // No bias prompt for the summarizer — it's a meta task,
          // not a user-facing answer. Keep retrieval off too: the
          // transcript is already in the prompt, no need to RAG it.
          llm.ask([], prompt, {}),
          timeoutPromise,
        ]);
        if (cancelled) return;
        if (ans.text === "__timeout") {
          setSummaryState({
            status: "fallback",
            summary: heuristicSummary(stored),
          });
          return;
        }
        const parsed = parseSummary(ans.text) ?? heuristicSummary(stored);
        setSummaryState({ status: "ready", summary: parsed });
      } catch {
        if (cancelled) return;
        setSummaryState({
          status: "fallback",
          summary: heuristicSummary(stored),
        });
      } finally {
        if (timeoutHandle !== null) clearTimeout(timeoutHandle);
      }
    })();

    return () => {
      cancelled = true;
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    };
  }, [llm, redacted.turns, stored]);

  const ticketId = useMemo(() => synthesizeTicketId(stored.sessionId), [
    stored.sessionId,
  ]);

  const payload = useMemo(
    () =>
      buildTicketPayload(
        {
          redacted,
          summary: summaryState.summary,
          persona: { slug: stored.personaSlug, brand: stored.personaBrand },
          biasId: stored.biasId,
          biasLabel: stored.biasLabel,
          sessionId: stored.sessionId,
          capturedAt: new Date(stored.updatedAt),
        },
        ticketId,
      ),
    [redacted, summaryState.summary, stored, ticketId],
  );

  const json = useMemo(() => JSON.stringify(payload, null, 2), [payload]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      toast({ title: "Copied", description: "Ticket JSON is on your clipboard." });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({
        title: "Copy failed",
        description: "Your browser blocked clipboard access. Select the JSON manually.",
        variant: "destructive",
      });
    }
  };

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-slate-50 text-slate-900">
      <SkipToContent />
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate(`/demo/${stored.routeSlug}`)}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            data-testid="button-back-to-demo"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {stored.personaBrand}
          </button>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Client-side preview · nothing is sent
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <section>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-2">
            <Ticket className="w-6 h-6 text-emerald-600" />
            Support ticket preview
          </h1>
          <p className="text-sm text-slate-600 max-w-3xl">
            This is your support team's view. The visitor's raw chat
            never leaves their browser; only this redacted, summarized
            payload is escalated. Per-message AI fees: zero.
          </p>
        </section>

        <SummaryCard state={summaryState} />

        <TranscriptCard redacted={redacted} />

        <RedactionsCard redactions={redacted.redactions} />

        <PayloadCard
          json={json}
          onCopy={handleCopy}
          copied={copied}
          ticketId={ticketId}
        />
      </div>
    </main>
  );
}

function SummaryCard({ state }: { state: SummaryState }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-500">
          Summary for the human agent
        </h2>
        <span className="text-xs text-slate-500 inline-flex items-center gap-1.5">
          {state.status === "loading" && (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Summarizing locally…
            </>
          )}
          {state.status === "ready" && (
            <>
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Generated by the in-browser model
            </>
          )}
          {state.status === "fallback" && (
            <>Heuristic summary (in-browser model not available)</>
          )}
        </span>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <SummaryRow label="Intent" value={state.summary.intent} />
        <SummaryRow label="Greater answered" value={state.summary.answered} />
        <SummaryRow label="Could not resolve" value={state.summary.unresolved} />
        <SummaryRow
          label="Recommended next action"
          value={state.summary.recommendedAction}
        />
      </dl>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 mb-1">
        {label}
      </dt>
      <dd className="text-slate-900">{value}</dd>
    </div>
  );
}

function TranscriptCard({ redacted }: { redacted: RedactedTranscript }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-500 mb-3">
        Redacted transcript
      </h2>
      <ol className="space-y-3">
        {redacted.turns.map((t, i) => (
          <li
            key={i}
            className="text-sm leading-relaxed"
            data-testid={`ticket-turn-${i}`}
          >
            <span
              className={
                t.role === "user"
                  ? "font-semibold text-slate-700"
                  : "font-semibold text-emerald-700"
              }
            >
              {t.role === "user" ? "Visitor" : "Greater"}:
            </span>{" "}
            <RenderRedacted text={t.content} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Render text with redaction tokens highlighted. Each [redacted-*]
 * placeholder gets a red strike-through background so the visitor
 * can see what was scrubbed without seeing the original PII.
 */
function RenderRedacted({ text }: { text: string }) {
  const parts = text.split(/(\[redacted-[a-z]+\])/g);
  return (
    <span className="text-slate-800">
      {parts.map((p, i) =>
        /^\[redacted-[a-z]+\]$/.test(p) ? (
          <span
            key={i}
            className="px-1 rounded bg-red-100 text-red-700 line-through decoration-red-400"
            data-testid="redaction-mark"
          >
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}

function RedactionsCard({ redactions }: { redactions: Redaction[] }) {
  if (!redactions.length) {
    return (
      <section className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-sm text-emerald-800">
        No PII patterns matched in this transcript.
      </section>
    );
  }
  // Group by kind so the summary stays compact.
  const grouped = redactions.reduce<Record<RedactionKind, number>>(
    (acc, r) => {
      acc[r.kind] = (acc[r.kind] ?? 0) + 1;
      return acc;
    },
    {} as Record<RedactionKind, number>,
  );
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-500 mb-3">
        Redactions applied
      </h2>
      <ul className="flex flex-wrap gap-2">
        {Object.entries(grouped).map(([kind, count]) => (
          <li
            key={kind}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 border border-red-100 text-red-700 rounded text-xs"
            data-testid={`redaction-summary-${kind}`}
          >
            <span className="font-medium">{kind}</span>
            <span className="text-red-500">×{count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PayloadCard({
  json,
  onCopy,
  copied,
  ticketId,
}: {
  json: string;
  onCopy: () => void;
  copied: boolean;
  ticketId: string;
}) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
        <div className="flex items-center gap-3 text-slate-200 text-sm">
          <Ticket className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold">POST /api/v2/tickets.json</span>
          <span className="text-slate-500 text-xs">id {ticketId}</span>
        </div>
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded text-xs font-medium transition-colors"
          data-testid="button-copy-ticket-json"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" /> Copied
            </>
          ) : (
            <>
              <Clipboard className="w-3 h-3" /> Copy JSON
            </>
          )}
        </button>
      </div>
      <pre className="text-xs leading-relaxed text-slate-100 overflow-auto p-5 max-h-[480px]">
        <code>{json}</code>
      </pre>
    </section>
  );
}

/**
 * Parse the four-line summary the local model is asked to emit. The
 * model often wraps lines in code fences or adds extra prose; this
 * function ignores anything that isn't one of the four labelled
 * lines and returns null if any required label is missing (caller
 * falls back to the heuristic summary).
 */
function parseSummary(raw: string): TicketSummary | null {
  const get = (label: string) => {
    const re = new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, "im");
    const m = raw.match(re);
    return m?.[1]?.trim();
  };
  const intent = get("INTENT");
  const answered = get("ANSWERED");
  const unresolved = get("UNRESOLVED");
  const action = get("ACTION");
  if (!intent || !answered || !unresolved || !action) return null;
  return {
    intent,
    answered,
    unresolved,
    recommendedAction: action,
  };
}
