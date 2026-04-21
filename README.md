# Greater

> Sovereign-by-default support bots. FOSS shell, persona-tuned demos,
> browser-local inference. **No per-message API tax. No vendor between
> you and your customers.**

[![License: MIT](https://img.shields.io/badge/License-MIT-FE299E.svg)](#license)
[![Live demo](https://img.shields.io/badge/live%20demo-FinTech-FE299E)](https://hire.colonhyphenbracket.pink/demo/blockstream)
[![Read the source](https://img.shields.io/badge/source-github-555.svg)](https://github.com/rorshockbtc/greater-than)
[![Compliance](https://img.shields.io/badge/compliance-WCAG%202.2%20AA-2563eb.svg)](./COMPLIANCE.md)
[![Built by](https://img.shields.io/badge/built%20by-colonhyphenbracket-FE299E.svg)](https://colonhyphenbracket.pink)

Greater is a free, open-source shell for industry-specific support
chatbots that — by default — answer in the visitor's browser using
WebGPU. There is no per-message API cost, message content stays
in-browser on the default flow, and there is no vendor mediating
between you and your customers. (Caveats: the marketing site loads
Google webfonts, and there is a labelled, client-capped cloud
fallback for browsers without WebGPU. See
[`COMPLIANCE.md`](./COMPLIANCE.md) for the full posture.)

The shell is MIT. The model is open-weight (Llama-3.2-1B-Instruct,
q4f16). The corpus is yours. The runtime cost is the visitor's device.

The work that gets hired — and the work that actually closes
deals — is the corpus curation, the persona tuning, the
domain-specific Pipes that wrap proprietary knowledge bundles, and
the integration into your stack. That's `colonhyphenbracket`.

---

## Try it now

The launch demo is wired live: a FinTech bot grounded in the
Blockstream support corpus.

→ **[hire.colonhyphenbracket.pink/demo/blockstream](https://hire.colonhyphenbracket.pink/demo/blockstream)**

The other five personas (HealthTech, Startups, Faith, Schools,
Small Business) ship as persona-tuned holding pages — the seed
corpora are still being curated.

For the longer story behind why Greater is built the way it is —
explicit bias, sovereign-by-default, FOSS shell with proprietary
weights as the work-that-gets-hired — see the company philosophy
doc:

→ **[Read the CHB company philosophy](./docs/CHB-PHILOSOPHY.md)**

---

## What you get out of the box

- **Six industry personas** — fintech, healthtech, startups, faith,
  schools, small-business. Each ships with a written-out failure
  mode, a pivot story, a tuned welcome message, and a Pipe slot for
  the proprietary knowledge bundle.
- **Browser-local LLM** — Llama-3.2-1B-Instruct (q4f16) and
  bge-small-en-v1.5 running in a Web Worker on WebGPU.
- **IndexedDB vector store** — RAG retrieval lives on the visitor's
  device. The corpus you ship is cached after first load.
- **Cited answers** — every retrieved chunk is shown to the visitor
  via the "Thought trace" disclosure on every reply.
- **Honest cloud fallback** — when WebGPU isn't ready, the widget
  can call a server endpoint for the first three turns, badged
  "Cloud" so provenance is visible. After the cap, the badge changes
  to "Local-only · cloud rate-limited".
- **Generic web-scraping ingestion** — paste a URL or sitemap into
  the chat widget's settings menu; the server fetches it (Mozilla
  Readability), the browser chunks and embeds it, IndexedDB persists
  it. No LLM in the ingestion path.
- **Pipes** — a Pipe is a curated, opinionated knowledge bundle
  authored by a domain expert. Drop manifests into `data/pipes/`
  (gitignored) and the Vite plugin inlines them as
  `virtual:greater-pipes`.
- **Bias-aware retrieval** — the Bitcoin Pipe ships with Core,
  Knots, and Neutral perspectives; the chat shows a bias toggle when
  multiple perspectives are mounted, and the transcript drops an
  inline note when the visitor switches.
- **Compliance posture** — written-down, deep-linkable, honest. See
  [`COMPLIANCE.md`](./COMPLIANCE.md) and the `/compliance` page.
- **Anti-AI design pass** — hand-drawn SVGs, build-stamp footer,
  margin notes, asymmetric layout cues, real first-person copy.
  This is a real product built by a real person.
- **WCAG 2.2 AA** — focus rings, skip-to-content, reduced-motion,
  `aria-live` on streaming chat, role/status disclaimers.

---

## FOSS vs. proprietary — what's in this repo, what isn't

**FOSS, in this repo (MIT-licensed):**

- The full Greater shell (`artifacts/emerald`).
- The chat widget, model loader, vector store, ingestion
  orchestrator, KnowledgePanel, BiasToggle.
- Six persona scaffolds with case-study copy.
- The Bitcoin seed builder (`scripts/src/build-bitcoin-seed.ts`) —
  pulls OpTech, the last 12 months of `bitcoin/bitcoin` and
  `bitcoinknots/bitcoin` commits, and a checked-in list of
  BitcoinTalk threads.
- The compliance document and the `/compliance` page.
- The persona case studies and the marketing site.

**Proprietary, gitignored, not in this repo:**

- `data/pipes/` — Pipe manifests. The Bitcoin Pipe (Core/Knots
  bias-aware) is the reference Pipe that ships behind the
  `/demo/blockstream` route. Authoring more Pipes is the work
  `colonhyphenbracket` does for hire.
- `data/seeds/bitcoin.json` — the output of the Bitcoin seed
  builder. Anyone can regenerate it from this repo (the script is
  open) but the cached artifact is not committed.
- `artifacts/emerald/public/seeds/` — the public-static copy that
  the LLMProvider fetches on first run for the FinTech demo.

If you want to run the FinTech demo locally with the proprietary
Bitcoin bundle pre-loaded, run the seed builder yourself (see
[Quickstart](#quickstart) below). Otherwise the demo will fall back
to ingesting the Blockstream support corpus on first visit.

---

## Quickstart

### Run the marketing site + chat shell locally

```bash
pnpm install
pnpm --filter @workspace/emerald run dev
# → http://localhost:5173
```

### Run the API server (for ingestion + escalation)

```bash
pnpm --filter @workspace/api-server run dev
```

### Build the Bitcoin seed bundle (optional, ~10–25 min cold)

```bash
# Anonymous; sleeps through GitHub rate-limit windows.
pnpm exec tsx scripts/src/build-bitcoin-seed.ts

# Faster + higher rate limit (recommended for dev):
GITHUB_TOKEN=ghp_xxx pnpm exec tsx scripts/src/build-bitcoin-seed.ts
```

The script writes `data/seeds/bitcoin.json` (gitignored). It also
syncs a public-fetchable copy to `artifacts/emerald/public/seeds/`
so the LLMProvider can pull it on first run. Both directories are
gitignored; the script is fully resumable and caches every fetched
page to disk.

### Author a new persona Pipe

Pipes live under `data/pipes/<slug>/manifest.json`. The Vite plugin
in `artifacts/emerald/scripts/pipes-vite-plugin.ts` discovers them at
build time. See `data/pipes/bitcoin/` (in your local clone, post
seed-build) for the reference structure.

---

## How it works (one paragraph)

A visitor opens the chat. Their question is handed to a Web Worker
running Llama-3.2-1B on WebGPU. Before the model runs, the question
is embedded with bge-small-en-v1.5 (also browser-local) and matched
against the IndexedDB-backed vector store. The top 4–8 chunks are
inlined into a system prompt with citation instructions. The model
streams tokens back; the widget renders them with the citation
markers turned into clickable links to the source pages. Every
retrieved chunk is visible behind a "Thought trace" disclosure.
Nothing leaves the device on the default flow.

For the long version with the actual flow diagram, see
[`/how-it-works`](https://hire.colonhyphenbracket.pink/how-it-works).

---

## Announcement (HN / X / Nostr — copy/paste-ready)

> **Greater — sovereign-by-default support bots, FOSS by default.**
>
> Open-source shell for industry-specific support chatbots that run
> entirely in the visitor's browser (WebGPU + Llama-3.2-1B + IndexedDB
> RAG). Six personas, one wired live: a Bitcoin support bot grounded
> in the Blockstream corpus, with a Core/Knots bias toggle.
>
> No per-message API tax. No vendor between you and your customers.
> The shell is MIT. The corpus is yours.
>
> Live demo: https://hire.colonhyphenbracket.pink/demo/blockstream
> Source: https://github.com/rorshockbtc/greater-than
> Compliance posture (HIPAA / WCAG / GDPR / PCI / SOC 2): /compliance
>
> Built by one fractional architect, in public, in pink.
> :-]

---

## Project structure (pnpm monorepo)

```
artifacts/
  emerald/        # Greater marketing site + chat shell (the FOSS bit)
  api-server/     # Express server for ingestion + escalation
  mockup-sandbox/ # Component-preview server for design iteration
data/
  pipes/          # Proprietary Pipe manifests       (gitignored)
  seeds/          # Generated seed bundles            (gitignored)
scripts/
  src/            # Seed builders, ingest helpers
COMPLIANCE.md     # Engineering-grade compliance posture
README.md         # You are here.
```

---

## Credits

Built by [colonhyphenbracket](https://colonhyphenbracket.pink).

The proprietary Pipes, the persona-tuned weights, and the integration
work into your stack are
[available for hire](https://hire.colonhyphenbracket.pink).

## License

MIT. See [`LICENSE`](./LICENSE).

```
Greater — built by colonhyphenbracket. :-]
```
