/**
 * Tiny client-side debug-log shipper. Active only when the URL has
 * `?debug=1`. Posts one NDJSON event per call to /api/debug-log on
 * the API server (which only accepts writes in dev). Used by
 * ChatWidget to ship every user/bot turn + every telemetry event
 * during a live shit-test session so the agent can read the full
 * conversation trace from disk instead of asking for copy-paste.
 *
 * Fire-and-forget. Never throws. Never awaited from caller hot paths.
 */

let cachedEnabled: boolean | null = null;

function isEnabled(): boolean {
  if (cachedEnabled !== null) return cachedEnabled;
  if (typeof window === "undefined") {
    cachedEnabled = false;
    return false;
  }
  try {
    const params = new URLSearchParams(window.location.search);
    cachedEnabled = params.get("debug") === "1";
  } catch {
    cachedEnabled = false;
  }
  return cachedEnabled ?? false;
}

const sessionId = (() => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
})();

interface DebugEventBase {
  kind: string;
  [k: string]: unknown;
}

export function debugLog(event: DebugEventBase): void {
  if (!isEnabled()) return;
  const payload = {
    debugSessionId: sessionId,
    clientTs: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : null,
    ...event,
  };
  try {
    // BASE_URL respects the artifact's path prefix in this monorepo.
    // The API is reverse-proxied from the same origin in dev.
    fetch(`/api/debug-log`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      /* swallow — debug never breaks the chat */
    });
    // Mirror to console too — useful when devtools is open and lets
    // the existing browser-log capture pick it up as a backup.
    // eslint-disable-next-line no-console
    console.log("[shittest]", event.kind, event);
  } catch {
    /* swallow */
  }
}

export function debugIsEnabled(): boolean {
  return isEnabled();
}
