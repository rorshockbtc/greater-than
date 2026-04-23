import { AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PersonaScenario } from "@/data/personas";

/**
 * Pre-roll modal that introduces a persona demo. Surfaces the
 * specific failure mode the demo is dramatizing, what Greater does
 * differently, and a one-tap suggested prompt so the visitor isn't
 * staring at a blank input. Shown once per session per persona.
 *
 * Built on top of the shared Radix-based `Dialog` primitive — that
 * gives us focus trap, Escape-to-close, focus restore on close, and
 * proper aria-modal semantics for free.
 */
export interface ScenarioModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * Called when the visitor chooses to try the suggested prompt. The
   * containing demo shell is responsible for opening the chat and
   * pre-filling the input.
   */
  onTryPrompt: () => void;
  scenario: PersonaScenario;
  /** "Vellum" / "Cornerstone" / etc. — used in the modal heading. */
  brand: string;
  /** "Startups" / "Faith" / etc. — used in the modal eyebrow. */
  personaName: string;
}

export function ScenarioModal({
  open,
  onClose,
  onTryPrompt,
  scenario,
  brand,
  personaName,
}: ScenarioModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-2xl bg-[hsl(220,13%,10%)] border-white/10 text-white p-0 gap-0 overflow-hidden"
        // Escape + scrim click are handled by the primitive; nothing to wire.
      >
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-white/10 space-y-1 text-left">
          <DialogDescription
            className="text-[11px] uppercase tracking-[0.18em] text-pink-400/90 font-mono"
          >
            Demo &middot; {personaName}
          </DialogDescription>
          <DialogTitle className="text-lg sm:text-xl font-semibold">
            What this demo is dramatizing on{" "}
            <span className="text-pink-300">{brand}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">
          <section>
            <div className="flex items-center gap-2 mb-2 text-amber-300">
              <AlertTriangle className="w-4 h-4" />
              <h3 className="text-sm font-semibold uppercase tracking-wider">
                The failure mode
              </h3>
            </div>
            <p className="text-sm font-medium text-white mb-1.5 leading-snug">
              {scenario.failureMode.headline}
            </p>
            <p className="text-sm text-white/70 leading-relaxed">
              {scenario.failureMode.body}
            </p>
            {scenario.failureMode.namedExample && (
              <p className="text-[11px] text-white/40 mt-2 font-mono">
                Composite of: {scenario.failureMode.namedExample}
              </p>
            )}
          </section>

          <section>
            <div className="flex items-center gap-2 mb-2 text-pink-400">
              <Sparkles className="w-4 h-4" />
              <h3 className="text-sm font-semibold uppercase tracking-wider">
                What Greater does
              </h3>
            </div>
            <p className="text-sm text-white/80 leading-relaxed">
              {scenario.pivot}
            </p>
          </section>

          <section className="rounded-lg border border-pink-500/30 bg-pink-500/5 p-4">
            <p className="text-[11px] uppercase tracking-wider text-pink-300/80 font-mono mb-1.5">
              Try this question
            </p>
            <p className="text-base text-white leading-snug font-medium mb-3">
              &ldquo;{scenario.promptSuggestion}&rdquo;
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onTryPrompt}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-500 text-white text-sm font-medium hover:bg-pink-400 transition-colors"
                data-testid="button-try-prompt"
              >
                Open the chat with this question
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 text-white/80 text-sm font-medium hover:bg-white/5 transition-colors"
              >
                Just look around
              </button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
