# Installing Greater

Greater is a FOSS lead-gen chat widget. The Bitcoin pack ships ready to run; everything else is your corpus and your taste.

This document has two tracks. Read the one that applies to you.

---

## Track A — Bitcoiners

You want to run the bot exactly as it ships on hire.colonhyphenbracket.pink, branded for your own outfit, possibly with extra Bitcoin material added. You do not need to touch the retrieval pipeline.

### 1. Clone & install

```bash
git clone https://github.com/colonhyphenbracket/greater
cd greater
pnpm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL` — PostgreSQL (a free tier on Neon or Supabase is fine)
- `TOGETHER_API_KEY` — Together.AI key (Llama 3.3 70B, ~$0.88/1M tokens, used for the cloud-fallback path)
- `VITE_WEB3FORMS_ACCESS_KEY` — Web3Forms key for the contact form

The Bitcoin pack runs **catalog-first** in the browser. There is no embedding model download, no 30-minute warm-up. First paint is under 2 seconds on a cold load. The cloud LLM only fires when the navigator hands off — typically only on the answer-polishing step, never on retrieval.

### 3. Seed the database

```bash
pnpm --filter @workspace/db run push
pnpm --filter @workspace/scripts run seed-articles
```

### 4. Run

```bash
pnpm dev
```

The bot serves at `localhost` on the workflow's assigned port (see preview pane). Default persona is `fintech`, which is wired to the Bitcoin catalog.

### 5. Add your own Bitcoin material (optional)

The Bitcoin catalog lives in `artifacts/emerald/public/catalog/bitcoin/`. To extend it:

1. Pick a branch (`austrian-monetary/`, `core-internals/`, `lightning/`, etc.)
2. Add a leaf JSON file: `<branch>/<leaf-id>.json` with `id`, `label`, `brief` (the canned, citation-marked answer), and `sources[]` where each entry has `label`, `url`, `excerpt`, and optionally `internalSlug` (pointer to a per-doc copy under `public/corpus/bitcoin/<slug>.json` — when set, the chat trace renders a "local copy" badge so visitors can verify the citation against the static repo). Optional `relatedLeafIds: string[]` for suggested follow-ups.
3. Register the leaf as an edge in `<branch>/index.json`.
4. Bump the `version` field in `artifacts/emerald/public/catalog/bitcoin/index.json` (e.g. `"v1"` → `"v2"`). The browser caches the catalog by version; without a bump, returning visitors will keep the old tree.
5. Re-run the smoke harness: `pnpm --filter @workspace/scripts run bitcoin-catalog-smoke`.

If you want to add raw long-form documents (not curated leaves), drop them under `scripts/src/bitcoin-seed/` and re-run `build-bitcoin-seed`. The per-doc JIT layer at `artifacts/emerald/public/corpus/bitcoin/` will pick them up; the leaves can reference them by slug.

### 6. Re-brand

- `project.md` (or your equivalent project-level README) — your project info and architecture notes
- `artifacts/emerald/src/data/harness/bitcoinCharter.ts` — voice and persona
- `artifacts/emerald/public/catalog/bitcoin/index.json` → `topicalAnchor` — what the bot says when it refuses off-topic
- Logo, palette, fonts — `artifacts/emerald/src/styles/` and `src/components/`

---

## Track B — Other-niche operators

You want a Greater-style bot for something other than Bitcoin: Ethereum-validator support, a self-hosted-tools advice bot, a regional-cycling-routes assistant, whatever. The catalog architecture is the right starting point — it's deterministic, low-latency, and refuses gracefully when out of scope.

### 1. Decide your refusal scope

Write one sentence: "This bot covers X — on purpose." Everything off that scope gets refused. This sentence becomes `topicalAnchor` in your catalog root.

### 2. Sketch the L1 → L2 → leaf tree on paper

Greater's Bitcoin pack uses 8 L1 branches × ~6 leaves each. For a niche bot, start narrower — 3–5 L1 branches, 4–6 leaves per branch. The navigator handles up to 4 hops, but most useful catalogs are 2 hops deep.

Each edge has:

- `label` — the noun phrase a visitor would click ("Sound money")
- `summary` — 1–3 sentences shown in clarification prompts (branch/stub edges only; leaves carry their long-form text in the leaf file's `brief` field instead)
- `searchTerms` — hidden ranking-only tokens for the BM25 ranker (e.g. populate `austrian-monetary`'s root edge with leaf-vocabulary like `"fiat"`, `"21 million"`, `"halving"` so root-level matches still route correctly)
- `kind` — `branch`, `leaf`, or `stub`

### 3. Author the catalog

Mirror `artifacts/emerald/public/catalog/bitcoin/` for your pack:

```
artifacts/emerald/public/catalog/<your-pack>/
├── index.json                      # root with L1 edges
├── <branch-1>/
│   ├── index.json                  # branch with leaf edges
│   ├── <leaf-1>.json               # full leaf with sources
│   └── <leaf-2>.json
└── <branch-2>/index.json           # stub branch (no leaves yet)
```

A `stub` branch is a feature: visitors see what you intend to cover, even when you haven't authored the leaves yet. Don't pretend a stub is a leaf — the navigator returns a "graceful stub" message that points at primary sources.

### 4. Wire the pack

In `artifacts/emerald/src/llm/LLMProvider.tsx`, add your pack to `SEED_BUNDLES` with `useCatalog: true`. In `artifacts/emerald/src/components/ChatWidget.tsx`, route your persona to `useCatalog: { packSlug: "<your-pack>" }`.

### 5. Tune the anti-drift gate

The Bitcoin pack ships shitcoin/scam/financial-advice regexes in `artifacts/emerald/src/llm/catalog/antiDrift.ts`. For other niches, edit those regexes to match your refusal categories. Deterministic regex beats LLM-based refusal — no chance the model talks itself into engaging with the off-topic question.

### 6. Write smoke tests

Copy `scripts/src/bitcoin-seed/catalog-smoke-tests.json` to your pack's smoke file and add 15–25 cases. Each case asserts `query → leaf-id` (or `query → refused`). Run with `pnpm --filter @workspace/scripts run bitcoin-catalog-smoke` (or duplicate the harness for your pack).

When all your cases pass, you have a deterministic, no-embedding, sub-2-second-first-paint chat bot for your niche.

### 7. Other 6 packs

Greater also ships flat-embed packs for non-Bitcoin domains. Those are untouched by this catalog work — they continue to load a Xenova embedding model in the browser and run cosine retrieval over chunks. Use whichever architecture fits your pack: catalog for crisp niches with strong refusal scope, flat-embed for broad knowledge bases where any chunk could plausibly answer.

---

## Architecture cheat sheet

| Concern | Catalog (Bitcoin) | Flat embed (other 6 packs) |
|---|---|---|
| First paint | <2s | 30s+ (model download + index) |
| Retrieval | BM25 over edge labels/summaries/searchTerms | cosine over chunk embeddings |
| Refusal | Deterministic regex gate before navigation | LLM-judged from retrieved context |
| Citations | Per-leaf `sources[]` (structural) | Per-chunk source URLs (statistical) |
| Failure mode | Clarification ("did you mean…?") or graceful stub | "I don't have a snippet that directly covers X" preamble |
| Adding content | Author one leaf JSON | Add to source list, re-embed corpus |

---

## Where things live

- Catalog navigator: `artifacts/emerald/src/llm/catalog/navigator.ts`
- Anti-drift gate: `artifacts/emerald/src/llm/catalog/antiDrift.ts`
- Pack flag: `SeedBundleConfig.useCatalog` in `artifacts/emerald/src/llm/LLMProvider.tsx`
- Per-doc JIT corpus: `artifacts/emerald/public/corpus/bitcoin/<slug>.json`
- Smoke harness: `scripts/src/bitcoin-catalog-smoke.ts` + `scripts/src/bitcoin-conversation-smoke.ts`

See `docs/CORPUS_EXPANSION.md` for the catalog architecture rationale, `docs/SOURCES.md` for licensing, and `docs/TESTING.md` for the full smoke-test reference.
