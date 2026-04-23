/**
 * Bitcoin catalog smoke harness (Task #68).
 *
 * Drives the same `navigateCatalog()` function the browser uses, but
 * with an fs-backed CatalogLoader so we can run it offline as a CI
 * gate. Asserts that every authored query lands on its expected leaf
 * with at least the configured minimum confidence, and that every
 * anti-drift probe is refused without touching the catalog tree.
 *
 * Deterministic by design — the navigator's BM25-lite ranker has no
 * randomness and we don't pass a `generate` hook here, so the
 * verbatim-brief path runs end-to-end with no model dependency. Total
 * runtime: < 1 second.
 *
 * Run: `pnpm --filter @workspace/scripts run bitcoin-catalog-smoke`.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  navigateCatalog,
  type CatalogLoader,
} from "../../artifacts/emerald/src/llm/catalog/navigator";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const CATALOG_DIR = path.join(
  REPO_ROOT,
  "artifacts",
  "emerald",
  "public",
  "catalog",
  "bitcoin",
);
const TEST_BANK = path.join(__dirname, "bitcoin-seed", "catalog-smoke-tests.json");

interface PositiveCase {
  query: string;
  expectedLeafId: string;
  minConfidence: number;
}
interface DriftCase {
  query: string;
  expectKind: "refuse";
}
interface TestBank {
  cases: PositiveCase[];
  antiDriftCases: DriftCase[];
}

const fsLoader: CatalogLoader = async (rel) => {
  const full = path.join(CATALOG_DIR, rel);
  const buf = await readFile(full, "utf8");
  return JSON.parse(buf);
};

interface CaseResult {
  query: string;
  ok: boolean;
  detail: string;
  chunks?: { internalSlug?: string; page_url: string }[];
}

async function runPositive(c: PositiveCase): Promise<CaseResult> {
  const result = await navigateCatalog(c.query, "bitcoin", {
    loader: fsLoader,
    history: [],
  });
  if (result.kind !== "answer") {
    return {
      query: c.query,
      ok: false,
      detail: `expected kind=answer, got kind=${result.kind} (reasoning: ${result.reasoning})`,
    };
  }
  if (result.landedLeafId !== c.expectedLeafId) {
    return {
      query: c.query,
      ok: false,
      detail: `expected leaf "${c.expectedLeafId}", got "${result.landedLeafId}" (hops: ${result.hops.map((h) => h.pickedEdgeId).join(" → ")})`,
    };
  }
  // Confidence is the navigator's `topScore/4` clamp at the leaf
  // level. Reach back into the last hop to read it.
  const lastHop = result.hops[result.hops.length - 1];
  const conf = Math.min(1, (lastHop?.score ?? 0) / 4);
  if (conf < c.minConfidence) {
    return {
      query: c.query,
      ok: false,
      detail: `confidence ${conf.toFixed(3)} < ${c.minConfidence} on leaf "${c.expectedLeafId}"`,
    };
  }
  return {
    query: c.query,
    ok: true,
    detail: `→ ${result.landedLeafId} (conf ${conf.toFixed(3)}, hops ${result.hops.length})`,
    chunks: result.chunks.map((ch) => ({
      internalSlug: ch.internalSlug,
      page_url: ch.page_url,
    })),
  };
}

async function runDrift(c: DriftCase): Promise<CaseResult> {
  const result = await navigateCatalog(c.query, "bitcoin", {
    loader: fsLoader,
    history: [],
  });
  if (result.kind !== "refuse") {
    return {
      query: c.query,
      ok: false,
      detail: `expected refuse, got ${result.kind}`,
    };
  }
  return {
    query: c.query,
    ok: true,
    detail: `→ refused (${result.reasoning})`,
  };
}

async function main() {
  const bank = JSON.parse(await readFile(TEST_BANK, "utf8")) as TestBank;
  console.log(`Bitcoin catalog smoke — ${bank.cases.length} positive cases, ${bank.antiDriftCases.length} drift probes\n`);

  const positiveResults = await Promise.all(bank.cases.map(runPositive));
  const driftResults = await Promise.all(bank.antiDriftCases.map(runDrift));

  let failed = 0;
  for (const r of [...positiveResults, ...driftResults]) {
    const tag = r.ok ? "  ok " : "  FAIL";
    console.log(`${tag}  ${r.query}\n        ${r.detail}`);
    if (!r.ok) failed++;
  }

  // Local-copy guarantee: every catalog leaf citation must resolve to
  // a real file under public/corpus/bitcoin/<slug>.json. The chat trace
  // renders a "local copy" badge using `internalSlug` (or a fallback
  // computed from the URL); if the corresponding file is missing in
  // the static deploy, the badge 404s. Asserting here means a curator
  // adding new sources who forgets to run `build-catalog-corpus`
  // breaks the smoke build before broken links ship.
  let corpusFailed = 0;
  for (const r of positiveResults) {
    if (!r.ok || !r.chunks?.length) continue;
    for (const c of r.chunks) {
      if (!c.internalSlug) continue;
      const localPath = path.join(
        REPO_ROOT,
        "artifacts",
        "emerald",
        "public",
        "corpus",
        "bitcoin",
        `${c.internalSlug}.json`,
      );
      try {
        await readFile(localPath, "utf8");
      } catch {
        console.log(
          `  FAIL  local-copy missing for ${c.page_url}\n        expected ${localPath}`,
        );
        corpusFailed++;
      }
    }
  }
  if (corpusFailed > 0) {
    console.error(
      `${corpusFailed} citation(s) had no local copy. Run \`pnpm --filter @workspace/scripts run build-catalog-corpus\`.`,
    );
    process.exit(1);
  }

  console.log("");
  if (failed === 0) {
    console.log(
      `All ${positiveResults.length + driftResults.length} cases passed (local-copy resolved for every cited source).`,
    );
  } else {
    console.error(`${failed} case(s) failed.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
