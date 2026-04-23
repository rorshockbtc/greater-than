import { useEffect } from "react";

const SUFFIX = "Greater";

/**
 * Sets `document.title` for the lifetime of the calling component.
 * Pass the page-specific prefix (e.g. "About") and we append the
 * brand suffix. Pass `null` to leave the title alone (e.g. on a
 * loading state where the persona hasn't resolved yet).
 *
 * Pass `{ raw: true }` to set the title verbatim with no brand
 * suffix — used by demo routes that intentionally spoof another
 * site's tab title (e.g. the Blockstream help-center demo).
 */
export function useDocumentTitle(
  prefix: string | null,
  options: { raw?: boolean } = {},
) {
  const { raw = false } = options;
  useEffect(() => {
    if (prefix === null) return;
    const previous = document.title;
    if (raw) {
      document.title = prefix;
    } else {
      document.title = prefix ? `${prefix} \u2014 ${SUFFIX}` : SUFFIX;
    }
    return () => {
      document.title = previous;
    };
  }, [prefix, raw]);
}
