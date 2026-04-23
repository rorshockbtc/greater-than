/**
 * Catalog-first retrieval types (Task #68).
 *
 * The Bitcoin pack ships as a hand-curated tree of nodes loaded on
 * demand from `public/catalog/bitcoin/`. Replaces the 30-minute
 * first-load embedding pass that the cosine-RAG path required for
 * the 11 MB monolithic seed bundle.
 *
 * Tree shape:
 *   - One ROOT (index.json) lists L1 BRANCH edges.
 *   - Each BRANCH (<branch>/index.json) lists LEAF edges, plus
 *     optionally further BRANCH edges.
 *   - Each LEAF (<branch>/<leaf>.json) carries a hand-authored
 *     brief with built-in `[N]` citation markers and an ordered
 *     list of source pointers.
 *
 * A "stub" branch is a BRANCH that has no leaves yet — only a
 * summary describing the territory. The navigator returns a graceful
 * "I have an outline of this but no curated answer yet — here's the
 * closest reading" when navigation lands inside one.
 *
 * All node/edge ids are kebab-case slugs and must be unique within
 * the catalog (the navigator uses them as memory anchors for
 * long-conversation coherence — see `recentLeafIds` in navigator.ts).
 */

export type CatalogEdgeKind = "branch" | "leaf" | "stub";

/**
 * A single edge from a parent node to a child node. The navigator
 * scores edges by BM25 over `label + summary` against the user query,
 * so write summaries that include the words a visitor would actually
 * type — not jargon that only insiders use.
 */
export interface CatalogEdge {
  id: string;
  /** Short noun phrase shown in clarification prompts ("Sound money"). */
  label: string;
  /**
   * 1-3 sentences. Indexed for BM25 against the user query. Should
   * lead with the keywords a visitor would search for, not with
   * insider jargon.
   */
  summary: string;
  kind: CatalogEdgeKind;
  /**
   * Optional list of additional ranking terms NOT shown in the UI.
   * Used to seed the BM25 ranker with leaf-vocabulary that the
   * branch summary doesn't naturally repeat (e.g. "fiat", "21
   * million", "halving" on the austrian-monetary root edge so a
   * query like "what is the 21 million cap" routes correctly even
   * though the summary copy doesn't include those exact tokens).
   * Treated like label terms by the scorer (2x weight).
   */
  searchTerms?: string[];
}

export interface CatalogRoot {
  /** Bumped to invalidate any persisted in-memory cache after edits. */
  version: string;
  packSlug: string;
  title: string;
  /**
   * Topical anchor injected into off-topic refusals. Example:
   * "Bitcoin (the protocol, the monetary thesis, and the
   * self-custody stack)". Distinct from the per-route refusalScope
   * in AskOptions; this one is owned by the catalog itself.
   */
  topicalAnchor: string;
  /**
   * Optional. When the anti-drift gate fires (the user asked about an
   * altcoin, a scam pattern, or for buy/sell advice), the redirect
   * response invites them to pick a path inside the catalog instead
   * of just refusing. These are the path labels the user is offered.
   *
   * Keep them short — three to five words, evocative, mutually
   * distinct, and each genuinely answerable from this pack. The
   * point is to demonstrate fluency: "I don't study altcoins, but
   * pick one of THESE and watch me hammer it down."
   *
   * If absent, the redirect falls back to a generic "what were you
   * actually trying to figure out?" prompt.
   */
  suggestedPaths?: string[];
  edges: CatalogEdge[];
}

export interface CatalogBranch {
  id: string;
  title: string;
  summary: string;
  edges: CatalogEdge[];
  /**
   * True when no leaves have been authored yet. The navigator surfaces
   * a "graceful stub" message instead of pretending to have a confident
   * answer. Stubs still appear in clarification rolls so the visitor
   * sees the full territory the bot intends to cover.
   */
  stub?: boolean;
}

/**
 * One pointer to a primary source. The navigator turns each pointer
 * into a synthetic RetrievedChunk so the existing thought-trace UI
 * (citation chips + trace panel) renders unchanged.
 *
 * `excerpt` is the snippet shown in the trace panel; keep it under
 * 600 chars and quote the source closely so visitors can verify the
 * brief's claims without leaving the page.
 *
 * `internalSlug`, when present, points to a per-document JIT file
 * under `public/corpus/bitcoin/<slug>.json` — this is reserved for
 * a future "expand to read more" affordance and currently unused
 * by the navigator itself.
 */
export interface CatalogSource {
  label: string;
  url: string;
  excerpt: string;
  internalSlug?: string;
}

export interface CatalogLeaf {
  id: string;
  label: string;
  /**
   * Hand-authored answer body. MUST include `[1]`, `[2]`, … markers
   * referencing the `sources` array in order. The navigator returns
   * this verbatim when the WebGPU model is not yet ready, and uses
   * it as the authoritative input to a single LLM polish turn when
   * the model IS ready (see navigator.ts polishWithModel).
   */
  brief: string;
  /** Ordered; `[N]` markers in `brief` reference position N (1-indexed). */
  sources: CatalogSource[];
  /**
   * Optional: leaf ids the model should consult when this leaf is
   * the active one. Currently surfaced only to the long-conversation
   * smoke harness for "no contradictions" probes; not yet wired into
   * the prompt.
   */
  relatedLeafIds?: string[];
}

/* -------------------------------------------------------------- */
/*  Navigator API                                                 */
/* -------------------------------------------------------------- */

export type NavigationKind =
  | "answer"     // Confident leaf hit, brief returned (with optional polish)
  | "clarify"   // Ambiguous: top edges within tolerance, ask the visitor
  | "refuse"     // Anti-drift gate fired (shitcoin / scam / off-topic)
  | "stub";     // Landed in a stub branch — graceful "outline only"

export interface NavigationHop {
  /** Node id at the level being scored ("__root__" for the root). */
  nodeId: string;
  pickedEdgeId: string;
  /** BM25 score normalised to roughly 0..1 by the navigator. */
  score: number;
  /** Top-K edges considered at this hop, for telemetry. */
  considered: { id: string; score: number }[];
}

export interface NavigationResult {
  kind: NavigationKind;
  text: string;
  /** Synthetic chunks so ChatMessage.tsx renders citations as usual. */
  chunks: import("../types").RetrievedChunk[];
  /** Short reasoning string for the trace panel. */
  reasoning: string;
  /** Empty for refuse/clarify; populated on answer hops. */
  hops: NavigationHop[];
  /**
   * Set when kind === "clarify". The chat widget can render these as
   * suggestion chips so the visitor picks one rather than retyping.
   */
  clarifyOptions?: { id: string; label: string; summary: string }[];
  /**
   * The leaf id the navigator landed on (for kind === "answer").
   * Used by the chat widget to seed `recentLeafIds` on the next turn
   * so multi-turn threads stay coherent.
   */
  landedLeafId?: string;
}
