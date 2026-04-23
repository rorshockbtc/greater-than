import type { BiasOption } from "@workspace/pipes";
import { cn } from "@/lib/utils";

/**
 * Segmented control for switching the active bias on a multi-bias
 * Pipe (e.g. Bitcoin Greater's Neutral / Core / Knots). Renders only
 * when the active Pipe declares more than one bias_option.
 *
 * The mode-switch UX (inline note in the conversation, allowing the
 * bot to contradict prior messages) is handled by the parent on
 * `onChange` — this component is purely presentational.
 */
export function BiasToggle({
  options,
  activeId,
  onChange,
  disabled = false,
}: {
  options: BiasOption[];
  activeId: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  if (options.length < 2) return null;
  return (
    <div
      role="radiogroup"
      aria-label="Bias perspective"
      className="inline-flex rounded-md border border-[hsl(var(--widget-border))] bg-white/5 overflow-hidden text-[10px] font-medium uppercase tracking-wider"
    >
      {options.map((opt) => {
        const isActive = opt.id === activeId;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled || isActive}
            title={opt.description}
            onClick={() => onChange(opt.id)}
            className={cn(
              "px-2.5 py-1 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-pink-400",
              isActive
                ? "bg-pink-500 text-white"
                : "text-[hsl(var(--widget-muted))] hover:bg-white/10 hover:text-[hsl(var(--widget-fg))]",
            )}
            data-testid={`bias-option-${opt.id}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
