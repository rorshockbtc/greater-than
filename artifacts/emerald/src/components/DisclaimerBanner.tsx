import React, { useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, X, ExternalLink } from "lucide-react";
import { getDisclaimer } from "@/data/disclaimers";

export interface DisclaimerBannerProps {
  /** Persona slug — drives the per-persona copy from `disclaimers.ts`. */
  personaSlug: string;
  /**
   * Origin used to absolute-link the "Learn more" target. Optional;
   * defaults to a relative path (`/compliance#…`). Demos hosted under a
   * different base path can pass an explicit origin so the link
   * resolves against the marketing site, not the demo.
   */
  complianceOrigin?: string;
}

/**
 * Conversation-init compliance banner. Rendered once per chat widget
 * mount as a *transcript-shaped* system note (so it lives where the
 * visitor's eye already is, not in the page chrome). Visually distinct
 * from a normal bot reply: pink left rule + muted background, like a
 * margin-note. Dismissible per session via `sessionStorage`.
 *
 * Accessibility:
 *   - Wrapped in `role="status"` + `aria-live="polite"` so screen
 *     readers announce the disclaimer when the chat opens.
 *   - The "Learn more" link is a real, focusable `<a>`.
 *   - The dismiss button has an `aria-label` and respects keyboard.
 */
export function DisclaimerBanner({
  personaSlug,
  complianceOrigin,
}: DisclaimerBannerProps) {
  const dismissKey = `greater.disclaimer.dismissed.${personaSlug}`;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(dismissKey) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const copy = getDisclaimer(personaSlug);
  const href = complianceOrigin
    ? `${complianceOrigin.replace(/\/$/, "")}/compliance#${copy.learnMoreAnchor}`
    : `/compliance#${copy.learnMoreAnchor}`;

  return (
    <motion.aside
      role="status"
      aria-live="polite"
      aria-label="Conversation disclaimer"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      data-testid="disclaimer-banner"
      className="relative mb-5 rounded-md border border-pink-500/30 bg-pink-500/5 pl-4 pr-9 py-3 text-[13px] leading-relaxed text-[hsl(var(--widget-fg))]"
      style={{ borderLeftWidth: 3 }}
    >
      <div className="flex items-start gap-2.5">
        <ShieldAlert
          className="w-4 h-4 mt-0.5 shrink-0 text-pink-300"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="text-[hsl(var(--widget-fg))]">{copy.body}</p>
          {copy.detail && (
            <p className="mt-1.5 text-[hsl(var(--widget-muted))]">
              {copy.detail}
            </p>
          )}
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-flex items-center gap-1 text-pink-300 hover:text-pink-200 underline underline-offset-2 text-[12px]"
            data-testid="link-disclaimer-learn-more"
          >
            {copy.learnMoreLabel ?? "Learn more"}
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          try {
            window.sessionStorage.setItem(dismissKey, "1");
          } catch {
            /* ignore */
          }
          setDismissed(true);
        }}
        aria-label="Dismiss disclaimer"
        className="absolute top-2 right-2 p-1 rounded-md text-[hsl(var(--widget-muted))] hover:text-[hsl(var(--widget-fg))] focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
        data-testid="button-disclaimer-dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.aside>
  );
}
