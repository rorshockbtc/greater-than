/**
 * Per-route transcript storage. The chat widget writes the current
 * conversation here on every message change; the ticket-preview
 * route reads the latest snapshot for a given persona slug.
 *
 * Scope:
 *  - sessionStorage (per-tab, ephemeral) — matches the
 *    "your transcript never leaves this browser" promise.
 *  - One key per persona route slug so two demos open in adjacent
 *    tabs don't collide. (sessionStorage is per-tab anyway, but the
 *    slug keying makes intent explicit.)
 */

export interface StoredTranscript {
  /** ISO timestamp of the most recent message in the transcript. */
  updatedAt: string;
  /** Stable id of the chat widget that produced the transcript. */
  sessionId: string;
  /** URL slug of the demo route (e.g. "blockstream", "startups"). */
  routeSlug: string;
  /** Persona slug from `data/personas` (e.g. "fintech"). May differ
   * from `routeSlug` (Blockstream's URL slug is "blockstream" but
   * its persona slug is "fintech"). */
  personaSlug: string;
  /** Brand the visitor saw in the chat header (e.g. "Blockstream"). */
  personaBrand: string;
  /** Active bias when the transcript was captured (id + label). */
  biasId?: string;
  biasLabel?: string;
  turns: { role: "user" | "bot"; content: string; timestamp: string }[];
}

function key(routeSlug: string) {
  return `greater:transcript:${routeSlug}`;
}

export function saveTranscript(t: StoredTranscript): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key(t.routeSlug), JSON.stringify(t));
  } catch {
    // sessionStorage can throw in private mode / quota-exceeded.
    // The ticket preview is a "nice to have" — failing silently is
    // strictly preferable to breaking the chat itself.
  }
}

export function loadTranscript(routeSlug: string): StoredTranscript | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key(routeSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTranscript;
    if (!parsed?.turns?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}
