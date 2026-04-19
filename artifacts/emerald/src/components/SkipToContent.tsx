import React from "react";

/**
 * WCAG 2.4.1 ("Bypass Blocks") skip-to-content link.
 *
 * Visually hidden until focused, then docked top-left in a high-
 * contrast pill. Targets `#main-content` on the current document by
 * default — every page (Greater shell + every demo shell + the ticket
 * preview) renders an element with `id="main-content"` as its first
 * focusable landmark, so a keyboard user can bypass the persona's
 * branded chrome (nav bar, breadcrumb, pricing pills) and jump
 * straight to the article body.
 */
export function SkipToContent({
  targetId = "main-content",
}: {
  targetId?: string;
}) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-md focus:bg-pink-600 focus:text-white focus:text-sm focus:font-medium focus:outline-none focus:ring-2 focus:ring-white"
      data-testid="link-skip-to-content"
    >
      Skip to content
    </a>
  );
}
