import { useEffect, useRef, useState } from "react";
import { Terminal, X, Trash2, Circle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TerminalLogLine {
  id: number;
  ts: string;
  tag: string;
  text: string;
}

interface TerminalPanelProps {
  isOpen: boolean;
  onClose: () => void;
  lines: TerminalLogLine[];
  isActive: boolean;
  onClear: () => void;
}

function tagColor(tag: string): string {
  if (tag.startsWith("[WebGPU]")) return "text-emerald-400";
  if (tag.startsWith("[VectorStore]")) return "text-sky-400";
  if (tag.startsWith("[QACache]")) return "text-amber-400";
  if (tag.startsWith("[OpenClaw]")) return "text-purple-400";
  if (tag.startsWith("[NOSTR]")) return "text-pink-400";
  return "text-slate-400";
}

/**
 * Glass Engine Terminal Panel.
 *
 * Renders a dark monospace log of structured telemetry events emitted
 * during each local inference turn: vector retrieval, QA-cache checks,
 * WebGPU generation, and OpenClaw dispatch. Events flow in real time
 * from the worker and from LLMProvider state transitions; the panel
 * auto-scrolls to the latest line and caps the buffer at 200 entries
 * (enforced in ChatWidget).
 *
 * Modelled after HarnessPanel — same Dialog wrapper, same CSS tokens.
 */
export function TerminalPanel({
  isOpen,
  onClose,
  lines,
  isActive,
  onClear,
}: TerminalPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines, autoScroll]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    setAutoScroll(atBottom);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-[hsl(var(--widget-bg))] border-[hsl(var(--widget-border))] text-[hsl(var(--widget-fg))] p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Terminal className="w-4 h-4 text-emerald-400" />
            Glass Engine — live inference log
            {isActive && (
              <span className="ml-1 flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium text-emerald-400">
                <Circle className="w-2 h-2 fill-emerald-400 animate-pulse" />
                live
              </span>
            )}
            {!isActive && lines.length > 0 && (
              <span className="ml-1 text-[10px] text-[hsl(var(--widget-muted))] font-normal normal-case tracking-normal">
                ({lines.length} events)
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-[hsl(var(--widget-muted))] text-xs">
            Real-time events from the WebGPU inference worker and vector retrieval layer.
            No prompt text is shown here — only execution events.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="mx-4 my-3 rounded-md border border-[hsl(var(--widget-border))] bg-black/60 h-72 overflow-y-auto font-mono text-[11px] leading-relaxed p-3 space-y-0.5"
          aria-live="polite"
          aria-label="Glass Engine terminal log"
          data-testid="terminal-log"
        >
          {lines.length === 0 ? (
            <div className="text-slate-500 italic select-none">
              Waiting for inference turn…<br />
              Send a message to see live execution events here.
            </div>
          ) : (
            lines.map((line) => (
              <div key={line.id} className="flex gap-2 items-baseline">
                <span className="text-slate-600 shrink-0 select-none tabular-nums">
                  {line.ts}
                </span>
                <span className={cn("shrink-0 font-semibold", tagColor(line.tag))}>
                  {line.tag}
                </span>
                <span className="text-slate-300 break-all">{line.text}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {!autoScroll && lines.length > 0 && (
          <div className="px-4 pb-1">
            <button
              type="button"
              onClick={() => {
                setAutoScroll(true);
                bottomRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-[10px] text-emerald-400 hover:underline"
            >
              ↓ Jump to latest
            </button>
          </div>
        )}

        <div className="flex items-center justify-between px-4 pb-4 pt-1 border-t border-[hsl(var(--widget-border))]">
          <p className="text-[10px] text-[hsl(var(--widget-muted))] leading-relaxed max-w-xs">
            Events clear automatically each session. Raw prompt text is never shown.
          </p>
          <div className="flex items-center gap-2">
            {lines.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="text-[hsl(var(--widget-muted))] hover:text-red-400 text-xs gap-1.5"
                data-testid="terminal-clear"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-[hsl(var(--widget-muted))] hover:text-[hsl(var(--widget-fg))] text-xs"
            >
              Close
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 p-1 text-[hsl(var(--widget-muted))] hover:text-[hsl(var(--widget-fg))]"
          aria-label="Close terminal panel"
        >
          <X className="w-4 h-4" />
        </button>
      </DialogContent>
    </Dialog>
  );
}
