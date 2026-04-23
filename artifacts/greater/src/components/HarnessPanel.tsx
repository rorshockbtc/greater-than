import { useEffect, useState } from "react";
import { ScrollText, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const MAX_CHARS = 8192;

const HARNESS_TEMPLATE = `\
# Local Harness — paste or write your charter here
#
# Everything in this block is injected at the very top of the system
# prompt on every chat turn, before the persona identity and before
# the retrieved knowledge snippets. Use it to:
#
#   [Identity]   Tell the bot whose brand it speaks for.
#   [Rules]      Hard constraints the model must never break.
#   [Index]      A compressed, pipe-delimited knowledge index so the
#                model has an orientation map even before RAG fires.
#
# Lines starting with # are comments — the model will still read them,
# so keep them short or remove them once you are editing for real.
#
# ── Template ────────────────────────────────────────────────────────

[Identity]: You are the support assistant for Acme Corp.

[Rule 1]: IMPORTANT — Prefer retrieval-led reasoning over
pre-training-led reasoning. If the knowledge snippets do not cover
a question, say so plainly and suggest the contact form.

[Rule 2]: Never discuss competitors by name.

[Index]:
| /pricing        | Pro is $99/mo, Enterprise is custom
| /security       | SOC 2 Type II certified, AES-256 at rest
| /onboarding     | 14-day free trial, no credit card required
| /integrations   | Zapier, Slack, Salesforce out of the box

# ────────────────────────────────────────────────────────────────────
# See HARNESS_BEST_PRACTICES.md in the repo root for the full guide.`;

function loadHarness(slug: string): string {
  try {
    return localStorage.getItem(`greater:harness:${slug}`) ?? "";
  } catch {
    return "";
  }
}

function saveHarness(slug: string, text: string) {
  try {
    if (text.trim()) {
      localStorage.setItem(`greater:harness:${slug}`, text);
    } else {
      localStorage.removeItem(`greater:harness:${slug}`);
    }
  } catch {
    // localStorage quota exceeded or private browsing — silently ignore.
  }
}

/**
 * Local Harness panel.
 *
 * Lets the operator paste a compressed charter (identity block, rules,
 * pipe-delimited index) that gets injected at the very top of the
 * system prompt on every chat turn — before the persona identity and
 * before the RAG chunks. The charter is stored in localStorage, keyed
 * by persona slug, and is persona-specific so different bots can carry
 * different harnesses without interfering with each other.
 *
 * This is the FOSS "manual transmission" equivalent of a curated Pipe.
 * See HARNESS_BEST_PRACTICES.md for the authoring guide.
 *
 * When `importedText` is non-empty the panel opens in review mode:
 * the textarea is pre-filled with the imported harness, a banner
 * explains the content is not yet active, and the user must
 * explicitly click Save to apply it. Closing without saving discards
 * the import without touching the existing stored harness.
 */
export function HarnessPanel({
  isOpen,
  onClose,
  personaSlug,
  onHarnessChange,
  importedText,
  onImportedTextConsumed,
}: {
  isOpen: boolean;
  onClose: () => void;
  personaSlug: string;
  onHarnessChange: (text: string) => void;
  /**
   * When provided (non-empty) the panel opens pre-filled with this
   * text in review mode. The user must click Save to apply.
   */
  importedText?: string;
  /**
   * Called after the user has saved (or dismissed) the import so the
   * parent can clear the pending `importedText` state.
   */
  onImportedTextConsumed?: () => void;
}) {
  const isImportReview = Boolean(importedText && importedText.trim());

  const [draft, setDraft] = useState(
    () => loadHarness(personaSlug) || HARNESS_TEMPLATE,
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (isImportReview && importedText) {
        setDraft(importedText);
      } else {
        setDraft(loadHarness(personaSlug) || HARNESS_TEMPLATE);
      }
      setSaved(false);
    }
  }, [isOpen, personaSlug, isImportReview, importedText]);

  const handleSave = () => {
    saveHarness(personaSlug, draft);
    onHarnessChange(draft.trim());
    setSaved(true);
    onImportedTextConsumed?.();
  };

  const handleClear = () => {
    setDraft("");
    saveHarness(personaSlug, "");
    onHarnessChange("");
    setSaved(false);
  };

  const handleClose = () => {
    onImportedTextConsumed?.();
    onClose();
  };

  const charCount = draft.length;
  const overLimit = charCount > MAX_CHARS;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl bg-[hsl(var(--widget-bg))] border-[hsl(var(--widget-border))] text-[hsl(var(--widget-fg))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-emerald-400" />
            Local Harness
          </DialogTitle>
          <DialogDescription className="text-[hsl(var(--widget-muted))]">
            Write a compressed charter — identity rules, constraints, and a
            knowledge index — and it will be injected at the top of every
            system prompt. This is the FOSS alternative to a curated Pipe.
          </DialogDescription>
        </DialogHeader>

        {isImportReview && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-[11px] text-amber-300 leading-relaxed">
            <span className="font-semibold">Imported harness — review before saving.</span>{" "}
            This content came from a greater-export file and has not been applied yet.
            Edit as needed, then click{" "}
            <span className="font-semibold">Save harness</span> to activate it.
            Closing the panel without saving discards this import.
          </div>
        )}

        <div className="space-y-3">
          <textarea
            value={draft}
            readOnly={isImportReview}
            onChange={(e) => {
              if (isImportReview) return;
              setDraft(e.target.value);
              setSaved(false);
            }}
            rows={14}
            spellCheck={false}
            className={`w-full resize-y rounded-md border border-[hsl(var(--widget-border))] bg-transparent px-3 py-2 font-mono text-xs text-[hsl(var(--widget-fg))] placeholder:text-[hsl(var(--widget-muted))]/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 ${isImportReview ? "opacity-80 cursor-default select-all" : ""}`}
            data-testid="harness-textarea"
          />

          <div className="flex items-center justify-between gap-3">
            <span
              className={`text-[11px] tabular-nums ${
                overLimit
                  ? "text-red-400"
                  : charCount > MAX_CHARS * 0.85
                    ? "text-amber-400"
                    : "text-[hsl(var(--widget-muted))]"
              }`}
              aria-live="polite"
            >
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} chars
              {overLimit && " — over the 8 KB target"}
            </span>

            <div className="flex items-center gap-2">
              {draft.trim() && !isImportReview && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="text-[hsl(var(--widget-muted))] hover:text-red-400 text-xs"
                  data-testid="harness-clear"
                >
                  Clear
                </Button>
              )}
              <Button
                type="button"
                onClick={handleSave}
                disabled={overLimit}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                data-testid="harness-save"
              >
                {saved ? "Saved ✓" : "Save harness"}
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-[hsl(var(--widget-border))] bg-white/[0.03] p-3 text-[11px] text-[hsl(var(--widget-muted))] space-y-1.5">
            <p className="font-medium text-[hsl(var(--widget-fg))]">
              How it works
            </p>
            <ul className="list-disc pl-4 space-y-0.5 leading-relaxed">
              <li>
                The harness is injected <em>before</em> the persona identity and
                before any retrieved knowledge on every turn — it sets the outer
                frame the model reasons inside.
              </li>
              <li>
                Keep the total under 8 KB so it doesn&rsquo;t crowd out the
                knowledge snippets. A compressed pipe-delimited index (
                <code className="font-mono">| /pricing | $99/mo</code>) fits
                more facts per character than prose.
              </li>
              <li>
                This is the manual version. When the maintenance burden becomes
                clear, that&rsquo;s the moment to ask about a curated Pipe —
                see{" "}
                <a
                  href="https://hire.colonhyphenbracket.pink"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-emerald-400 hover:underline"
                >
                  hire.colonhyphenbracket.pink
                </a>
                .
              </li>
            </ul>
          </div>
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 p-1 text-[hsl(var(--widget-muted))] hover:text-[hsl(var(--widget-fg))]"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </DialogContent>
    </Dialog>
  );
}
