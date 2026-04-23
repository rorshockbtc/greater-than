import { useCallback, useEffect, useState } from "react";

/**
 * Per-persona scenario-modal state, persisted in `sessionStorage` so
 * the pre-roll modal opens automatically the first time a visitor
 * lands on a demo route in their session, then stays dismissed across
 * navigation/refresh until they reopen it from the chat header.
 *
 * Keyed by persona slug so each demo has its own dismissed state —
 * a visitor who has already seen the FinTech intro should still see
 * the HealthTech intro the first time they land on `/demo/healthtech`.
 *
 * Shape:
 *   - `open`     : whether the modal is currently rendered
 *   - `dismiss`  : close the modal AND mark this persona as dismissed
 *   - `reopen`   : show the modal again (e.g. from the chat header
 *                  "What's this demo?" button); does not unset the
 *                  dismissed flag, since reopening is an intentional
 *                  user action and should not re-trigger on refresh.
 */
export function useScenarioModal(slug: string) {
  const storageKey = `greater.scenario-dismissed.${slug}`;
  // `undefined` until we read sessionStorage on mount — we don't want
  // to flash the modal open during SSR/hydration or before reading.
  // It's a SPA so this is mostly defensive, but it also avoids a
  // blink when the user navigates between persona demos.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(storageKey) === "1";
    } catch {
      // sessionStorage can throw in private mode / sandboxed iframes.
      // In that case treat as not-dismissed: showing the modal once
      // per page load is the safe default.
    }
    setOpen(!dismissed);
  }, [storageKey]);

  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      /* ignore — see above */
    }
  }, [storageKey]);

  const reopen = useCallback(() => {
    setOpen(true);
  }, []);

  return { open, dismiss, reopen };
}
