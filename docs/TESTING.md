# Testing the Bitcoin bot

Greater ships a retrieval smoke test that validates the live corpus before every deploy. The test runs in plain Node.js, uses the same embedding model the browser uses (`Xenova/bge-small-en-v1.5`), and produces a pass/fail report you can read at a glance.

You do **not** need an LLM, an API key, a GPU, or a browser to run it. Anyone with `pnpm` can clone the repo and verify that the bot still answers what it should.

## Run it

```bash
pnpm install
pnpm --filter @workspace/scripts run smoke-test
```

First run takes a few minutes — it embeds every chunk in the corpus (~7-8k chunks) on CPU and caches the result. Subsequent runs finish in seconds.

Output looks like:

```
PASS  [high]  high-rbf  —  "What is Replace-by-Fee?"
        top score 0.612 from optech
PASS  [high]  high-sound-money  —  "What is sound money according to the Austrian school?"
        top score 0.578 from mises
PASS  [irrelevant]  irrelevant-swallow  —  "What is the airspeed velocity of an unladen swallow?"
        top score 0.187 ≤ max 0.30 (graceful no-retrieval as expected)
…

Summary
  14 passed · 0 failed · 14 total
```

If anything fails, the runner exits non-zero (CI will fail the build) and prints the top retrieved chunks for the failing question so you can see exactly what the corpus surfaced instead.

## Add your own test (no TypeScript required)

Open `scripts/src/bitcoin-seed/smoke-tests.json` and append an object. Every test is one JSON entry with these fields:

| Field | Required | What it does |
|---|---|---|
| `id` | yes | Short slug for the test (e.g. `"high-mempool"`) — appears in the report |
| `question` | yes | Exactly what a visitor would type into the chat widget |
| `expectedBand` | yes | One of `"high"`, `"medium"`, `"low"`, `"irrelevant"` |
| `minTopScore` | high/med/low | Minimum acceptable cosine similarity for the top retrieved chunk |
| `maxTopScore` | irrelevant only | Maximum acceptable cosine — above this the test fails (corpus retrieved an off-topic question confidently, which is a regression) |
| `expectedTopSourceTypeAnyOf` | optional | Array of source_types (`"optech"`, `"github-commit"`, `"bitcointalk"`, `"mises"`, `"nakamoto"`) — if set, the top chunk must come from one of these |
| `notes` | optional | Free-form note for humans — never affects pass/fail |

### Example: add a test for a new question

```json
{
  "id": "high-mempool-policy",
  "question": "What is mempool policy and how does it differ from consensus rules?",
  "expectedBand": "high",
  "expectedTopSourceTypeAnyOf": ["optech", "github-commit"],
  "minTopScore": 0.50,
  "notes": "Distinguishing policy from consensus is a common shit-test from sophisticated visitors."
}
```

Save the file, re-run `pnpm --filter @workspace/scripts run smoke-test`, and your new test runs alongside the rest. The embedding cache is invalidated automatically when the corpus content changes, but the test list is consulted fresh on every run — adding a test never requires re-embedding.

## Picking thresholds

The `Xenova/bge-small-en-v1.5` model produces normalized cosine scores. Empirical bands we use:

| Score | What it means |
|---|---|
| `≥ 0.55` | Strong semantic match — the chunk almost certainly contains the answer |
| `0.40 – 0.55` | Solid match — the chunk is in the right neighborhood, the model can usually answer from it |
| `0.25 – 0.40` | Weak match — partial relevance; the live UI shows a "I don't have a snippet that directly covers X" preamble |
| `< 0.25` | No real match — the live UI's hard-refusal branch fires |

If you're not sure what threshold to set, run the smoke test once with a generous `minTopScore` (e.g. `0.20`), look at the actual score in the output, and tighten from there. The test report shows the top score on every pass, not just on failures, when you pass `--verbose`.

## When the smoke test fails in CI

The GitHub Actions workflow `.github/workflows/rebuild-corpus-on-merge.yml` runs the smoke test after every corpus rebuild. If a test fails, the new corpus is **not** committed — the previous bundle stays in production. You'll see the failure in the Actions tab, and it'll point you at the exact question and the chunks the corpus served instead.

Common causes of regressions:

1. **A high-confidence test is now medium**: a new corpus addition is competing with the old top chunk on the same question. Either tighten the test (raise `minTopScore` for that question) or curate the new addition.
2. **An irrelevant test now scores too high**: junk content has been added that's semantically close to common queries. This is a real bug — investigate which new doc is at fault and remove it.
3. **All tests dropped a few points**: something changed about how chunks are produced (different chunk size, different cleaner). Check the build script's git diff.

## Why this exists

The Bitcoin demo bot is a retrieval-augmented assistant, not a fine-tuned model. Its quality is **entirely a function of the corpus**. The smoke test is the lightweight, deterministic check that catches the failure mode that would otherwise only be caught by a visitor — "I asked it about RBF and it gave me an answer about Austrian economics."

It is also FOSS-friendly: anyone forking Greater can add their own test cases, run the suite locally, and verify their corpus changes haven't broken anything. No proprietary tooling, no AI assistant required to participate.
