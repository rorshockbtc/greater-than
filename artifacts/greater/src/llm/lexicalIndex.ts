/**
 * BM25-lite lexical retrieval — a keyword-based fallback that runs
 * alongside the semantic (sentence-transformer) retrieval inside
 * LLMProvider.ask. The two scorers feed a single fused top-K list
 * before the tiered grounding gates make their refuse / weak /
 * confident decision.
 *
 * Why this exists
 * ---------------
 * The Xenova/all-MiniLM-L6-v2 embedder is good at semantic similarity
 * but bad at term-rare phrasings. Real round-3 user transcripts show
 * the bot refusing questions like "what coding language do I need?"
 * and "is there a way to suggest things for the knowledge base?" —
 * even though the corpus DOES contain answers (TypeScript, the
 * contact form). The embeddings just don't bridge those wordings.
 *
 * BM25 catches exactly that case: it's keyword-driven, so a query
 * containing a strong rare term ("TypeScript", "contact", "fork")
 * will score the chunks that mention that term highly, regardless of
 * sentence-level paraphrase distance.
 *
 * Design choices
 * --------------
 * - Standard Okapi BM25 (k1=1.5, b=0.75). No stemming, no fancy
 *   tokenization. The corpus is small (<1000 chunks) and the cost of
 *   a more sophisticated pipeline isn't worth the marginal recall on
 *   an in-browser support bot.
 * - Index is in-memory, lazily (re)built on first query after a
 *   write to the underlying IndexedDB chunks store. Rebuilding from
 *   ~1000 chunks is sub-100ms; we don't bother with incremental
 *   index maintenance.
 * - Score normalization for fusion: `bm25 / (bm25 + SAT)` saturating
 *   curve with SAT=5. This compresses BM25's unbounded range to
 *   [0,1) so it can be max-fused with cosine similarity. The constant
 *   was chosen so that a "perfect single-term hit" lands around
 *   0.6–0.7 (above the WEAK_CONTEXT 0.38 gate) and a tangential
 *   one-token overlap lands around 0.2 (just above HARD_REFUSAL).
 * - Fusion is implemented in {@link LLMProvider}'s ask(); this module
 *   only computes lexical scores.
 *
 * Filters mirror {@link topK}'s semantic filters (personaScope,
 * biasFilter) so the lexical fallback respects the same persona
 * isolation and Pipe bias toggles.
 */

import { GLOBAL_PERSONA_SLUG } from "./vectorStore";
import type { Bias, KbChunk, RetrievedChunk } from "./types";

// Minimal English stopword list. Aggressive trimming would hurt
// recall on a small corpus; we only drop the truly content-free
// tokens. "how", "what", "where" intentionally stay so we can match
// "how do I X" against chunks that literally use that phrasing.
const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "and", "or", "but", "of", "in", "on", "at", "to", "for", "with",
  "as", "by", "from", "up", "about", "into", "than", "then", "so",
  "this", "that", "these", "those", "it", "its", "i", "me", "my",
  "you", "your", "we", "us", "our", "they", "them", "their",
  "do", "does", "did", "have", "has", "had", "can", "will", "would",
  "should", "could",
]);

/** Tokenize a chunk of text into a list of lowercase content tokens. */
function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

interface IndexState {
  /** docId → token frequency map for that doc. */
  termFreqs: Map<string, Map<string, number>>;
  /** docId → tokenized length. */
  docLens: Map<string, number>;
  /** token → number of docs containing the token. */
  docFreqs: Map<string, number>;
  /** Average doc length across the corpus. */
  avgDocLen: number;
  /** Total document count. */
  totalDocs: number;
  /** Lookup table for retrieving the original doc by id. */
  docs: Map<string, KbChunk>;
}

let cached: IndexState | null = null;
let stale = true;

/**
 * Mark the lexical index dirty. Call from any code path that mutates
 * the underlying IndexedDB chunks store (seed bundle install, user
 * ingestion, source removal). Rebuild is lazy — the next query
 * reconstructs the index from scratch, which is cheap at this corpus
 * size.
 */
export function invalidateLexicalIndex(): void {
  stale = true;
}

const BM25_K1 = 1.5;
const BM25_B = 0.75;

async function rebuild(): Promise<IndexState> {
  // Lazy import to avoid a circular dependency: vectorStore imports
  // types and shares the GLOBAL_PERSONA_SLUG constant, but we don't
  // want that module's IndexedDB initialization at module-load time
  // here.
  const { getAllDocuments } = await import("./vectorStore");
  const docs = await getAllDocuments();
  const termFreqs = new Map<string, Map<string, number>>();
  const docLens = new Map<string, number>();
  const docFreqs = new Map<string, number>();
  let totalLen = 0;

  for (const doc of docs) {
    const tokens = tokenize(doc.text);
    const freq = new Map<string, number>();
    for (const tok of tokens) {
      freq.set(tok, (freq.get(tok) ?? 0) + 1);
    }
    termFreqs.set(doc.id, freq);
    docLens.set(doc.id, tokens.length);
    totalLen += tokens.length;
    for (const tok of freq.keys()) {
      docFreqs.set(tok, (docFreqs.get(tok) ?? 0) + 1);
    }
  }

  const totalDocs = docs.length;
  const avgDocLen = totalDocs > 0 ? totalLen / totalDocs : 0;
  const docMap = new Map(docs.map((d) => [d.id, d]));

  return {
    termFreqs,
    docLens,
    docFreqs,
    avgDocLen,
    totalDocs,
    docs: docMap,
  };
}

async function ensureIndex(): Promise<IndexState> {
  if (cached && !stale) return cached;
  cached = await rebuild();
  stale = false;
  return cached;
}

/**
 * Score a single document for the given query terms using Okapi BM25.
 * Returns 0 if no query terms appear in the doc.
 */
function bm25Score(
  queryTerms: string[],
  docId: string,
  state: IndexState,
): number {
  const tf = state.termFreqs.get(docId);
  if (!tf) return 0;
  const dl = state.docLens.get(docId) ?? 0;
  if (dl === 0) return 0;
  const lengthNorm = 1 - BM25_B + BM25_B * (dl / (state.avgDocLen || 1));
  let score = 0;
  for (const term of queryTerms) {
    const freq = tf.get(term);
    if (!freq) continue;
    const df = state.docFreqs.get(term) ?? 0;
    // +0.5 / +0.5 is the standard BM25 IDF smoothing; max-with-zero
    // keeps very common terms from contributing negatively.
    const idf = Math.max(
      0,
      Math.log(1 + (state.totalDocs - df + 0.5) / (df + 0.5)),
    );
    const numer = freq * (BM25_K1 + 1);
    const denom = freq + BM25_K1 * lengthNorm;
    score += idf * (numer / denom);
  }
  return score;
}

/**
 * Map a raw BM25 score into a [0,1) confidence-like value so it can
 * be max-fused with cosine similarity. Saturating curve: 0 → 0,
 * SAT → 0.5, asymptote at 1.
 */
const BM25_SATURATION = 5.0;
export function normalizeBm25(raw: number): number {
  if (raw <= 0) return 0;
  return raw / (raw + BM25_SATURATION);
}

/**
 * Run a BM25 query over the in-memory inverted index and return the
 * top-K chunks, scored as cosine-comparable [0,1] values via the
 * saturation curve above. Mirrors {@link topK}'s filter semantics
 * so the fused top-K respects persona isolation and bias filters.
 *
 * Returns [] (without rebuilding) if the corpus is empty or if the
 * query tokenizes to nothing meaningful (all stopwords, all
 * punctuation, etc.) — letting callers cheaply skip the lexical leg.
 */
export async function lexicalTopK(
  query: string,
  k: number,
  options: { biasFilter?: Bias[]; personaScope?: string } = {},
): Promise<RetrievedChunk[]> {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  const state = await ensureIndex();
  if (state.totalDocs === 0) return [];

  const results: RetrievedChunk[] = [];
  for (const [docId, doc] of state.docs) {
    if (options.biasFilter && options.biasFilter.length > 0) {
      const tag: Bias = doc.bias ?? "neutral";
      if (!options.biasFilter.includes(tag)) continue;
    }
    if (options.personaScope) {
      const slug = doc.persona_slug;
      const ok =
        slug === undefined ||
        slug === GLOBAL_PERSONA_SLUG ||
        slug === options.personaScope;
      if (!ok) continue;
    }
    const raw = bm25Score(queryTerms, docId, state);
    if (raw <= 0) continue;
    results.push({ ...doc, score: normalizeBm25(raw) });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, k);
}

/**
 * Fuse semantic and lexical retrievals into a single deduped top-K
 * list. For chunks present in both, we take the max of the two
 * scores (lightly discounted on the lexical side so a perfect
 * cosine match still wins ties). For lexical-only chunks, we accept
 * them at their normalized BM25 score so the lexical leg can rescue
 * a query that semantic alone would have refused.
 *
 * The 0.92 discount on lexical is small on purpose: it preserves
 * the existing semantic-first ordering when both signals fire, but
 * still lets a strong keyword hit clear the WEAK_CONTEXT gate when
 * semantic misses entirely (a normalized BM25 of 0.5 → 0.46 fused,
 * which is above the 0.38 WEAK_CONTEXT threshold).
 */
const LEXICAL_DISCOUNT = 0.92;
export function fuseRetrievals(
  semantic: RetrievedChunk[],
  lexical: RetrievedChunk[],
  k: number,
): RetrievedChunk[] {
  const byId = new Map<string, RetrievedChunk>();
  for (const r of semantic) {
    byId.set(r.id, r);
  }
  for (const r of lexical) {
    const existing = byId.get(r.id);
    const lexFused = r.score * LEXICAL_DISCOUNT;
    if (existing) {
      if (lexFused > existing.score) {
        byId.set(r.id, { ...existing, score: lexFused });
      }
    } else {
      byId.set(r.id, { ...r, score: lexFused });
    }
  }
  const merged = Array.from(byId.values());
  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, k);
}
