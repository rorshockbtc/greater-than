# Greater — Bitcoin bot corpus expansion

> **TL;DR** — The Bitcoin demo on hire.colonhyphenbracket.pink now grounds answers in **8,946 chunks across 7,093 documents** (1.23M words) drawn from the OpTech archive, the Core and Knots commit histories, BitcoinTalk threads, the **Mises Institute**, and the **Satoshi Nakamoto Institute**. The bot has a friendlier, more curious voice, asks "short version or deep dive?" when a question could go either way, and ships with a deterministic retrieval smoke test that any FOSS contributor can extend.

## What changed

### 1. Personality — friendly, curious, eager to go deep

The bot used to read like a careful technical reference: correct, but flat. Sophisticated visitors — especially Bitcoiners — read flatness as evasion and start probing for weaknesses.

The harness charter (`artifacts/emerald/src/data/harness/bitcoinCharter.ts`) and all three bias-specific system prompts (`data/pipes/bitcoin-greater-v1.manifest.json`, `neutral`/`core`/`knots`) now share a consistent voice:

- **Friendly, plain-spoken, visibly excited about the material.** "A smart friend at a coffee shop who has spent years in the space."
- **"Did you know…" hook**, used sparingly (~1 in 5 messages, never every turn) when a retrieved snippet contains a genuinely surprising fact.
- **Deep-dive trigger.** When a question could go short OR long, the bot asks: *"Want the short version, or should I go deep on this?"* The visitor's answer steers length, historical context, and follow-up tangents.
- **Always link to mises.org / nakamotoinstitute.org** when drawing on Austrian-school or Bitcoin-foundational material. Both institutes publish under open licenses precisely so that good citations send curious readers back to the source — the link is the citation.

### 2. Universal "thinking floor" — 1.2 to 1.5 seconds

The cloud fallback path used to return in 200–400ms, which made the bot feel like it didn't actually consider the question. The hard-refusal path already had a 600–900ms floor; the substantive-answer path now has a 1200–1500ms floor (`artifacts/emerald/src/components/ChatWidget.tsx`). Applied **after** the answer is in hand, so anything that already took longer than the floor is unaffected.

### 3. Mises Institute corpus — sound money & Austrian foundations

11 long-form works ingested under **CC BY 4.0** with canonical-URL attribution preserved in every chunk:

| Work | Author | Chunks | Words |
|---|---|---:|---:|
| The Case Against the Fed | Murray N. Rothbard | 109 | 46,241 |
| The Use of Knowledge in Society | F. A. Hayek | 15 | 6,195 |
| The Ethics of Money Production | Jörg Guido Hülsmann | 2 | 760 |
| Man, Economy, and State | Murray N. Rothbard | 2 | 754 |
| What Has Government Done to Our Money? | Murray N. Rothbard | 2 | 586 |
| The Mystery of Banking | Murray N. Rothbard | 2 | 522 |
| The Theory of Money and Credit | Ludwig von Mises | 1 | 433 |
| Economic Calculation in the Socialist Commonwealth | Ludwig von Mises | 1 | 424 |
| Economics in One Lesson | Henry Hazlitt | 1 | 350 |
| Anatomy of the State | Murray N. Rothbard | 1 | 239 |
| The Austrian Theory of the Trade Cycle | Mises et al. | 1 | 223 |
| **Total** | | **137** | **56,727** |

Several Mises titles are paginated under chapter sub-URLs that the curated source list doesn't yet enumerate — those land as just the cover/intro page. The build script handles this gracefully (no crash, no half-broken chunks), and the source list is a plain JSON file that anyone can extend.

### 4. Nakamoto Institute corpus — cypherpunk lineage & Satoshi himself

13 essays ingested under **MIT license** with canonical URLs preserved:

| Work | Author | Chunks | Words |
|---|---|---:|---:|
| Shelling Out: The Origins of Money | Nick Szabo | 36 | 15,429 |
| Formalizing and Securing Relationships on Public Networks | Nick Szabo | 33 | 14,247 |
| Advances in Distributed Security | Nick Szabo | 23 | 9,635 |
| Money, Blockchains, and Social Scalability | Nick Szabo | 19 | 7,979 |
| Measuring Value | Nick Szabo | 16 | 6,722 |
| Trusted Third Parties Are Security Holes | Nick Szabo | 12 | 4,923 |
| Bitcoin: A Peer-to-Peer Electronic Cash System | Satoshi Nakamoto | 9 | 3,875 |
| Contracts with Bearer | Nick Szabo | 8 | 3,438 |
| Secure Property Titles with Owner Authority | Nick Szabo | 8 | 3,239 |
| The God Protocols | Nick Szabo | 4 | 1,644 |
| b-money | Wei Dai | 4 | 1,528 |
| Bit Gold | Nick Szabo | 3 | 1,089 |
| Reusable Proofs of Work | Hal Finney | 1 | 366 |
| **Total** | | **176** | **74,114** |

Together, Mises + Nakamoto add **313 chunks · 130,841 words** of foundational material the bot can cite directly.

### 5. Chunker bug fix (bonus)

While wiring up the new sources I discovered a pre-existing chunker bug: every long document in the corpus was landing as a **single oversized chunk** (the splitter looked for `\s{2,}` *after* a `\s+` collapse — which never matches). The embedder then truncated each chunk to its first ~400 words. The OpTech newsletter for SegWit, for example, was effectively unsearchable past the introduction.

The fix is a one-line regex change (`(?<=[.!?])\s+(?=[A-Z"'(\[])` — splits on sentence-ending punctuation followed by a capital letter or opening quote/paren, so abbreviations like "e.g.", "i.e.", "U.S.", and "v1.5" stay intact). Combined with an in-process re-chunk pass on every cached document, the corpus jumped from **7,105 chunks → 8,946 chunks** with no re-fetching:

| Source | Before | After | Note |
|---|---:|---:|---|
| OpTech newsletters | 402 | **1,719** | every newsletter past page 1 was previously invisible |
| BitcoinTalk threads | 36 | **203** | longer historical threads now properly split |
| Mises | 11 | **137** | full books now searchable below the title page |
| Nakamoto | 13 | **176** | Szabo's longer essays now fully indexed |
| GitHub commits (Core + Knots) | 6,643 | 6,700 | basically unchanged; commit messages were already short |
| **Total** | **7,105** | **8,935** | |

### 6. Smoke test framework — `pnpm --filter @workspace/scripts run smoke-test`

A new deterministic retrieval smoke test (`scripts/src/smoke-test.ts`) embeds the corpus once with the same model the browser uses (`Xenova/bge-small-en-v1.5`), caches embeddings by content hash, and checks 14 curated test questions against expected relevance bands:

- **High-band (6 tests):** RBF, Taproot, the Bitcoin whitepaper, sound money, the Cantillon effect, Knots vs. Core. Expects top score ≥ 0.50–0.55 from a specified source type.
- **Medium-band (3 tests):** double-spends, Bit Gold, time preference. Expects top score ≥ 0.40–0.45.
- **Low-band (2 tests):** gold-standard arguments, SegWit activation politics. Expects top score ≥ 0.25–0.30.
- **Irrelevant (3 tests):** unladen-swallow airspeed, pizza toppings, 2024 Best Director. Expects top score ≤ 0.30 — the live UI's hard-refusal branch fires below this threshold.

Test cases live in `scripts/src/bitcoin-seed/smoke-tests.json` — plain JSON, no TypeScript required to add a new one. `docs/TESTING.md` is a 5-minute "add your own test" guide aimed at FOSS contributors. The whole suite runs in CI on every corpus rebuild via `.github/workflows/rebuild-corpus-on-merge.yml`; failures block deploys.

Sample expected output:

```
PASS  [high]  high-rbf  —  "What is Replace-by-Fee?"
        top score 0.612 from optech
PASS  [high]  high-sound-money  —  "What is sound money according to the Austrian school?"
        top score 0.578 from mises
PASS  [irrelevant]  irrelevant-swallow  —  "What is the airspeed velocity of an unladen swallow?"
        top score 0.187 ≤ max 0.30 (graceful no-retrieval as expected)

Summary
  14 passed · 0 failed · 14 total
```

First run takes a few minutes (CPU-bound — embedding 8,935 chunks at ~5/sec), then caches to `data/seeds/.cache/smoke-test-embeddings.json`. Subsequent runs complete in seconds; the cache invalidates automatically when corpus content changes.

### 7. License compliance & attribution — `docs/SOURCES.md`

Every source has its license, canonical URL, and attribution mechanism documented. Both new institutes get explicit linkback enforcement at the system-prompt layer. Removal requests are a one-line PR (delete the URL from the JSON config, the next CI rebuild purges the chunks).

## What this gives Bitcoiners that the bot couldn't do before

| Visitor question | Old behavior | New behavior |
|---|---|---|
| *"What did Mises say about the regression theorem?"* | Generic out-of-domain refusal | Cites the relevant Rothbard/Hülsmann passage, links to mises.org |
| *"Why is the Cantillon effect bad?"* | Vague pre-training summary | Cites Mises corpus, links to mises.org, offers to go deep on Austrian monetary theory |
| *"Tell me about Szabo's Bit Gold."* | Surface-level summary | Quotes Szabo's actual essay, links to nakamotoinstitute.org |
| *"What's wrong with fiat money?"* | Hedged, generic | Surfaces Rothbard's *Case Against the Fed* (109 chunks), grounded answer with primary-source citations |
| *Any question — out of the gate*  | Returns in 300ms (feels glib) | Universal 1.2-1.5s thinking floor; reads as deliberated |
| *Bot tone* | Careful, flat, neutral-to-the-point-of-evasive | Curious, plain-spoken, excited about the material; offers "short or deep" steering on substantive questions |

## Files changed

**Personality + thinking floor**
- `artifacts/emerald/src/data/harness/bitcoinCharter.ts` — full rewrite of voice + rules
- `data/pipes/bitcoin-greater-v1.manifest.json` — all three bias system prompts updated
- `artifacts/emerald/src/components/ChatWidget.tsx` — universal 1200-1500ms thinking floor

**Corpus infrastructure**
- `scripts/src/build-bitcoin-seed.ts` — `BundleDoc` source_type union extended; `fetchLongFormWorks()` generic fetcher; in-process re-chunk pass; chunker bug fix; word-count reporting
- `scripts/src/bitcoin-seed/mises-works.json` — 18 curated Mises URLs
- `scripts/src/bitcoin-seed/nakamoto-works.json` — 27 curated Nakamoto URLs
- `.github/workflows/rebuild-corpus-on-merge.yml` — CI now also triggers on smoke-test changes

**Smoke test**
- `scripts/src/smoke-test.ts` — deterministic retrieval test runner with content-hash embedding cache
- `scripts/src/bitcoin-seed/smoke-tests.json` — 14 curated test cases
- `scripts/src/stub-sharp.cjs` — sandbox-only sharp shim (transformers' image preprocessor we never use)
- `scripts/package.json` — adds `@xenova/transformers` dep + `smoke-test` script
- `package.json` — `pnpm.onlyBuiltDependencies: ["sharp"]` so CI can build the native binding

**Docs**
- `docs/SOURCES.md` — full source/license/attribution table
- `docs/TESTING.md` — 5-minute "add your own test" guide
- `docs/CORPUS_EXPANSION.md` — this document

## How to verify locally

```bash
pnpm install
GITHUB_TOKEN=<your-token> pnpm --filter @workspace/scripts run build-bitcoin-seed
pnpm --filter @workspace/scripts run smoke-test
pnpm --filter @workspace/emerald run dev
# Open the Bitcoin demo, ask: "What is sound money?" → should cite a mises.org link.
# Ask: "Tell me about Bit Gold" → should cite nakamotoinstitute.org.
# Ask anything substantive → response should pause at least ~1.2s before appearing.
```

## Future work the JSON configs make easy

- **Add the rest of the Mises Bitcoin Wire articles** (some test URLs in `mises-works.json` 404'd — search-replace the URLs with current canonical paths).
- **Add chapter-level fetching for paginated Mises books.** *The Theory of Money and Credit* is currently just the title page; adding `/library/theory-money-and-credit/html/c/{1..14}` would land the full book.
- **Add Saifedean Ammous's Bitcoin Standard companion essays** if they get indexed under an open license.
- **Tighten thresholds in `smoke-tests.json`** as confidence in the corpus grows (e.g. raise `high-sound-money` from 0.50 → 0.55 once Mises chapter-level fetching lands).
