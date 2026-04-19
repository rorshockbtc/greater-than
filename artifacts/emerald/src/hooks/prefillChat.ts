/**
 * Open the chat widget and drop a suggested prompt into the input
 * box without sending it. Used by both the Blockstream demo and the
 * generic PersonaDemoShell to honor the "Open the chat with this
 * question" CTA on the ScenarioModal.
 *
 * Implemented DOM-side because ChatWidget owns its own input state;
 * the data-testid hooks already in the widget make this targeted and
 * safe. If the widget changes its query selectors, update both here
 * and the corresponding ChatWidget elements.
 */
export function prefillChat(prompt: string): void {
  const openBtn = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Open chat"]',
  );
  openBtn?.click();
  // Wait one frame for the textarea to mount, then inject the value
  // through React's prototype setter so React's onChange fires.
  requestAnimationFrame(() => {
    const ta = document.querySelector<HTMLTextAreaElement>(
      ".chat-widget textarea",
    );
    if (!ta) return;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    setter?.call(ta, prompt);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.focus();
  });
}
