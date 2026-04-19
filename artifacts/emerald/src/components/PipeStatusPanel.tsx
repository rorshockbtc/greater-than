import { Cable, Clock, Unplug, X } from "lucide-react";
import { useContact } from "@/components/ContactContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePipe } from "@/pipes/PipeContext";
import { listPipes } from "@/pipes/registry";
import { cn } from "@/lib/utils";

/**
 * Pipe Status Panel — reachable from the chat widget's settings
 * dropdown. Shows which Pipe is loaded, its persona/version/signature
 * status, the available bias options (with the active one highlighted),
 * the bundled corpora it ships, and a "Disconnect Pipe" button that
 * drops the chat to Generic mode for the current session.
 */
export function PipeStatusPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { pipe, activeBiasId, connected, disconnect, reconnect } = usePipe();
  const contact = useContact();
  // Whether *any* Pipe is mounted on disk, regardless of whether the
  // user has disconnected it for this session. Used to decide if the
  // "Generic mode" panel should offer a reconnect button.
  const hasDisconnectedPipe = !connected && listPipes().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg bg-[hsl(var(--widget-bg))] border-[hsl(var(--widget-border))] text-[hsl(var(--widget-fg))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cable className="w-4 h-4 text-pink-400" />
            Pipe status
          </DialogTitle>
          <DialogDescription className="text-[hsl(var(--widget-muted))]">
            Pipes are curated, opinionated knowledge bundles authored by
            domain experts. The shell is fully functional without one;
            loading a Pipe transforms it into "Greater mode."
          </DialogDescription>
        </DialogHeader>

        {!pipe && !connected && (
          <div className="rounded-md border border-[hsl(var(--widget-border))] bg-white/5 px-3 py-3 text-xs text-[hsl(var(--widget-muted))] leading-relaxed">
            <p className="font-medium text-[hsl(var(--widget-fg))] mb-1">
              Generic mode
            </p>
            <p>
              No Pipe is currently mounted for this demo.{" "}
              {hasDisconnectedPipe ? (
                <>
                  A Pipe is available locally — you can{" "}
                  <button
                    type="button"
                    onClick={reconnect}
                    className="underline text-pink-400 hover:text-pink-300"
                  >
                    reconnect it for this session
                  </button>
                  .
                </>
              ) : (
                <>
                  In a public fork this is expected: the FOSS shell ships
                  no bundled Pipes. Want one curated for your domain?
                  Visit hire.colonhyphenbracket.pink.
                </>
              )}
            </p>
          </div>
        )}

        {pipe && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{pipe.name}</div>
                <div className="text-[11px] text-[hsl(var(--widget-muted))] font-mono">
                  {pipe.pipe_id} · v{pipe.version} · persona “{pipe.persona}”
                </div>
                <div className="text-[10px] text-[hsl(var(--widget-muted))] mt-0.5">
                  Authored {new Date(pipe.created_at).toLocaleDateString()} ·{" "}
                  {pipe.corpus_bundles.reduce((n, b) => n + b.chunk_count, 0)}{" "}
                  chunks across {pipe.corpus_bundles.length} bundle
                  {pipe.corpus_bundles.length === 1 ? "" : "s"}
                </div>
              </div>
              <SignatureBadge
                status={pipe.signature.status}
                onAskAboutSigning={() => {
                  onClose();
                  contact.open();
                }}
              />
            </div>

            {pipe.author_notes && (
              <p className="text-[11px] text-[hsl(var(--widget-muted))] leading-relaxed border-l-2 border-pink-400/40 pl-2">
                {pipe.author_notes}
              </p>
            )}

            <div>
              <h4 className="text-[10px] uppercase tracking-wider text-[hsl(var(--widget-muted))] mb-1">
                Bias options
              </h4>
              <ul className="space-y-1.5">
                {pipe.bias_options.map((opt) => {
                  const isActive = opt.id === activeBiasId;
                  return (
                    <li
                      key={opt.id}
                      className={cn(
                        "flex items-start gap-2 rounded px-2 py-1.5 border",
                        isActive
                          ? "border-pink-500/40 bg-pink-500/10"
                          : "border-transparent",
                      )}
                    >
                      <span
                        className={cn(
                          "shrink-0 mt-0.5 px-1.5 py-px rounded uppercase tracking-wider text-[9px]",
                          isActive
                            ? "bg-pink-500 text-white"
                            : "bg-white/5 text-[hsl(var(--widget-muted))]",
                        )}
                      >
                        {opt.label}
                      </span>
                      <span className="text-[11px] text-[hsl(var(--widget-fg))]/90 leading-relaxed">
                        {opt.description}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {pipe.corpus_bundles.length > 0 && (
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-[hsl(var(--widget-muted))] mb-1">
                  Bundled corpora
                </h4>
                <ul className="space-y-1.5 text-[11px]">
                  {pipe.corpus_bundles.map((b) => {
                    const distEntries = Object.entries(b.bias_distribution);
                    return (
                      <li
                        key={b.path}
                        className="px-2 py-1.5 rounded bg-white/5 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono truncate">{b.path}</span>
                          <span className="shrink-0 text-[hsl(var(--widget-muted))]">
                            {b.chunk_count} chunks
                          </span>
                        </div>
                        {distEntries.length > 0 && (
                          <div className="flex flex-wrap gap-1 text-[10px] text-[hsl(var(--widget-muted))]">
                            {distEntries.map(([biasId, count]) => (
                              <span
                                key={biasId}
                                className="inline-flex items-center gap-1 px-1.5 py-px rounded bg-white/5 border border-[hsl(var(--widget-border))]"
                              >
                                <span className="font-mono uppercase tracking-wider text-[9px]">
                                  {biasId}
                                </span>
                                <span className="tabular-nums">{count}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-[hsl(var(--widget-border))]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  disconnect();
                  onClose();
                }}
                className="text-xs gap-1.5"
                data-testid="button-disconnect-pipe"
              >
                <Unplug className="w-3.5 h-3.5" />
                Disconnect Pipe (this session)
              </Button>
            </div>
          </div>
        )}

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

function SignatureBadge({
  status,
  onAskAboutSigning,
}: {
  status: "unsigned" | "signed" | "invalid";
  onAskAboutSigning: () => void;
}) {
  if (status === "signed") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">
        Signed
      </span>
    );
  }
  if (status === "invalid") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-red-400 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded">
        Invalid signature
      </span>
    );
  }
  // Unsigned: opt-in for the next phase. Signed Pipes (with session
  // persistence and integrity verification) are on the roadmap; the
  // badge invites the visitor to ask us about it via the contact form.
  return (
    <button
      type="button"
      onClick={onAskAboutSigning}
      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
      title="Signed Pipes with session persistence are on the roadmap. Click to ask us about it."
    >
      <Clock className="w-3 h-3" />
      Signing — coming soon · ask about session persistence
    </button>
  );
}

