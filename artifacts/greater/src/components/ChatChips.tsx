import React from "react";

/**
 * One choice in a ChatChips row. The id is used for keying and for
 * telemetry; the label is what the user sees and what gets sent as
 * the next user message when they click.
 */
export interface ChipOption {
  id: string;
  label: string;
  /** Optional short summary shown as a tooltip / second line. */
  summary?: string;
}

interface ChatChipsProps {
  options: ChipOption[];
  /**
   * Called with the chip's label when the user clicks. The chat
   * widget treats this as if the user typed `label` themselves —
   * it gets pushed to the transcript and routed through the same
   * pipeline as a normal turn.
   */
  onPick: (option: ChipOption) => void;
  /** Optional caption rendered above the chip row. */
  caption?: string;
  /** Disable interaction, e.g. while a turn is in flight. */
  disabled?: boolean;
}

/**
 * Clickable chip row rendered below a bot bubble whenever the
 * navigator returned `clarifyOptions` (or whenever the chat widget
 * decides to surface escape hatches alongside a confident answer).
 *
 * Visual convention: pink-bordered pills on the widget surface,
 * mirroring the brand accent. Wraps freely so 3-4 chips look fine on
 * narrow widget instances.
 */
export function ChatChips({
  options,
  onPick,
  caption,
  disabled = false,
}: ChatChipsProps) {
  if (options.length === 0) return null;
  return (
    <div className="mt-2.5 flex flex-col gap-1.5" data-testid="chat-chips">
      {caption ? (
        <div className="text-[11px] uppercase tracking-wide text-[hsl(var(--widget-muted))]">
          {caption}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(opt)}
            title={opt.summary}
            className={[
              "inline-flex max-w-full items-center gap-1 rounded-full border px-3 py-1 text-xs",
              "border-[hsl(var(--brand-pink,330_99%_59%))/0.4] text-[hsl(var(--widget-fg))]",
              "bg-[hsl(var(--widget-card))] hover:bg-[hsl(var(--brand-pink,330_99%_59%))/0.12]",
              "transition-colors",
              disabled
                ? "opacity-50 cursor-not-allowed"
                : "cursor-pointer",
            ].join(" ")}
            data-testid={`chat-chip-${opt.id}`}
          >
            <span className="truncate">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
