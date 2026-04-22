import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Database,
  Download,
  FileText,
  FolderOpen,
  Globe,
  Loader2,
  Network,
  Radio,
  Rss,
  Trash2,
  Upload,
  Workflow,
  X,
} from "lucide-react";
import { useLLM } from "@/llm/LLMProvider";
import { deleteByJob, listSources } from "@/llm/vectorStore";
import type { IndexedSource, IngestProgress, JobKind } from "@/llm/types";
import type { IngestMode } from "@/llm/ingest";
import {
  syncNostr,
  hasNip07,
  type NostrSyncOptions,
} from "@/llm/nostrSync";
import {
  subscribeWikiCompiler,
  setWikiCompilerEnabled,
  getWikiCompilerState,
  getOrCompressWikiIndex,
  type WikiCompilerState,
} from "@/llm/wikiCompiler";
import {
  syncLocalFiles,
  hasFileSystemAccess,
} from "@/llm/fileSystemSync";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  buildExport,
  downloadExport,
  estimateFullExportSize,
  EXPORT_SIZE_LIMIT_BYTES,
} from "@/lib/exportKb";
import { importKb, ImportValidationError } from "@/lib/importKb";

const MODE_META: Record<
  IngestMode,
  { label: string; placeholder: string }
> = {
  page: {
    label: "Single page",
    placeholder: "https://example.com/article",
  },
  sitemap: {
    label: "Sitemap",
    placeholder: "https://example.com/sitemap.xml",
  },
  rss: {
    label: "RSS / Atom",
    placeholder: "https://example.com/feed.xml",
  },
};

const JOB_KIND_META: Record<
  JobKind,
  { label: string; Icon: typeof Globe }
> = {
  page: { label: "Page", Icon: Globe },
  sitemap: { label: "Sitemap", Icon: Network },
  rss: { label: "Feed", Icon: Rss },
  crawl: { label: "Crawl", Icon: Workflow },
  seed: { label: "Seed corpus", Icon: Database },
  "bitcoin-bundle": { label: "Bitcoin bundle", Icon: FileText },
  "seed-bundle": { label: "Seed bundle", Icon: FileText },
  nostr: { label: "NOSTR relay", Icon: Radio },
  "local-files": { label: "Local files", Icon: FolderOpen },
};

function formatRelative(ts?: number): string {
  if (!ts) return "—";
  const delta = Date.now() - ts;
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

/**
 * Top-level tab. "Index URL" covers the existing single-page,
 * sitemap, and RSS flows. "Crawl site" runs the streaming BFS
 * crawler against a root URL. "NOSTR" syncs from a relay.
 * "Local files" reads directly from the user's file system.
 */
type Tab = "index" | "crawl" | "nostr" | "local-files";

export function KnowledgePanel({
  isOpen,
  onClose,
  personaSlug,
  onImportHarnesses,
}: {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Persona slug of the host route. Stamped on every chunk written by
   * the panel so user-ingested content stays scoped to the persona it
   * was added under (Task #26). Omitted on the home page → chunks are
   * stamped `__global__` and remain eligible across all personas.
   */
  personaSlug?: string;
  /**
   * Called after a successful import when the export file contained
   * harness entries. The parent should open HarnessPanel in review
   * mode for each slug. The map is keyed by persona slug.
   */
  onImportHarnesses?: (harnesses: Record<string, string>) => void;
}) {
  const [tab, setTab] = useState<Tab>("index");
  const [sources, setSources] = useState<IndexedSource[]>([]);
  const { toast } = useToast();

  const refreshSources = useCallback(async () => {
    try {
      setSources(await listSources());
    } catch {
      // IndexedDB unavailable — leave empty.
    }
  }, []);

  useEffect(() => {
    if (isOpen) void refreshSources();
  }, [isOpen, refreshSources]);

  const totalChunks = sources.reduce((n, s) => n + s.chunk_count, 0);
  const totalPages = sources.reduce((n, s) => n + s.page_count, 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-[hsl(var(--widget-bg))] border-[hsl(var(--widget-border))] text-[hsl(var(--widget-fg))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            Knowledge base
          </DialogTitle>
          <DialogDescription className="text-[hsl(var(--widget-muted))]">
            Index pages, sitemaps, RSS feeds, or whole sites into the
            in-browser knowledge base. Extraction and embedding run
            locally — no LLM is invoked during indexing, and indexed
            content lives in your browser only.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap border-b border-[hsl(var(--widget-border))] -mx-1 px-1">
          {([
            { id: "index" as const, label: "Index URL" },
            { id: "crawl" as const, label: "Crawl site" },
            { id: "nostr" as const, label: "NOSTR relay" },
            { id: "local-files" as const, label: "Local files" },
          ]).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "px-3 py-2 text-sm border-b-2 -mb-px transition-colors",
                tab === t.id
                  ? "border-emerald-500 text-[hsl(var(--widget-fg))]"
                  : "border-transparent text-[hsl(var(--widget-muted))] hover:text-[hsl(var(--widget-fg))]",
              )}
              data-testid={`kb-tab-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "index" && (
          <IndexTab onIndexed={refreshSources} personaSlug={personaSlug} />
        )}
        {tab === "crawl" && (
          <CrawlTab onIndexed={refreshSources} personaSlug={personaSlug} />
        )}
        {tab === "nostr" && (
          <NostrTab onIndexed={refreshSources} personaSlug={personaSlug} />
        )}
        {tab === "local-files" && (
          <LocalFilesTab
            onIndexed={refreshSources}
            personaSlug={personaSlug}
          />
        )}

        <div className="border-t border-[hsl(var(--widget-border))] pt-3">
          <div className="flex items-baseline justify-between mb-2">
            <h4 className="text-xs uppercase tracking-wider text-[hsl(var(--widget-muted))]">
              Indexed sources
            </h4>
            <span className="text-[11px] text-[hsl(var(--widget-muted))]">
              {sources.length} source{sources.length === 1 ? "" : "s"} ·{" "}
              {totalPages} page{totalPages === 1 ? "" : "s"} · {totalChunks} chunk
              {totalChunks === 1 ? "" : "s"}
            </span>
          </div>
          <SourcesList sources={sources} onRemoved={refreshSources} />
        </div>

        <EjectImportBar
          personaSlug={personaSlug}
          onImported={async (harnesses) => {
            await refreshSources();
            if (
              onImportHarnesses &&
              Object.keys(harnesses).length > 0
            ) {
              onImportHarnesses(harnesses);
            }
          }}
          toast={toast}
        />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 p-1 text-[hsl(var(--widget-muted))] hover:text-[hsl(var(--widget-fg))]"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Eject KB / Import KB toolbar
// ---------------------------------------------------------------------------

/**
 * When a full export would exceed 50 MB the user gets an inline choice:
 *   "persona only" | "all (large)" | "cancel"
 */
type SizeChoice = "pending" | "persona" | "all" | null;

function EjectImportBar({
  personaSlug,
  onImported,
  toast,
}: {
  personaSlug?: string;
  onImported: (harnesses: Record<string, string>) => Promise<void>;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [ejecting, setEjecting] = useState(false);
  const [ejectProgress, setEjectProgress] = useState<{ done: number; total: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [sizeChoice, setSizeChoice] = useState<SizeChoice>(null);
  const [estimatedMb, setEstimatedMb] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runExport = async (forcePersonaScope?: boolean) => {
    setSizeChoice(null);
    setEjecting(true);
    setEjectProgress(null);
    try {
      const result = await buildExport({
        personaSlug,
        forcePersonaScope,
        onProgress: (p) => setEjectProgress({ done: p.done, total: p.total }),
      });

      downloadExport(result.payload);

      const mb = (result.estimatedBytes / (1024 * 1024)).toFixed(1);
      toast({
        title: "Knowledge base exported",
        description: `Downloaded ${result.payload.chunks.length.toLocaleString()} chunk${
          result.payload.chunks.length === 1 ? "" : "s"
        } · ~${mb} MB${result.fullExport ? "" : ` (${result.personaScope} persona only)`}.`,
      });
    } catch (err) {
      toast({
        title: "Export failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setEjecting(false);
      setEjectProgress(null);
    }
  };

  const handleEject = async () => {
    const bytes = await estimateFullExportSize();
    if (bytes > EXPORT_SIZE_LIMIT_BYTES && personaSlug) {
      setEstimatedMb(bytes / (1024 * 1024));
      setSizeChoice("pending");
      return;
    }
    await runExport(false);
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    setImportProgress(null);
    try {
      const raw = await file.text();
      const result = await importKb(raw, (p) =>
        setImportProgress({ done: p.done, total: p.total }),
      );
      toast({
        title: "Import complete",
        description: `${result.chunks_imported.toLocaleString()} chunk${
          result.chunks_imported === 1 ? "" : "s"
        } imported · ${result.chunks_skipped.toLocaleString()} skipped (already present)${
          Object.keys(result.harnesses).length > 0
            ? " · Harness ready for review in Harness panel."
            : ""
        }`,
      });
      await onImported(result.harnesses);
    } catch (err) {
      const msg = err instanceof ImportValidationError
        ? err.message
        : `Import failed: ${(err as Error).message}`;
      toast({
        title: "Import failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      setImportProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const busy = ejecting || importing;
  const progressBar = ejecting ? ejectProgress : importProgress;

  return (
    <div className="border-t border-[hsl(var(--widget-border))] pt-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs uppercase tracking-wider text-[hsl(var(--widget-muted))]">
          Portability
        </h4>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || sizeChoice === "pending"}
            onClick={() => void handleEject()}
            className="h-7 gap-1.5 border-[hsl(var(--widget-border))] text-[hsl(var(--widget-fg))] hover:bg-white/5 text-xs"
            data-testid="kb-eject"
          >
            {ejecting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            {ejecting ? "Exporting…" : "Eject KB"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || sizeChoice === "pending"}
            onClick={() => fileInputRef.current?.click()}
            className="h-7 gap-1.5 border-[hsl(var(--widget-border))] text-[hsl(var(--widget-fg))] hover:bg-white/5 text-xs"
            data-testid="kb-import"
          >
            {importing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {importing ? "Importing…" : "Import KB"}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
            }}
            data-testid="kb-import-input"
          />
        </div>
      </div>

      {progressBar && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-[hsl(var(--widget-muted))]">
            <span>{ejecting ? "Serialising chunks…" : "Writing chunks…"}</span>
            <span>{progressBar.done.toLocaleString()} / {progressBar.total.toLocaleString()}</span>
          </div>
          <div className="h-1 bg-white/5 rounded overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{
                width: progressBar.total > 0
                  ? `${Math.round((progressBar.done / progressBar.total) * 100)}%`
                  : "5%",
              }}
            />
          </div>
        </div>
      )}

      {sizeChoice === "pending" && personaSlug && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
          <p className="text-[11px] text-amber-300 leading-relaxed">
            <span className="font-semibold">Large export (~{estimatedMb.toFixed(0)} MB).</span>{" "}
            Choose whether to export all personas or just the active one.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void runExport(true)}
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
              data-testid="kb-eject-persona"
            >
              Export "{personaSlug}" only
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void runExport(false)}
              className="h-7 text-xs border-[hsl(var(--widget-border))] text-[hsl(var(--widget-fg))] hover:bg-white/5"
              data-testid="kb-eject-all"
            >
              Export all (~{estimatedMb.toFixed(0)} MB)
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setSizeChoice(null)}
              className="h-7 text-xs text-[hsl(var(--widget-muted))]"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-[hsl(var(--widget-muted))]">
        Eject KB downloads all vectors + harnesses to a single JSON file (FOSS sovereignty exit).
        Import merges a previous export back in — existing chunks are skipped, harnesses need review.
      </p>
    </div>
  );
}

function IndexTab({
  onIndexed,
  personaSlug,
}: {
  onIndexed: () => Promise<void>;
  personaSlug?: string;
}) {
  const llm = useLLM();
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<IngestMode>("page");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<IngestProgress | null>(null);

  const handleIndex = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (llm.status !== "ready") {
      toast({
        title: "Local AI not ready",
        description:
          "Wait for the in-browser model to finish loading, then try again.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    setProgress(null);
    try {
      const result = await llm.ingest({
        url: trimmed,
        mode,
        bias: "neutral",
        personaSlug,
        onProgress: (p) => setProgress(p),
      });
      toast({
        title: "Indexed",
        description: `Indexed ${result.pages_indexed} page${
          result.pages_indexed === 1 ? "" : "s"
        } · ${result.chunks_indexed} chunk${
          result.chunks_indexed === 1 ? "" : "s"
        }.`,
      });
      setUrl("");
      await onIndexed();
    } catch (err) {
      toast({
        title: "Indexing failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex rounded-md border border-[hsl(var(--widget-border))] overflow-hidden text-xs">
          {(["page", "sitemap", "rss"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "px-3 py-2 transition-colors",
                mode === m
                  ? "bg-emerald-600 text-white"
                  : "text-[hsl(var(--widget-muted))] hover:bg-white/5",
              )}
            >
              {MODE_META[m].label}
            </button>
          ))}
        </div>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={MODE_META[mode].placeholder}
          className="bg-transparent border-[hsl(var(--widget-border))] text-sm"
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleIndex();
          }}
        />
        <Button
          onClick={() => void handleIndex()}
          disabled={busy || !url.trim() || llm.status !== "ready"}
          className="bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Index"}
        </Button>
      </div>
      {llm.status !== "ready" && (
        <p className="text-[11px] text-amber-300">
          Local AI is still loading; indexing will be available shortly.
        </p>
      )}

      {progress && <ProgressLine progress={progress} />}
    </div>
  );
}

/**
 * Crawl form. Lets the visitor point Greater at a site root and walk
 * the link graph (sitemap-first when one is published) up to the
 * configured caps. The disclaimers above the form are part of the
 * product spec — we don't want a visitor to think this is a Googlebot
 * replacement.
 */
function CrawlTab({
  onIndexed,
  personaSlug,
}: {
  onIndexed: () => Promise<void>;
  personaSlug?: string;
}) {
  const llm = useLLM();
  const { toast } = useToast();
  const [root, setRoot] = useState("");
  const [maxPages, setMaxPages] = useState(50);
  const [maxDepth, setMaxDepth] = useState(2);
  const [delaySec, setDelaySec] = useState(1);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<IngestProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleStart = async () => {
    const trimmed = root.trim();
    if (!trimmed) return;
    if (llm.status !== "ready") {
      toast({
        title: "Local AI not ready",
        description:
          "Wait for the in-browser model to finish loading, then try again.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    setProgress(null);
    const ctl = new AbortController();
    abortRef.current = ctl;
    try {
      const result = await llm.crawl({
        root: trimmed,
        maxPages: clamp(maxPages, 1, 200),
        maxDepth: clamp(maxDepth, 0, 4),
        delayMs: Math.round(clamp(delaySec, 0, 10) * 1000),
        bias: "neutral",
        personaSlug,
        onProgress: (p) => setProgress(p),
        signal: ctl.signal,
      });
      toast({
        title: ctl.signal.aborted ? "Crawl cancelled" : "Crawl complete",
        description: `Indexed ${result.pages_indexed} page${
          result.pages_indexed === 1 ? "" : "s"
        } · ${result.chunks_indexed} chunk${
          result.chunks_indexed === 1 ? "" : "s"
        }.`,
      });
      if (!ctl.signal.aborted) setRoot("");
      await onIndexed();
    } catch (err) {
      // AbortError is a normal "user clicked cancel" path — don't
      // surface it as a destructive toast.
      const e = err as Error;
      if (e.name === "AbortError" || ctl.signal.aborted) {
        await onIndexed();
      } else {
        toast({
          title: "Crawl failed",
          description: e.message,
          variant: "destructive",
        });
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-[hsl(var(--widget-muted))] space-y-1 bg-white/[0.03] border border-[hsl(var(--widget-border))] rounded-md p-3">
        <p>
          <span className="font-medium text-[hsl(var(--widget-fg))]">
            Best-effort.
          </span>{" "}
          No LLM is used during crawling — only chunking, embedding, and
          storing locally in your browser.
        </p>
        <p>
          <span className="font-medium text-[hsl(var(--widget-fg))]">
            Slow on complex sites.
          </span>{" "}
          Large sites may exceed the rate limit or hit the page cap.
          Consider providing a sitemap URL on the Index tab first.
        </p>
        <p>
          <span className="font-medium text-[hsl(var(--widget-fg))]">
            Some sites block automated requests.
          </span>{" "}
          We respect <code className="text-[10px]">robots.txt</code> on
          the server. JavaScript-rendered SPAs aren't supported yet.
        </p>
      </div>

      <Input
        value={root}
        onChange={(e) => setRoot(e.target.value)}
        placeholder="https://example.com/"
        className="bg-transparent border-[hsl(var(--widget-border))] text-sm"
        disabled={busy}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !busy) void handleStart();
        }}
        data-testid="kb-crawl-root"
      />

      <div className="grid grid-cols-3 gap-2">
        <NumberField
          label="Max pages"
          hint="cap 200"
          value={maxPages}
          onChange={setMaxPages}
          min={1}
          max={200}
          disabled={busy}
        />
        <NumberField
          label="Max depth"
          hint="cap 4"
          value={maxDepth}
          onChange={setMaxDepth}
          min={0}
          max={4}
          disabled={busy}
        />
        <NumberField
          label="Polite delay"
          hint="seconds"
          value={delaySec}
          onChange={setDelaySec}
          min={0}
          max={10}
          disabled={busy}
        />
      </div>

      <div className="flex items-center gap-2">
        {!busy ? (
          <Button
            onClick={() => void handleStart()}
            disabled={!root.trim() || llm.status !== "ready"}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
            data-testid="kb-crawl-start"
          >
            Start crawl
          </Button>
        ) : (
          <Button
            onClick={handleCancel}
            variant="destructive"
            data-testid="kb-crawl-cancel"
          >
            Cancel
          </Button>
        )}
        {llm.status !== "ready" && (
          <p className="text-[11px] text-amber-300">
            Local AI is still loading.
          </p>
        )}
      </div>

      {progress && <ProgressLine progress={progress} />}
      {progress && progress.recent_errors && progress.recent_errors.length > 0 && (
        <details className="text-[11px] text-[hsl(var(--widget-muted))] bg-white/[0.03] border border-[hsl(var(--widget-border))] rounded-md p-2">
          <summary className="cursor-pointer">
            {progress.errors ?? progress.recent_errors.length} skip
            {(progress.errors ?? 1) === 1 ? "" : "s"} / error
            {(progress.errors ?? 1) === 1 ? "" : "s"}
          </summary>
          <ul className="mt-1 space-y-0.5 max-h-24 overflow-y-auto">
            {progress.recent_errors.map((e, i) => (
              <li key={i} className="font-mono text-[10px] truncate" title={e}>
                {e}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  disabled,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-[hsl(var(--widget-muted))]">
      <span className="flex items-center justify-between">
        <span>{label}</span>
        <span className="text-[10px] opacity-70">{hint}</span>
      </span>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="bg-transparent border-[hsl(var(--widget-border))] text-sm h-8"
      />
    </label>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function SourcesList({
  sources,
  onRemoved,
}: {
  sources: IndexedSource[];
  onRemoved: () => Promise<void>;
}) {
  const { toast } = useToast();

  const handleRemove = async (source: IndexedSource) => {
    try {
      const removed = await deleteByJob(source.job_id);
      toast({
        title: "Source removed",
        description: `Removed ${removed} chunk${removed === 1 ? "" : "s"} across ${source.page_count} page${source.page_count === 1 ? "" : "s"}.`,
      });
      await onRemoved();
    } catch (err) {
      toast({
        title: "Remove failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };

  if (sources.length === 0) {
    return (
      <p className="text-xs text-[hsl(var(--widget-muted))] py-6 text-center">
        No sources indexed yet.
      </p>
    );
  }

  return (
    <ul className="space-y-1 max-h-72 overflow-y-auto pr-1">
      {sources.map((s) => {
        const Icon = JOB_KIND_META[s.job_kind].Icon;
        return (
          <li
            key={s.job_id}
            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 group"
          >
            <Icon className="w-3.5 h-3.5 text-[hsl(var(--widget-muted))] shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate flex items-center gap-2">
                <span className="truncate">{s.job_label}</span>
                <span className="shrink-0 px-1.5 py-px rounded uppercase tracking-wider text-[9px] bg-white/5 text-[hsl(var(--widget-muted))]">
                  {JOB_KIND_META[s.job_kind].label}
                </span>
                {s.bias && s.bias !== "neutral" && (
                  <span
                    className={cn(
                      "shrink-0 px-1.5 py-px rounded uppercase tracking-wider text-[9px]",
                      s.bias === "core"
                        ? "bg-orange-500/20 text-orange-300"
                        : "bg-purple-500/20 text-purple-300",
                    )}
                  >
                    {s.bias}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-[hsl(var(--widget-muted))] truncate">
                {s.job_root_url}
              </div>
            </div>
            <div className="text-[10px] text-[hsl(var(--widget-muted))] shrink-0 text-right leading-tight">
              <div>
                {s.page_count} page{s.page_count === 1 ? "" : "s"} ·{" "}
                {s.chunk_count} chunk{s.chunk_count === 1 ? "" : "s"}
              </div>
              <div>{formatRelative(s.indexed_at)}</div>
            </div>
            <button
              onClick={() => void handleRemove(s)}
              className="p-1 text-[hsl(var(--widget-muted))] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Remove ${s.job_label}`}
              title="Remove"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function newJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function NostrTab({
  onIndexed,
  personaSlug,
}: {
  onIndexed: () => Promise<void>;
  personaSlug?: string;
}) {
  const llm = useLLM();
  const { toast } = useToast();
  const [relay, setRelay] = useState("wss://relay.damus.io");
  const [pubkey, setPubkey] = useState("");
  const [decrypt, setDecrypt] = useState(false);
  const [nsec, setNsec] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const nip07 = hasNip07();

  const handleSync = async () => {
    const relayTrimmed = relay.trim();
    if (!relayTrimmed) return;
    if (llm.status !== "ready") {
      toast({
        title: "Local AI not ready",
        description: "Wait for the in-browser model to finish loading.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    setStatusMsg("Connecting…");
    setDone(0);
    setTotal(0);
    try {
      const opts: NostrSyncOptions = {
        relayUrls: [relayTrimmed],
        targetPubkey: pubkey.trim() || undefined,
        decryptPrivate: decrypt,
        nsecHex: nsec.trim() || undefined,
        personaSlug,
        embed: llm.embed,
        onProgress: (msg, d, t) => {
          setStatusMsg(msg);
          setDone(d);
          setTotal(t);
        },
      };
      const result = await syncNostr(newJobId(), opts);
      toast({
        title: "NOSTR sync complete",
        description: `${result.events_fetched} events → ${result.chunks_indexed} chunks indexed${result.skipped ? ` (${result.skipped} skipped)` : ""}.`,
      });
      setNsec("");
      await onIndexed();
    } catch (err) {
      toast({
        title: "NOSTR sync failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      setStatusMsg("");
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-[hsl(var(--widget-muted))] space-y-1 bg-white/[0.03] border border-[hsl(var(--widget-border))] rounded-md p-3">
        <p>
          <span className="font-medium text-[hsl(var(--widget-fg))]">Sovereign sync.</span>{" "}
          Connect to any NOSTR relay, subscribe to a pubkey's events, and
          embed them locally. Nothing leaves your browser.
        </p>
        {nip07 && (
          <p className="text-emerald-400">
            NIP-07 extension detected. Decryption runs in your extension —
            your private key never enters Greater.
          </p>
        )}
        {!nip07 && (
          <p className="text-amber-300">
            No NIP-07 extension found. Install{" "}
            <a
              href="https://getalby.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Alby
            </a>{" "}
            for keyless decryption, or paste an nsec below (held in
            memory only, never stored).
          </p>
        )}
      </div>

      <label className="flex flex-col gap-1 text-[11px] text-[hsl(var(--widget-muted))]">
        Relay URL
        <Input
          value={relay}
          onChange={(e) => setRelay(e.target.value)}
          placeholder="wss://relay.damus.io"
          className="bg-transparent border-[hsl(var(--widget-border))] text-sm"
          disabled={busy}
        />
      </label>

      <label className="flex flex-col gap-1 text-[11px] text-[hsl(var(--widget-muted))]">
        Target pubkey (npub or hex) — leave blank to use your NIP-07 key
        <Input
          value={pubkey}
          onChange={(e) => setPubkey(e.target.value)}
          placeholder="npub1…"
          className="bg-transparent border-[hsl(var(--widget-border))] text-sm font-mono"
          disabled={busy}
        />
      </label>

      <div className="flex items-center gap-2">
        <input
          id="nostr-decrypt"
          type="checkbox"
          checked={decrypt}
          onChange={(e) => setDecrypt(e.target.checked)}
          disabled={busy}
          className="accent-emerald-500"
        />
        <label htmlFor="nostr-decrypt" className="text-[11px] text-[hsl(var(--widget-muted))] select-none cursor-pointer">
          Decrypt private events (kind 4 / encrypted)
        </label>
      </div>

      {decrypt && !nip07 && (
        <label className="flex flex-col gap-1 text-[11px] text-[hsl(var(--widget-muted))]">
          nsec (in-memory only — never stored or transmitted)
          <Input
            value={nsec}
            onChange={(e) => setNsec(e.target.value)}
            placeholder="nsec1… or hex private key"
            type="password"
            className="bg-transparent border-[hsl(var(--widget-border))] text-sm font-mono"
            disabled={busy}
          />
        </label>
      )}

      <div className="flex items-center gap-2">
        <Button
          onClick={() => void handleSync()}
          disabled={busy || !relay.trim() || llm.status !== "ready"}
          className="bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sync relay"}
        </Button>
        {llm.status !== "ready" && (
          <p className="text-[11px] text-amber-300">Local AI is still loading.</p>
        )}
      </div>

      {busy && statusMsg && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-[hsl(var(--widget-muted))]">
            <span className="truncate pr-2">{statusMsg}</span>
            {total > 0 && <span>{done}/{total}</span>}
          </div>
          <div className="h-1 bg-white/5 rounded overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: total > 0 ? `${Math.round((done / total) * 100)}%` : "0%" }}
            />
          </div>
        </div>
      )}

      <WikiCompilerSection />
    </div>
  );
}

function WikiCompilerSection() {
  const [state, setState] = useState<WikiCompilerState>(() =>
    getWikiCompilerState(),
  );
  const [showIndex, setShowIndex] = useState(false);
  const [indexContent, setIndexContent] = useState<string | null>(null);

  useEffect(() => {
    return subscribeWikiCompiler(setState);
  }, []);

  const handleViewIndex = async () => {
    try {
      const content = await getOrCompressWikiIndex(6000);
      setIndexContent(content ?? "_No wiki pages compiled yet._");
    } catch {
      setIndexContent("_Failed to read wiki index._");
    }
    setShowIndex(true);
  };

  const formatRelTs = (ts: number | null) => {
    if (!ts) return "never";
    const delta = Date.now() - ts;
    if (delta < 60_000) return "just now";
    if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
    if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
    return `${Math.floor(delta / 86_400_000)}d ago`;
  };

  return (
    <>
      <div className="border-t border-[hsl(var(--widget-border))] pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-[hsl(var(--widget-fg))]">
              Wiki-Compiler
            </span>
            {state.running && (
              <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={state.enabled}
            onClick={() => setWikiCompilerEnabled(!state.enabled)}
            className={cn(
              "relative inline-flex h-4 w-7 items-center rounded-full transition-colors",
              state.enabled ? "bg-emerald-600" : "bg-white/20",
            )}
          >
            <span
              className={cn(
                "inline-block h-3 w-3 rounded-full bg-white transition-transform",
                state.enabled ? "translate-x-3.5" : "translate-x-0.5",
              )}
            />
          </button>
        </div>

        {state.enabled ? (
          <div className="text-[10px] text-[hsl(var(--widget-muted))] space-y-1">
            <p>
              After each NOSTR sync, the local model synthesises new events
              into a persistent knowledge wiki. The compiled index is
              automatically injected into every chat turn.
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5">
              <span>
                Queue:{" "}
                <span className="text-[hsl(var(--widget-fg))]">
                  {state.queueDepth}
                </span>
              </span>
              <span>
                Last compiled:{" "}
                <span className="text-[hsl(var(--widget-fg))]">
                  {formatRelTs(state.lastUpdated)}
                </span>
              </span>
              {state.lastProcessed && (
                <span
                  className="truncate max-w-[180px]"
                  title={state.lastProcessed}
                >
                  Last event:{" "}
                  <span className="text-[hsl(var(--widget-fg))]">
                    {state.lastProcessed}
                  </span>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleViewIndex()}
              className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
            >
              View wiki/index.md
            </button>
          </div>
        ) : (
          <p className="text-[10px] text-[hsl(var(--widget-muted))]">
            Off by default. Enable to synthesise NOSTR events into a compiled
            knowledge wiki after each sync.
          </p>
        )}
      </div>

      {showIndex && (
        <Dialog open={showIndex} onOpenChange={(open) => !open && setShowIndex(false)}>
          <DialogContent className="max-w-2xl bg-[hsl(var(--widget-bg))] border-[hsl(var(--widget-border))] text-[hsl(var(--widget-fg))]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                wiki/index.md
              </DialogTitle>
              <DialogDescription className="text-[hsl(var(--widget-muted))]">
                Compiled knowledge index — injected into every chat turn as a
                dynamic context layer.
              </DialogDescription>
            </DialogHeader>
            <pre className="text-[11px] font-mono whitespace-pre-wrap max-h-96 overflow-y-auto bg-white/[0.03] border border-[hsl(var(--widget-border))] rounded-md p-3 leading-relaxed">
              {indexContent ?? "Loading…"}
            </pre>
            <button
              type="button"
              onClick={() => setShowIndex(false)}
              className="absolute right-3 top-3 p-1 text-[hsl(var(--widget-muted))] hover:text-[hsl(var(--widget-fg))]"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function LocalFilesTab({
  onIndexed,
  personaSlug,
}: {
  onIndexed: () => Promise<void>;
  personaSlug?: string;
}) {
  const llm = useLLM();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const supported = hasFileSystemAccess();

  const handlePick = async () => {
    if (llm.status !== "ready") {
      toast({
        title: "Local AI not ready",
        description: "Wait for the in-browser model to finish loading.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    setStatusMsg("Waiting for folder selection…");
    setDone(0);
    setTotal(0);
    try {
      const result = await syncLocalFiles(newJobId(), {
        embed: llm.embed,
        personaSlug,
        onProgress: (fileName, d, t) => {
          setStatusMsg(fileName);
          setDone(d);
          setTotal(t);
        },
      });
      toast({
        title: "Local files indexed",
        description: `"${result.directory_name}" — ${result.files_read} files → ${result.chunks_indexed} chunks${result.files_skipped ? ` (${result.files_skipped} skipped)` : ""}.`,
      });
      await onIndexed();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.toLowerCase().includes("aborted") || msg.toLowerCase().includes("cancel")) {
        return;
      }
      toast({
        title: "File sync failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      setStatusMsg("");
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-[hsl(var(--widget-muted))] space-y-1 bg-white/[0.03] border border-[hsl(var(--widget-border))] rounded-md p-3">
        <p>
          <span className="font-medium text-[hsl(var(--widget-fg))]">True data sovereignty.</span>{" "}
          Point Greater at a local folder — notes, docs, research — and it
          will chunk and embed everything directly in your browser. Files
          are never uploaded. Only embeddings land in IndexedDB.
        </p>
        <p>
          Supports .txt, .md, .json, .csv, .html, and most code files.
          Files over 5 MB are skipped. Subdirectories are walked
          automatically (up to 6 levels deep).
        </p>
        {!supported && (
          <p className="text-red-400">
            Your browser doesn't support the File System Access API. Use
            Chrome or Edge 86+.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={() => void handlePick()}
          disabled={busy || !supported || llm.status !== "ready"}
          className="bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-2"
        >
          <FolderOpen className="w-4 h-4" />
          {busy ? "Indexing…" : "Choose folder"}
        </Button>
        {llm.status !== "ready" && (
          <p className="text-[11px] text-amber-300">Local AI is still loading.</p>
        )}
      </div>

      {busy && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-[hsl(var(--widget-muted))]">
            <span className="truncate pr-2 font-mono">{statusMsg || "Scanning…"}</span>
            {total > 0 && <span>{done}/{total} files</span>}
          </div>
          <div className="h-1 bg-white/5 rounded overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: total > 0 ? `${Math.round((done / total) * 100)}%` : "5%" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressLine({ progress }: { progress: IngestProgress }) {
  const pct =
    progress.total_pages > 0
      ? Math.min(
          100,
          Math.round((progress.done_pages / progress.total_pages) * 100),
        )
      : 0;
  let label: string;
  switch (progress.stage) {
    case "discovering":
      label = "Discovering pages…";
      break;
    case "crawling":
      label = `Crawling ${progress.current_url ?? ""}`;
      break;
    case "extracting":
      label = `Extracting ${progress.current_url ?? ""}`;
      break;
    case "embedding":
      label = `Embedding ${progress.current_url ?? `chunk ${progress.done_chunks}`}…`;
      break;
    case "complete":
      label = "Complete.";
      break;
    case "error":
      label = `Error: ${progress.error ?? "unknown"}`;
      break;
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-[hsl(var(--widget-muted))]">
        <span className="truncate pr-2">{label}</span>
        <span>
          {progress.pages_fetched !== undefined ? (
            <>
              {progress.pages_fetched} fetched · {progress.done_pages} embedded ·{" "}
              {progress.done_chunks} chunks
            </>
          ) : (
            <>
              {progress.done_pages}/{progress.total_pages} pages ·{" "}
              {progress.done_chunks} chunks
            </>
          )}
        </span>
      </div>
      <div className="h-1 bg-white/5 rounded overflow-hidden">
        <div
          className={cn(
            "h-full transition-all",
            progress.stage === "error" ? "bg-red-500" : "bg-emerald-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
