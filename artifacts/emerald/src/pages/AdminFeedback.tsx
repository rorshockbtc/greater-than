import { useEffect, useMemo, useState } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/**
 * Internal-only feedback dashboard. Not linked from the public site;
 * the URL alone is not enough — the route is gated by `?key=…` which
 * must match `ADMIN_FEEDBACK_KEY` on the api-server. Without a matching
 * key the backend returns 404 and we surface the same to keep the
 * existence of the page deniable.
 *
 * Render strategy: read-only, no client-side mutations. Filter by
 * persona / source / window in the URL so that links can be shared
 * between teammates and bookmarks survive reloads.
 */

interface FeedbackRow {
  id: number;
  kind: "feedback" | "suggestion";
  sessionId: string;
  personaSlug: string;
  rating: number | null;
  userMessage: string;
  botReply: string | null;
  comment?: string | null;
  context?: string | null;
  responseSource: string | null;
  biasId?: string | null;
  biasLabel?: string | null;
  latencyMs?: number | null;
  cosineScore?: number | null;
  createdAt: string;
}

interface SummaryRow {
  personaSlug: string;
  rating: number | null;
  kind: "feedback" | "suggestion";
  n: number;
}

interface ApiResponse {
  rows: FeedbackRow[];
  summary: SummaryRow[];
  sinceDays: number;
}

function getQueryParam(name: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) ?? "";
}

export default function AdminFeedback() {
  useDocumentTitle("Feedback · Admin");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const key = getQueryParam("key");
  const persona = getQueryParam("persona");
  const source = getQueryParam("source");
  const kind = getQueryParam("kind");
  const sinceDays = getQueryParam("sinceDays") || "30";

  useEffect(() => {
    if (!key) {
      setError("Missing access key.");
      setLoading(false);
      return;
    }
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");
    const params = new URLSearchParams({ key, sinceDays });
    if (persona) params.set("persona", persona);
    if (source) params.set("source", source);
    if (kind) params.set("kind", kind);
    fetch(`${base}api/admin/feedback?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json() as Promise<ApiResponse>;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err?.message ?? err));
        setLoading(false);
      });
  }, [key, persona, source, kind, sinceDays]);

  // Aggregate the summary table by persona so the header shows a
  // compact "persona · ↑ N · ↓ M · ✎ S" line per persona sorted by
  // total volume — the only view that's actually useful at a glance.
  // Suggestions (kind="suggestion") have null rating and are
  // counted in their own column so the up/down totals stay clean.
  const personaTotals = useMemo(() => {
    if (!data) return [] as Array<{ slug: string; up: number; down: number; sug: number }>;
    const map = new Map<string, { up: number; down: number; sug: number }>();
    for (const row of data.summary) {
      const cur = map.get(row.personaSlug) ?? { up: 0, down: 0, sug: 0 };
      if (row.kind === "suggestion") cur.sug += row.n;
      else if (row.rating === 1) cur.up += row.n;
      else if (row.rating === -1) cur.down += row.n;
      map.set(row.personaSlug, cur);
    }
    return Array.from(map.entries())
      .map(([slug, v]) => ({ slug, ...v }))
      .sort((a, b) => b.up + b.down + b.sug - (a.up + a.down + a.sug));
  }, [data]);

  if (loading) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Shell>
    );
  }

  if (error || !data) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold mb-2">Not found</h1>
        <p className="text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Feedback · last {data.sinceDays} days</h1>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          {personaTotals.length === 0 && (
            <span className="text-muted-foreground">No feedback yet.</span>
          )}
          {personaTotals.map((p) => (
            <span
              key={p.slug}
              className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1"
              data-testid={`summary-${p.slug}`}
            >
              <span className="font-medium">{p.slug}</span>
              <span className="text-emerald-400">↑ {p.up}</span>
              <span className="text-rose-400">↓ {p.down}</span>
              <span className="text-sky-400">✎ {p.sug}</span>
            </span>
          ))}
        </div>
        <FilterBar
          persona={persona}
          source={source}
          kind={kind}
          sinceDays={sinceDays}
          accessKey={key}
        />
      </header>

      <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
        <table className="w-full text-xs">
          <thead className="bg-[hsl(var(--card))] text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">When</th>
              <th className="px-3 py-2 text-left">Persona</th>
              <th className="px-3 py-2 text-left">Kind</th>
              <th className="px-3 py-2 text-left">Rating</th>
              <th className="px-3 py-2 text-left">Source</th>
              <th className="px-3 py-2 text-left">Question</th>
              <th className="px-3 py-2 text-left">Reply / Context</th>
              <th className="px-3 py-2 text-left">Bias</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <FeedbackRowItem key={r.id} row={r} />
            ))}
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  No feedback rows match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

/**
 * One row in the admin table. Click anywhere on the row to expand
 * full transcript context: the visitor's question, the bot's full
 * reply, any optional comment they left, and the session id +
 * response metadata. Collapsed by default to keep scan-speed high.
 */
function FeedbackRowItem({ row }: { row: FeedbackRow }) {
  const [open, setOpen] = useState(false);
  const isSuggestion = row.kind === "suggestion";
  // Neutral styling for suggestion rows — the rating cell shows
  // "—" for them, so a red default would imply a thumbs-down that
  // wasn't actually given.
  const ratingClass = isSuggestion
    ? "text-muted-foreground"
    : row.rating === 1
      ? "text-emerald-400"
      : "text-rose-400";
  return (
    <>
      <tr
        className="border-t border-[hsl(var(--border))] align-top hover:bg-[hsl(var(--card))] cursor-pointer"
        onClick={() => setOpen((v) => !v)}
        data-testid={`feedback-row-${row.id}`}
      >
        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
          {new Date(row.createdAt).toLocaleString()}
        </td>
        <td className="px-3 py-2 whitespace-nowrap font-medium">{row.personaSlug}</td>
        <td className="px-3 py-2 whitespace-nowrap">
          {isSuggestion ? (
            <span className="text-sky-400 font-mono text-[10px] uppercase">suggest</span>
          ) : (
            <span className="text-muted-foreground font-mono text-[10px] uppercase">rating</span>
          )}
        </td>
        <td className={`px-3 py-2 whitespace-nowrap font-semibold ${ratingClass}`}>
          {isSuggestion ? "—" : row.rating === 1 ? "↑" : "↓"}
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
          {row.responseSource ?? "—"}
        </td>
        <td className="px-3 py-2 max-w-md">
          <div className="line-clamp-3">{row.userMessage}</div>
        </td>
        <td className="px-3 py-2 max-w-md">
          <div className="line-clamp-3 text-muted-foreground">
            {isSuggestion ? row.context ?? "—" : row.botReply ?? "—"}
          </div>
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
          {row.biasLabel ?? "—"}
        </td>
      </tr>
      {open && (
        <tr
          className="border-t border-[hsl(var(--border))] bg-[hsl(var(--card))]"
          data-testid={`feedback-row-expanded-${row.id}`}
        >
          <td colSpan={8} className="px-4 py-4">
            <div className="grid gap-3 max-w-4xl">
              <Field label={isSuggestion ? "Suggested question" : "Question"}>
                <p className="text-sm whitespace-pre-wrap">{row.userMessage}</p>
              </Field>
              {isSuggestion ? (
                row.context && (
                  <Field label="Visitor context">
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                      {row.context}
                    </p>
                  </Field>
                )
              ) : (
                <Field label="Reply">
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {row.botReply}
                  </p>
                </Field>
              )}
              {row.comment && (
                <Field label="Visitor comment">
                  <p className="text-sm whitespace-pre-wrap text-rose-300">{row.comment}</p>
                </Field>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                <Meta label="Session" value={row.sessionId} />
                <Meta label="Source" value={row.responseSource ?? "—"} />
                <Meta label="Bias" value={row.biasLabel ?? row.biasId ?? "—"} />
                <Meta
                  label="Cosine"
                  value={row.cosineScore != null ? row.cosineScore.toFixed(3) : "—"}
                />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </div>
      {children}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground/70">{label}</div>
      <div className="font-mono text-foreground break-all">{value}</div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] p-6 max-w-7xl mx-auto">
      {children}
    </div>
  );
}

function FilterBar({
  persona,
  source,
  kind,
  sinceDays,
  accessKey,
}: {
  persona: string;
  source: string;
  kind: string;
  sinceDays: string;
  accessKey: string;
}) {
  const apply = (
    next: Partial<{ persona: string; source: string; kind: string; sinceDays: string }>,
  ) => {
    const params = new URLSearchParams({ key: accessKey });
    const p = next.persona ?? persona;
    const s = next.source ?? source;
    const k = next.kind ?? kind;
    const d = next.sinceDays ?? sinceDays;
    if (p) params.set("persona", p);
    if (s) params.set("source", s);
    if (k) params.set("kind", k);
    if (d) params.set("sinceDays", d);
    window.location.search = params.toString();
  };
  return (
    <div className="mt-4 flex flex-wrap gap-3 text-xs items-center">
      <label className="flex items-center gap-2">
        <span className="text-muted-foreground">Persona</span>
        <select
          value={persona}
          onChange={(e) => apply({ persona: e.target.value })}
          className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded px-2 py-1"
          data-testid="filter-persona"
        >
          <option value="">All</option>
          <option value="startups">startups</option>
          <option value="faith">faith</option>
          <option value="schools">schools</option>
          <option value="small-business">small-business</option>
          <option value="healthtech">healthtech</option>
          <option value="fintech">fintech</option>
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="text-muted-foreground">Kind</span>
        <select
          value={kind}
          onChange={(e) => apply({ kind: e.target.value })}
          className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded px-2 py-1"
          data-testid="filter-kind"
        >
          <option value="">All</option>
          <option value="feedback">feedback</option>
          <option value="suggestion">suggestion</option>
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="text-muted-foreground">Source</span>
        <select
          value={source}
          onChange={(e) => apply({ source: e.target.value })}
          className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded px-2 py-1"
          data-testid="filter-source"
        >
          <option value="">All</option>
          <option value="local">local</option>
          <option value="cloud">cloud</option>
          <option value="openclaw">openclaw</option>
          <option value="qa-cache">qa-cache</option>
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="text-muted-foreground">Window (days)</span>
        <select
          value={sinceDays}
          onChange={(e) => apply({ sinceDays: e.target.value })}
          className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded px-2 py-1"
          data-testid="filter-since"
        >
          <option value="1">1</option>
          <option value="7">7</option>
          <option value="30">30</option>
          <option value="90">90</option>
        </select>
      </label>
    </div>
  );
}
