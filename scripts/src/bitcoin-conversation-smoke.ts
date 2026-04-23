/**
 * Bitcoin long-conversation drift harness (Task #68).
 *
 * Simulates a 25-turn user session that mixes technical questions,
 * philosophical probes, and adversarial off-topic attempts. Asserts
 * three properties end-to-end:
 *
 *   1. **No drift to shitcoins or speculation.** Every adversarial
 *      probe must be refused by the anti-drift gate; the catalog
 *      walk must never land on a leaf in response to one.
 *
 *   2. **No contradiction across turns.** A simple consistency check:
 *      when the same canonical question is asked multiple times in
 *      different phrasings, the navigator must land on the same leaf
 *      every time. This catches ranker instability.
 *
 *   3. **Topical anchor holds.** Every non-refused turn must end with
 *      the navigator on a leaf inside the curated catalog (i.e. the
 *      synthetic chunks must reference the bitcoin pack). A drift
 *      into "I don't know" territory is a failure.
 *
 * Deterministic; runs offline via the fs loader. No model needed.
 *
 * Run: `pnpm --filter @workspace/scripts run bitcoin-conversation-smoke`.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  navigateCatalog,
  type CatalogLoader,
} from "../../artifacts/greater/src/llm/catalog/navigator";
import type { ChatTurn } from "../../artifacts/greater/src/llm/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const CATALOG_DIR = path.join(
  REPO_ROOT,
  "artifacts",
  "greater",
  "public",
  "catalog",
  "bitcoin",
);

const fsLoader: CatalogLoader = async (rel) => {
  const buf = await readFile(path.join(CATALOG_DIR, rel), "utf8");
  return JSON.parse(buf);
};

type TurnSpec =
  | { kind: "expect-leaf"; query: string; leafId: string }
  | { kind: "expect-refuse"; query: string }
  | { kind: "expect-stub"; query: string };

const TURNS: TurnSpec[] = [
  // Opening: visitor wandering through the monetary thesis.
  { kind: "expect-leaf", query: "what does it mean for money to be sound", leafId: "sound-money" },
  { kind: "expect-leaf", query: "tell me more about why a fixed supply is the key design choice", leafId: "why-fixed-supply" },
  { kind: "expect-leaf", query: "how does the cantillon effect work and who benefits from inflation", leafId: "inflation-malinvestment" },
  // Adversarial probe #1.
  { kind: "expect-refuse", query: "should I buy ethereum instead, the gas fees are cheaper" },
  // Back on track.
  { kind: "expect-leaf", query: "every fiat currency in history has been debased, right?", leafId: "fiat-end-game" },
  { kind: "expect-leaf", query: "explain the mises regression theorem and the bitcoin objection to it", leafId: "regression-theorem" },
  // Adversarial probe #2.
  { kind: "expect-refuse", query: "what's a good shitcoin to ape into for 100x gains" },
  // Visitor pivots to engineering.
  { kind: "expect-leaf", query: "how does the utxo model differ from accounts", leafId: "utxo-model" },
  { kind: "expect-leaf", query: "what is the mempool and what does replace by fee do", leafId: "mempool" },
  { kind: "expect-leaf", query: "explain consensus rules and why soft forks are preferred", leafId: "consensus-rules" },
  // Adversarial probe #3.
  { kind: "expect-refuse", query: "should I take out a heloc to buy more bitcoin" },
  // Engineering continues.
  { kind: "expect-leaf", query: "how does a miner build a block and what is the witness commitment", leafId: "block-template" },
  { kind: "expect-leaf", query: "tell me about peer discovery and eclipse attack defenses", leafId: "p2p-network" },
  { kind: "expect-leaf", query: "what is initial block download and what is in the chainstate", leafId: "node-architecture" },
  // Lightning branch — promoted from stub to fully-built.
  { kind: "expect-leaf", query: "how do htlcs and sphinx onion routing actually work on lightning", leafId: "htlc-routing" },
  // Adversarial probe #4 (price prediction).
  { kind: "expect-refuse", query: "what price will bitcoin hit by 2030, give me a number" },
  // Reasking the same canonical question in a different phrasing —
  // consistency check against an earlier turn.
  { kind: "expect-leaf", query: "remind me what the unspent transaction output model is", leafId: "utxo-model" },
  { kind: "expect-leaf", query: "is bitcoin actually used as a unit of account today, why not", leafId: "unit-of-account" },
  // Adversarial probe #5 (financial advice).
  { kind: "expect-refuse", query: "should I sell my bitcoin now or hold for the next cycle" },
  // Back on track, mempool detail.
  { kind: "expect-leaf", query: "how does child pays for parent help unstick a stuck transaction", leafId: "mempool" },
  // Privacy branch (now fully built — was previously a stub).
  { kind: "expect-leaf", query: "what is coinjoin and how does it actually improve privacy", leafId: "coinjoin" },
  // Final stretch — austrian.
  { kind: "expect-leaf", query: "what does mises say about the structural temptation to debase fiat money", leafId: "fiat-end-game" },
  { kind: "expect-leaf", query: "remind me about the 21 million cap and the halving schedule", leafId: "why-fixed-supply" },
  // Adversarial probe #6 (off-topic entirely).
  { kind: "expect-refuse", query: "i'd like a quick recommendation on which altcoin to put my paycheck into" },
  // Closing ask — engineering.
  { kind: "expect-leaf", query: "explain the difference between policy and consensus in the mempool", leafId: "consensus-rules" },
];

interface TurnResult {
  turn: number;
  ok: boolean;
  detail: string;
}

async function main() {
  console.log(`Bitcoin conversation smoke — ${TURNS.length} turns\n`);
  const results: TurnResult[] = [];
  const history: ChatTurn[] = [];
  const recentLeafIds: string[] = [];
  let landedLeafCounts = new Map<string, number>();

  for (let i = 0; i < TURNS.length; i++) {
    const spec = TURNS[i]!;
    const turnNo = i + 1;
    const result = await navigateCatalog(spec.query, "bitcoin", {
      loader: fsLoader,
      history,
      recentLeafIds: recentLeafIds.slice(),
    });
    history.push({ role: "user", content: spec.query });
    history.push({ role: "assistant", content: result.text });

    let ok = false;
    let detail = "";
    if (spec.kind === "expect-leaf") {
      ok = result.kind === "answer" && result.landedLeafId === spec.leafId;
      detail = ok
        ? `→ ${result.landedLeafId}`
        : `expected leaf=${spec.leafId}, got kind=${result.kind} leaf=${result.landedLeafId ?? "—"}`;
      if (result.landedLeafId) {
        landedLeafCounts.set(
          result.landedLeafId,
          (landedLeafCounts.get(result.landedLeafId) ?? 0) + 1,
        );
        // Update recent ring buffer (mirror chat widget behaviour).
        const next = [
          result.landedLeafId,
          ...recentLeafIds.filter((id) => id !== result.landedLeafId),
        ].slice(0, 5);
        recentLeafIds.length = 0;
        recentLeafIds.push(...next);
      }
      // On-topic chunk-anchor check.
      if (
        ok &&
        result.chunks.length > 0 &&
        !result.chunks.every((c) => c.persona_slug === "fintech")
      ) {
        ok = false;
        detail = `landed on ${result.landedLeafId} but chunks not anchored to fintech persona`;
      }
    } else if (spec.kind === "expect-refuse") {
      ok = result.kind === "refuse";
      detail = ok ? `→ refused (${result.reasoning})` : `expected refuse, got kind=${result.kind}`;
    } else {
      ok = result.kind === "stub";
      detail = ok ? "→ stub branch (graceful)" : `expected stub, got kind=${result.kind}`;
    }
    results.push({ turn: turnNo, ok, detail });
    const tag = ok ? "  ok " : "  FAIL";
    console.log(`${tag} turn ${turnNo.toString().padStart(2, "0")}  ${spec.query}\n         ${detail}`);
  }

  // Cross-turn consistency: utxo-model asked twice, mempool asked twice,
  // why-fixed-supply asked twice, fiat-end-game asked twice. Each should
  // have landed on the same leaf both times — landedLeafCounts already
  // captures this. We assert each repeated leaf was hit at least twice.
  const expectedRepeats = ["utxo-model", "mempool", "why-fixed-supply", "fiat-end-game"];
  console.log("\nConsistency (repeated leaves should land twice):");
  let consistencyFails = 0;
  for (const id of expectedRepeats) {
    const n = landedLeafCounts.get(id) ?? 0;
    const ok = n >= 2;
    if (!ok) consistencyFails++;
    console.log(`  ${ok ? "ok " : "FAIL"} ${id} → landed ${n}x`);
  }

  const failed = results.filter((r) => !r.ok).length + consistencyFails;
  console.log("");
  if (failed === 0) {
    console.log(`All ${TURNS.length} turns + consistency checks passed.`);
  } else {
    console.error(`${failed} failure(s) across turns + consistency.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
