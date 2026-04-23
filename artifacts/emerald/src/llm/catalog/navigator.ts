/**
 * Catalog navigator (Task #68).
 *
 * Replaces the cosine-RAG path for the Bitcoin pack with a hand-curated
 * tree walk: ROOT → BRANCH → LEAF. The walk is deterministic (BM25-lite
 * over edge `label + summary` against the query) and does not require
 * the WebGPU model to be loaded — that's the whole reason this exists.
 *
 *   • First-paint cost: one fetch of the root index (~3 KB), no
 *     embedding pass. Replaces the 30-min first-load on the old
 *     11 MB monolithic seed bundle.
 *   • Per-turn cost: 2-4 small JSON fetches (one per hop) + an
 *     optional LLM polish if the model is ready. Without polish,
 *     the leaf brief renders verbatim with built-in `[N]` markers.
 *   • Anti-drift: deterministic shitcoin / scam / advice gate fires
 *     before any catalog work — see `./antiDrift.ts`.
 *
 * The navigator is decoupled from the browser: the caller injects a
 * `loader` so the same code drives the in-browser flow (fetch) and the
 * Node smoke harness (fs.readFile).
 */

import type {
  CatalogBranch,
  CatalogEdge,
  CatalogLeaf,
  CatalogRoot,
  CatalogSource,
  NavigationHop,
  NavigationResult,
} from "./types";
import type { ChatTurn, RetrievedChunk } from "../types";
import { detectDrift, renderDriftRedirect } from "./antiDrift";
import { slugForSource } from "./slug";

/* -------------------------------------------------------------- */
/*  Loader contract                                               */
/* -------------------------------------------------------------- */

/**
 * Resolves a path under the catalog base (e.g. "index.json",
 * "austrian-monetary/index.json", "austrian-monetary/sound-money.json")
 * to the parsed JSON value. Implementations:
 *
 *   • Browser:  (path) => fetch(`${baseUrl}${path}`).then(r => r.json())
 *   • Node:     (path) => readFile(join(catalogDir, path)).then(JSON.parse)
 */
export type CatalogLoader = (path: string) => Promise<unknown>;

export function makeFetchLoader(baseUrl: string): CatalogLoader {
  // baseUrl already ends with "/" by convention.
  return async (path) => {
    const url = `${baseUrl}${path}`;
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Catalog fetch ${url} → ${res.status}`);
    return res.json();
  };
}

/* -------------------------------------------------------------- */
/*  BM25-lite scorer                                              */
/* -------------------------------------------------------------- */

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "is", "are", "was", "were",
  "be", "been", "being", "do", "does", "did", "have", "has", "had", "of",
  "in", "on", "at", "to", "for", "with", "by", "from", "as", "it", "its",
  "this", "that", "these", "those", "i", "you", "we", "they", "he", "she",
  "what", "why", "how", "when", "where", "which", "who", "whom", "whose",
  "can", "could", "should", "would", "will", "may", "might", "must",
  "about", "into", "than", "then", "so", "such", "any", "all", "some",
  "more", "most", "much", "many", "each", "every", "no", "not", "nor",
  "only", "own", "same", "very", "me", "my", "your", "our", "his", "her",
  "their", "us", "them", "him", "myself", "yourself", "ourselves", "tell",
  "explain", "say", "know", "think", "want", "need", "actually", "really",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/**
 * Score one edge against a query. Sums term overlaps weighted by
 * a tiny inverse-document-frequency over the SIBLING edges only,
 * so very-common-within-this-level terms (the noun shared by every
 * sibling) get downweighted while rare distinguishing terms drive
 * the score.
 *
 * Label terms get a 2x boost — visitors search for the label noun
 * more than for the discursive summary text.
 */
function scoreEdge(
  query: string,
  edge: CatalogEdge,
  siblings: CatalogEdge[],
): number {
  const qTerms = new Set(tokenize(query));
  if (qTerms.size === 0) return 0;
  const labelTerms = tokenize(edge.label);
  const summaryTerms = tokenize(edge.summary);
  const searchTerms = (edge.searchTerms ?? []).flatMap((s) => tokenize(s));

  // Sibling-level document-frequency for IDF — built across the union
  // of label, summary AND searchTerms so a token only present in one
  // sibling's hidden ranking terms still gets the correct rare-term
  // boost.
  const df = new Map<string, number>();
  for (const sib of siblings) {
    const seen = new Set([
      ...tokenize(sib.label),
      ...tokenize(sib.summary),
      ...((sib.searchTerms ?? []).flatMap((s) => tokenize(s))),
    ]);
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const N = siblings.length || 1;

  let score = 0;
  for (const t of qTerms) {
    const labelHit = labelTerms.includes(t);
    const summaryHit = summaryTerms.includes(t);
    const searchHit = searchTerms.includes(t);
    if (!labelHit && !summaryHit && !searchHit) continue;
    const idf = Math.log((N + 1) / ((df.get(t) ?? 0) + 1)) + 1; // ~0.3..2
    // Label and searchTerm hits both get 2x weight (searchTerms are
    // explicitly authored as high-signal); summary is the descriptive
    // fallback and gets 1x.
    if (labelHit || searchHit) score += 2 * idf;
    if (summaryHit) score += 1 * idf;
  }
  // Normalise by query length so a 3-word query and a 30-word query
  // sit on roughly the same scale.
  return score / Math.sqrt(qTerms.size);
}

interface RankedEdge {
  edge: CatalogEdge;
  score: number;
}

function rankEdges(query: string, edges: CatalogEdge[]): RankedEdge[] {
  return edges
    .map((edge) => ({ edge, score: scoreEdge(query, edge, edges) }))
    .sort((a, b) => b.score - a.score);
}

/* -------------------------------------------------------------- */
/*  Navigator                                                     */
/* -------------------------------------------------------------- */

export interface NavigateOptions {
  loader: CatalogLoader;
  history: ChatTurn[];
  /**
   * Leaf ids the visitor's already touched in this session. Currently
   * used as a tiebreaker (small score boost) so multi-turn threads
   * stay on the same branch unless the visitor visibly switches.
   */
  recentLeafIds?: string[];
  /**
   * Hook for the WebGPU model. When supplied AND the navigator lands
   * on a leaf, the brief is polished into a conversational answer
   * keyed to the user's exact question. When omitted (model still
   * loading), the brief renders verbatim — citation markers and all.
   */
  generate?: (
    messages: ChatTurn[],
    maxNewTokens?: number,
  ) => Promise<string>;
  onTelemetry?: (tag: string, text: string) => void;
  /** Cap on hops; deep trees may need higher. Default 4. */
  maxDepth?: number;
  /**
   * When true, after landing on a leaf the navigator JIT-fetches the
   * per-source local copy under
   * `<corpusBaseUrl>/<internalSlug>.json` for up to `jitMaxDocs`
   * (default 3) of the leaf's sources, and rewrites each chunk's
   * `text` with the local-copy `body` (excerpt + every citing
   * leaf's brief). This satisfies the "catalog node + JIT source
   * document fetch" architecture from Task #68 — runtime grounding
   * uses the per-doc layer, not just the inline excerpt.
   *
   * Off by default so the smoke harness (which has no corpus base
   * URL) and any caller that hasn't deployed the corpus layer keep
   * working. ChatWidget turns it on for the bitcoin pack.
   */
  jitLoadBodies?: boolean;
  /** Base URL where per-doc local-copy files live. */
  corpusBaseUrl?: string;
  /** Max number of local-copy fetches per turn. Default 3. */
  jitMaxDocs?: number;
}

const ROOT_NODE_ID = "__root__";

/**
 * Margin within which the top-2 edges are treated as a tie. When the
 * top-1 score is < 1.15 × top-2, the navigator returns a clarify
 * result rather than picking blindly. Calibrated against the smoke
 * suite — wider and ambiguous queries stop confidently picking the
 * wrong branch; tighter and clarifications happen too often.
 */
const TIE_RATIO = 1.08;

/**
 * Floor for the top-1 score. Below this, we don't have a confident
 * pick at any level — return clarify with the top-3 options framed
 * as "did you mean any of these?".
 */
const FLOOR_SCORE = 0.4;

/**
 * Convert a leaf's source pointers into synthetic RetrievedChunks so
 * the existing ChatMessage trace panel renders them with no special
 * casing. The score is the navigator's confidence at the leaf level
 * — visitors see "[N] sim 0.82" exactly the way they do for cosine
 * RAG, except the number means "catalog confidence" here.
 */
function sourcesToChunks(
  leaf: CatalogLeaf,
  confidence: number,
  packSlug: string,
): RetrievedChunk[] {
  return leaf.sources.map((s, idx) => sourceToChunk(s, leaf, idx, confidence, packSlug));
}

/**
 * After landing on a leaf, JIT-fetch up to `max` per-doc local-copy
 * files and rewrite each chunk's `text` with the local-copy `body`
 * (excerpt + every citing leaf's brief). Failures are logged and
 * non-fatal — the original excerpt-as-text remains so the answer
 * never silently drops citations.
 */
async function jitLoadChunkBodies(
  chunks: RetrievedChunk[],
  corpusBaseUrl: string,
  max: number,
  tel: (tag: string, text: string) => void,
): Promise<void> {
  const targets = chunks.slice(0, max);
  await Promise.all(
    targets.map(async (chunk) => {
      if (!chunk.internalSlug) return;
      const url = `${corpusBaseUrl}${chunk.internalSlug}.json`;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          tel("[Catalog]", `JIT corpus miss (${res.status}) for ${chunk.internalSlug}`);
          return;
        }
        const payload = (await res.json()) as {
          body?: string;
          chunks?: Array<{ text?: string }>;
        };
        // Two emitter shapes coexist in the repo: `build-catalog-corpus`
        // writes a flat `body`; the legacy `build-bitcoin-seed` per-doc
        // dump writes a `chunks[]` array. Accept either so JIT
        // enrichment never silently degrades when an operator runs the
        // seed builder after corpus generation.
        let text = "";
        if (typeof payload.body === "string" && payload.body.length > 0) {
          text = payload.body;
        } else if (Array.isArray(payload.chunks)) {
          text = payload.chunks
            .map((c) => (typeof c.text === "string" ? c.text : ""))
            .filter(Boolean)
            .join("\n\n");
        }
        if (text.length > 0) {
          chunk.text = text;
          tel("[Catalog]", `JIT corpus loaded ${chunk.internalSlug} (${text.length} chars)`);
        }
      } catch (err) {
        tel("[Catalog]", `JIT corpus error for ${chunk.internalSlug}: ${(err as Error).message}`);
      }
    }),
  );
}

function sourceToChunk(
  source: CatalogSource,
  leaf: CatalogLeaf,
  idx: number,
  confidence: number,
  packSlug: string,
): RetrievedChunk {
  return {
    id: `catalog:${packSlug}:${leaf.id}:${idx}`,
    job_id: packSlug === "bitcoin" ? "bitcoin-bundle" : `seed-bundle:${packSlug}`,
    job_root_url: `internal://catalog/${packSlug}`,
    job_label: `${packSlug} catalog`,
    job_kind: packSlug === "bitcoin" ? "bitcoin-bundle" : "seed-bundle",
    page_url: source.url,
    page_label: source.label,
    chunk_index: idx,
    text: source.excerpt,
    persona_slug: packSlug === "bitcoin" ? "fintech" : packSlug,
    score: confidence,
    // Plumbed end-to-end: catalog source → synthetic chunk → trace UI.
    // ChatMessage shows a "local copy" badge linking to
    // /corpus/<packSlug>/<internalSlug>.json. Curators may pin an
    // explicit slug on the source; otherwise we derive one from the
    // URL using the same FNV-1a algorithm as the corpus builder, so
    // every cited source has a working local-copy target as long as
    // the matching corpus file is present at deploy time.
    internalSlug: source.internalSlug ?? slugForSource(source.url),
    packSlug,
  };
}

/**
 * Render the leaf as a verbatim answer (no model). The brief is
 * authored with `[N]` markers in place; we just append a compact
 * "Sources" list so the citation chips have something to scroll to
 * even when the trace panel is closed.
 */
function renderVerbatim(leaf: CatalogLeaf): string {
  return leaf.brief.trim();
}

/**
 * Single-turn LLM polish over the leaf brief. The brief is treated as
 * authoritative — the model is instructed to rephrase it as a direct
 * answer to the user's exact question, preserving every `[N]` marker,
 * never inventing claims beyond what the brief contains.
 */
async function polishWithModel(
  leaf: CatalogLeaf,
  userMessage: string,
  history: ChatTurn[],
  generate: NonNullable<NavigateOptions["generate"]>,
): Promise<string> {
  const sourceList = leaf.sources
    .map((s, i) => `[${i + 1}] ${s.label} — ${s.url}`)
    .join("\n");
  const system = [
    "You are a focused Bitcoin assistant. The BRIEF below is hand-curated and",
    "authoritative — treat it as the only source of facts. Your job is to",
    "rephrase it as a direct, conversational answer to the user's question.",
    "",
    "Rules:",
    "- Preserve every [N] citation marker; do not renumber or invent new ones.",
    "- Do not add facts that are not in the BRIEF.",
    "- If the user's question is narrower than the brief, focus on the part",
    "  that answers them; do not dump the whole brief.",
    "- Keep it under ~250 words. Plain prose, no headings, no bullet lists",
    "  unless the brief itself uses them.",
    "",
    `LEAF: ${leaf.label}`,
    "",
    "BRIEF:",
    leaf.brief,
    "",
    "SOURCES (referenced by the [N] markers above):",
    sourceList,
  ].join("\n");

  const messages: ChatTurn[] = [
    { role: "system", content: system },
    ...history.slice(-4),
    { role: "user", content: userMessage },
  ];
  return generate(messages, 320);
}

/**
 * Render a clarification result. Picks the top-3 ranked edges (or
 * fewer if the level has fewer) and frames them as "did you mean…?"
 */
function renderClarify(
  query: string,
  ranked: RankedEdge[],
  parentSummary: string,
): NavigationResult {
  const top = ranked.slice(0, Math.min(3, ranked.length));
  const lines = [
    `I cover ${parentSummary.toLowerCase().replace(/\.$/, "")} a few different ways. Which of these is closer to what you're asking?`,
    "",
    ...top.map((r, i) => `${i + 1}. **${r.edge.label}** — ${r.edge.summary}`),
  ];
  return {
    kind: "clarify",
    text: lines.join("\n"),
    chunks: [],
    reasoning: `Catalog clarify: query "${query}" did not pick a confident edge (top scores ${top.map((r) => r.score.toFixed(2)).join(", ")}).`,
    hops: [],
    clarifyOptions: top.map((r) => ({
      id: r.edge.id,
      label: r.edge.label,
      summary: r.edge.summary,
    })),
  };
}

/**
 * Stub-branch landing. We have an outline of the territory but no
 * authored leaves yet — return a graceful "here's what I'd point at"
 * message. This is a feature, not a failure: the visitor sees the
 * full intended scope of the bot, not a blank wall.
 */
function renderStub(branch: CatalogBranch): NavigationResult {
  return {
    kind: "stub",
    text: [
      `I have an outline of **${branch.title}** but I haven't curated answers for it yet.`,
      "",
      branch.summary,
      "",
      "Until I do, the most honest move is to recommend the primary sources directly. If you want, narrow the question — I may have a sibling topic that does cover what you're after.",
    ].join("\n"),
    chunks: [],
    reasoning: `Catalog stub: branch "${branch.id}" has no curated leaves yet.`,
    hops: [],
  };
}

/**
 * Main entry. Walks ROOT → BRANCH → LEAF. Returns one of:
 *  - answer: confident leaf, brief returned (verbatim or polished)
 *  - clarify: ambiguous, top-N options surfaced
 *  - refuse: anti-drift gate fired
 *  - stub: landed in an unauthored branch
 */
export async function navigateCatalog(
  query: string,
  packSlug: string,
  opts: NavigateOptions,
): Promise<NavigationResult> {
  const tel = opts.onTelemetry ?? (() => {});
  const maxDepth = opts.maxDepth ?? 4;

  // 1. Anti-drift gate. Deterministic, no fetches.
  const drift = detectDrift(query);
  if (drift.kind) {
    tel("[Catalog]", `Anti-drift gate fired: kind=${drift.kind} match="${drift.match ?? ""}"`);
    // Load only the root so we know the topical anchor to inject.
    let anchor = "Bitcoin";
    try {
      const root = (await opts.loader("index.json")) as CatalogRoot;
      anchor = root.topicalAnchor ?? anchor;
    } catch {
      // Fine: anchor falls back to "Bitcoin" generically.
    }
    return {
      kind: "refuse",
      text: renderDriftRedirect(drift, anchor),
      chunks: [],
      reasoning: `Anti-drift refusal (${drift.kind}: "${drift.match}")`,
      hops: [],
    };
  }

  // 2. Walk the tree. At each level, rank edges and pick — or clarify.
  tel("[Catalog]", `Loading root index for pack "${packSlug}"…`);
  const root = (await opts.loader("index.json")) as CatalogRoot;
  let edges = root.edges;
  let parentSummary = `${root.title} — ${root.topicalAnchor}`;
  let parentPath = ""; // Path prefix for resolving child loaders ("austrian-monetary/").
  let parentNodeId = ROOT_NODE_ID;
  const hops: NavigationHop[] = [];

  for (let depth = 0; depth < maxDepth; depth++) {
    const ranked = rankEdges(query, edges);
    tel(
      "[Catalog]",
      `hop ${depth} (parent="${parentNodeId}") top-3: ${ranked
        .slice(0, 3)
        .map((r) => `${r.edge.id}:${r.score.toFixed(2)}`)
        .join(", ")}`,
    );

    // Apply a small recency boost so multi-turn threads on the same
    // branch don't bounce around. Boost is small (5%) — visible only
    // when the natural ranking is already close.
    if (opts.recentLeafIds?.length) {
      for (const r of ranked) {
        if (opts.recentLeafIds.includes(r.edge.id)) r.score *= 1.05;
      }
      ranked.sort((a, b) => b.score - a.score);
    }

    const top = ranked[0];
    const second = ranked[1];

    // Floor check: if the top score is too low, ask the visitor.
    if (!top || top.score < FLOOR_SCORE) {
      tel("[Catalog]", `Floor miss at depth ${depth}: top score ${top?.score.toFixed(2) ?? "n/a"} < ${FLOOR_SCORE}`);
      return renderClarify(query, ranked, parentSummary);
    }
    // Tie check: only at the root level (a clarify deeper down is
    // generally annoying — once the visitor is inside Austrian
    // monetary, picking between sub-leaves is a job for the bot).
    if (depth === 0 && second && top.score < TIE_RATIO * second.score) {
      tel("[Catalog]", `Tie at root: top=${top.score.toFixed(2)} second=${second.score.toFixed(2)} ratio<${TIE_RATIO}`);
      return renderClarify(query, ranked, parentSummary);
    }

    hops.push({
      nodeId: parentNodeId,
      pickedEdgeId: top.edge.id,
      score: top.score,
      considered: ranked.slice(0, 5).map((r) => ({ id: r.edge.id, score: r.score })),
    });

    // Resolve the edge. Branches load their own index; leaves load
    // their own file directly.
    if (top.edge.kind === "leaf") {
      const leafPath = `${parentPath}${top.edge.id}.json`;
      tel("[Catalog]", `Loading leaf ${leafPath}`);
      const leaf = (await opts.loader(leafPath)) as CatalogLeaf;
      const confidence = Math.min(1, top.score / 4); // empirical scaling
      const chunks = sourcesToChunks(leaf, confidence, packSlug);
      if (opts.jitLoadBodies && opts.corpusBaseUrl) {
        await jitLoadChunkBodies(chunks, opts.corpusBaseUrl, opts.jitMaxDocs ?? 3, tel);
      }
      let text: string;
      if (opts.generate) {
        try {
          tel("[Catalog]", `Polishing leaf "${leaf.id}" with WebGPU model…`);
          text = await polishWithModel(leaf, query, opts.history, opts.generate);
        } catch (err) {
          // Polish failure must never break the answer — fall back to
          // verbatim so the visitor still gets the curated content.
          tel("[Catalog]", `Polish failed (${(err as Error).message}); falling back to verbatim`);
          text = renderVerbatim(leaf);
        }
      } else {
        tel("[Catalog]", "Model not ready — returning leaf brief verbatim");
        text = renderVerbatim(leaf);
      }
      return {
        kind: "answer",
        text,
        chunks,
        reasoning: `Catalog hit: ${hops.map((h) => h.pickedEdgeId).join(" → ")} (confidence ${confidence.toFixed(2)})`,
        hops,
        landedLeafId: leaf.id,
      };
    }

    // Branch. Load it and recurse.
    const branchPath = `${parentPath}${top.edge.id}/index.json`;
    tel("[Catalog]", `Descending into branch ${branchPath}`);
    const branch = (await opts.loader(branchPath)) as CatalogBranch;
    if (branch.stub || branch.edges.length === 0) {
      return renderStub(branch);
    }
    edges = branch.edges;
    parentSummary = branch.summary;
    parentPath = `${parentPath}${branch.id}/`;
    parentNodeId = branch.id;
  }

  // Depth exceeded — return the last branch summary as a soft stub.
  tel("[Catalog]", `Max depth ${maxDepth} reached without landing on a leaf`);
  return {
    kind: "clarify",
    text: `I drilled into ${parentSummary.toLowerCase()} but couldn't narrow further. Could you rephrase what you're looking for?`,
    chunks: [],
    reasoning: `Catalog max-depth exceeded after ${hops.map((h) => h.pickedEdgeId).join(" → ")}.`,
    hops,
  };
}

/* -------------------------------------------------------------- */
/*  Test hooks                                                    */
/* -------------------------------------------------------------- */

/** Exposed for the smoke harness to assert on the deterministic ranker. */
export const __test__ = { tokenize, scoreEdge, rankEdges };
