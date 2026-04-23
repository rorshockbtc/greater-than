/**
 * Greater Bitcoin corpus — retrieval smoke test.
 *
 * Validates that the live corpus (artifacts/emerald/public/seeds/bitcoin.json)
 * still answers a curated set of test questions at the expected relevance
 * bands. Uses the SAME embedding model the browser uses (Xenova/bge-small-en-v1.5)
 * via @xenova/transformers, so the cosine scores produced here are directly
 * comparable to what visitors see in the chat widget.
 *
 * What it checks
 *   - HIGH-band questions retrieve a relevant chunk above `minTopScore` from
 *     one of the expected source types.
 *   - MEDIUM/LOW-band questions retrieve at least something above the
 *     weak-context floor.
 *   - IRRELEVANT questions fail to retrieve (top score below `maxTopScore`)
 *     so the live UI's hard-refusal branch fires correctly.
 *
 * Caching
 *   First run embeds every chunk in the corpus (~7-8k chunks, several
 *   minutes on CPU). Embeddings are cached by content hash to
 *   data/seeds/.cache/smoke-test-embeddings.json so subsequent runs are
 *   near-instant. Change the corpus → cache invalidates → re-embed.
 *
 * Usage
 *   pnpm --filter @workspace/scripts run smoke-test
 *
 * Adding tests
 *   Edit scripts/src/bitcoin-seed/smoke-tests.json — see docs/TESTING.md
 *   for the human-readable schema. No TypeScript required.
 */

import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import { pipeline, env as transformersEnv } from "@xenova/transformers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const CORPUS_PATH = path.join(
  REPO_ROOT,
  "artifacts",
  "emerald",
  "public",
  "seeds",
  "bitcoin.json",
);
const TESTS_PATH = path.join(
  __dirname,
  "bitcoin-seed",
  "smoke-tests.json",
);
const CACHE_PATH = path.join(
  REPO_ROOT,
  "data",
  "seeds",
  ".cache",
  "smoke-test-embeddings.json",
);

const EMBEDDER_MODEL_ID = "Xenova/bge-small-en-v1.5";
const TOP_K = 3;

// Match the browser: cache transformers.js model files locally so we
// don't re-download on every CI run when the runner caches the dir.
transformersEnv.cacheDir = path.join(REPO_ROOT, "data", "seeds", ".cache", "models");

/* -------------------------------------------------------------- */
/*  Types                                                         */
/* -------------------------------------------------------------- */

interface BundleChunk {
  text: string;
  chunk_index: number;
}
interface BundleDoc {
  source_url: string;
  source_label: string;
  source_type: string;
  bias: string;
  author?: string;
  chunks: BundleChunk[];
}
interface Bundle {
  version: string;
  generated_at: string;
  documents: BundleDoc[];
}

interface SmokeTest {
  id: string;
  question: string;
  expectedBand: "high" | "medium" | "low" | "irrelevant";
  expectedTopSourceTypeAnyOf?: string[];
  minTopScore?: number;
  maxTopScore?: number;
  notes?: string;
}

interface FlatChunk {
  source_url: string;
  source_label: string;
  source_type: string;
  text: string;
}

interface EmbeddingCache {
  corpus_hash: string;
  model: string;
  embeddings: number[][];
}

interface ScoredChunk {
  chunk: FlatChunk;
  score: number;
}

interface TestResult {
  test: SmokeTest;
  top: ScoredChunk[];
  passed: boolean;
  reason: string;
}

/* -------------------------------------------------------------- */
/*  Math                                                          */
/* -------------------------------------------------------------- */

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let an = 0;
  let bn = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    an += a[i] * a[i];
    bn += b[i] * b[i];
  }
  const denom = Math.sqrt(an) * Math.sqrt(bn);
  return denom === 0 ? 0 : dot / denom;
}

function fileExists(p: string): Promise<boolean> {
  return stat(p)
    .then(() => true)
    .catch(() => false);
}

/* -------------------------------------------------------------- */
/*  Embedding                                                     */
/* -------------------------------------------------------------- */

type Embedder = (
  text: string,
  opts: { pooling: "mean"; normalize: true },
) => Promise<{ data: Float32Array | number[] }>;

async function loadEmbedder(): Promise<Embedder> {
  console.log(`Loading embedder: ${EMBEDDER_MODEL_ID}…`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pipe = (await pipeline("feature-extraction", EMBEDDER_MODEL_ID)) as any;
  return pipe as Embedder;
}

async function embedOne(
  embedder: Embedder,
  text: string,
): Promise<number[]> {
  const out = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(out.data);
}

function flattenCorpus(bundle: Bundle): FlatChunk[] {
  const flat: FlatChunk[] = [];
  for (const doc of bundle.documents) {
    for (const chunk of doc.chunks) {
      flat.push({
        source_url: doc.source_url,
        source_label: doc.source_label,
        source_type: doc.source_type,
        text: chunk.text,
      });
    }
  }
  return flat;
}

function corpusHash(flat: FlatChunk[]): string {
  const h = createHash("sha256");
  // Hash text + source metadata so cache invalidates when source_type or
  // source_label changes, even if the underlying text is identical. The
  // evaluator inspects metadata (`expectedTopSourceTypeAnyOf`) so stale
  // metadata would silently mis-classify retrievals.
  for (const c of flat) {
    h.update(c.source_type);
    h.update("\u0001");
    h.update(c.source_url);
    h.update("\u0001");
    h.update(c.text);
    h.update("\u0000");
  }
  return h.digest("hex");
}

async function embedCorpus(
  embedder: Embedder,
  flat: FlatChunk[],
): Promise<number[][]> {
  const hash = corpusHash(flat);
  if (await fileExists(CACHE_PATH)) {
    try {
      const cached = JSON.parse(
        await readFile(CACHE_PATH, "utf8"),
      ) as EmbeddingCache;
      if (
        cached.corpus_hash === hash &&
        cached.model === EMBEDDER_MODEL_ID &&
        cached.embeddings.length === flat.length
      ) {
        console.log(
          `Embedding cache hit (${flat.length} chunks). Skipping re-embed.`,
        );
        return cached.embeddings;
      }
      console.log(
        "Embedding cache stale (corpus changed). Re-embedding from scratch.",
      );
    } catch {
      console.log("Embedding cache unreadable. Re-embedding from scratch.");
    }
  }

  console.log(
    `Embedding ${flat.length} chunks (this is the slow path; cached after this run)…`,
  );
  const embeddings: number[][] = [];
  const startedAt = Date.now();
  for (let i = 0; i < flat.length; i += 1) {
    embeddings.push(await embedOne(embedder, flat[i].text));
    if ((i + 1) % 200 === 0 || i === flat.length - 1) {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      const rate = ((i + 1) / Math.max(1, elapsed)).toFixed(1);
      console.log(
        `  embedded ${i + 1}/${flat.length} (${elapsed}s elapsed, ${rate} chunks/s)`,
      );
    }
  }

  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(
    CACHE_PATH,
    JSON.stringify({
      corpus_hash: hash,
      model: EMBEDDER_MODEL_ID,
      embeddings,
    } satisfies EmbeddingCache),
    "utf8",
  );
  console.log(`Wrote embedding cache → ${CACHE_PATH}`);
  return embeddings;
}

/* -------------------------------------------------------------- */
/*  Retrieval & evaluation                                        */
/* -------------------------------------------------------------- */

function topK(
  queryEmb: number[],
  flat: FlatChunk[],
  embeddings: number[][],
  k: number,
): ScoredChunk[] {
  const scored: ScoredChunk[] = [];
  for (let i = 0; i < flat.length; i += 1) {
    scored.push({ chunk: flat[i], score: cosine(queryEmb, embeddings[i]) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

function evaluate(test: SmokeTest, top: ScoredChunk[]): TestResult {
  const topScore = top[0]?.score ?? 0;
  const topType = top[0]?.chunk.source_type ?? "(none)";

  if (test.expectedBand === "irrelevant") {
    const max = test.maxTopScore ?? 0.30;
    if (topScore <= max) {
      return {
        test,
        top,
        passed: true,
        reason: `top score ${topScore.toFixed(3)} ≤ max ${max} (graceful no-retrieval as expected)`,
      };
    }
    return {
      test,
      top,
      passed: false,
      reason: `top score ${topScore.toFixed(3)} > max ${max} — irrelevant question retrieved confidently. Investigate ${topType}: "${top[0].chunk.source_label}"`,
    };
  }

  const min = test.minTopScore ?? 0.30;
  if (topScore < min) {
    return {
      test,
      top,
      passed: false,
      reason: `top score ${topScore.toFixed(3)} < min ${min} — retrieval weaker than expected for ${test.expectedBand} band`,
    };
  }
  if (
    test.expectedTopSourceTypeAnyOf &&
    !test.expectedTopSourceTypeAnyOf.includes(topType)
  ) {
    return {
      test,
      top,
      passed: false,
      reason: `top source_type was '${topType}' but expected one of [${test.expectedTopSourceTypeAnyOf.join(", ")}]`,
    };
  }
  return {
    test,
    top,
    passed: true,
    reason: `top score ${topScore.toFixed(3)} from ${topType}`,
  };
}

/* -------------------------------------------------------------- */
/*  ANSI helpers (CI-safe; no color when not a TTY)               */
/* -------------------------------------------------------------- */

const isTty = process.stdout.isTTY;
const c = {
  green: (s: string) => (isTty ? `\x1b[32m${s}\x1b[0m` : s),
  red: (s: string) => (isTty ? `\x1b[31m${s}\x1b[0m` : s),
  yellow: (s: string) => (isTty ? `\x1b[33m${s}\x1b[0m` : s),
  dim: (s: string) => (isTty ? `\x1b[2m${s}\x1b[0m` : s),
  bold: (s: string) => (isTty ? `\x1b[1m${s}\x1b[0m` : s),
};

/* -------------------------------------------------------------- */
/*  Main                                                          */
/* -------------------------------------------------------------- */

async function main() {
  console.log(c.bold("Greater Bitcoin corpus — retrieval smoke test"));
  console.log("");

  const bundle = JSON.parse(await readFile(CORPUS_PATH, "utf8")) as Bundle;
  const flat = flattenCorpus(bundle);
  console.log(
    `Loaded corpus: ${bundle.documents.length} documents · ${flat.length} chunks`,
  );

  const tests = JSON.parse(await readFile(TESTS_PATH, "utf8")) as SmokeTest[];
  console.log(`Loaded ${tests.length} smoke tests from ${TESTS_PATH}`);
  console.log("");

  const embedder = await loadEmbedder();
  const embeddings = await embedCorpus(embedder, flat);
  console.log("");

  const results: TestResult[] = [];
  for (const test of tests) {
    const queryEmb = await embedOne(embedder, test.question);
    const top = topK(queryEmb, flat, embeddings, TOP_K);
    results.push(evaluate(test, top));
  }

  console.log(c.bold("Results"));
  console.log("");
  for (const r of results) {
    const tag = r.passed ? c.green("PASS") : c.red("FAIL");
    const band = c.dim(`[${r.test.expectedBand}]`);
    console.log(`${tag}  ${band}  ${r.test.id}  ${c.dim("—")}  "${r.test.question}"`);
    console.log(`        ${c.dim(r.reason)}`);
    if (!r.passed) {
      for (const s of r.top) {
        console.log(
          `        ${c.dim("·")} ${s.score.toFixed(3)}  ${s.chunk.source_type}  ${c.dim(s.chunk.source_label.slice(0, 70))}`,
        );
      }
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log("");
  console.log(c.bold("Summary"));
  console.log(`  ${c.green(`${passed} passed`)} · ${failed > 0 ? c.red(`${failed} failed`) : c.dim("0 failed")} · ${results.length} total`);
  if (failed > 0) {
    console.log("");
    console.log(c.yellow("Smoke test regression detected — see failures above."));
    process.exit(1);
  }
  console.log("");
  console.log(c.green("All smoke tests passed."));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
