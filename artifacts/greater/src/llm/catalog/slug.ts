/**
 * Deterministic source-URL → slug derivation.
 *
 * The same function is used by:
 *   - `scripts/src/build-bitcoin-seed.ts` when emitting the per-doc
 *     JIT layer at `public/corpus/bitcoin/<slug>.json`.
 *   - `scripts/src/build-catalog-corpus.ts` when emitting the
 *     per-source local copies for the curated catalog leaves.
 *   - The runtime navigator, so every catalog citation can fall back
 *     to a computed slug when the leaf author hasn't pinned one with
 *     `internalSlug`.
 *
 * Keeping the algorithm in one place is what makes "the local copy
 * link in the chat trace" reliably resolve to a real file on disk
 * — change this and every citation breaks.
 */
export function slugForSource(url: string): string {
  const human = url
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 80);
  // 8-char FNV-1a suffix; collision probability is negligible at our
  // document counts but the suffix means we never have to special-case
  // duplicates on the human-readable head.
  let h = 2166136261;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  return `${human}-${hex}`;
}
