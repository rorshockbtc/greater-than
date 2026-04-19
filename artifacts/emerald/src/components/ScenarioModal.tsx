import { AlertTriangle, ArrowRight, Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { PersonaScenario } from "@/data/personas";

/**
 * Pre-roll modal that introduces a persona demo. Surfaces the
 * specific failure mode the demo is dramatizing, what Greater does
 * differently, and a one-tap suggested prompt so the visitor isn't
 * staring at a blank input. Shown once per session per persona.
 *
 * The visual chrome is intentionally Greater-branded (CHB pink + dark
 * card) — it's a frame around the mock host, not part of it.
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
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="card"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scenario-modal-title"
          >
            <div className="pointer-events-auto w-full max-w-2xl bg-[hsl(220,13%,10%)] border border-white/10 rounded-2xl shadow-2xl text-white overflow-hidden">
              <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-white/10">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-pink-400/90 font-mono">
                    Demo &middot; {personaName}
                  </p>
                  <h2
                    id="scenario-modal-title"
                    className="text-lg sm:text-xl font-semibold mt-1"
                  >
                    What this demo is dramatizing on{" "}
                    <span className="text-pink-300">{brand}</span>
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close scenario"
                  className="p-1.5 text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

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
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
