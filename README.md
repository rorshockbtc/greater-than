# Greater

Sovereign-by-default support bots. FOSS shell, persona-tuned demos, browser-local inference.

Greater is a free, open-source shell for industry-specific support chatbots that run entirely in the visitor's browser. There is no per-message API cost, no third-party data egress in the default flow, and no vendor mediating between you and your customers.

The shell ships with six persona templates — **Startups**, **Faith-Based Organizations**, **Private Schools & Families**, **Small Businesses**, **HealthTech**, and **FinTech** — each with a distinct declared perspective, a curated corpus pipeline, and its own escalation flow. The live demo on `/demo/blockstream` is the FinTech persona, ported from the original Emerald support bot prototype.

Greater is built and maintained by [colonhyphenbracket](https://hire.colonhyphenbracket.pink). The shell is free; the corpus curation, integration, and architectural work for production deployments is for hire.

## Project status

This repository was originally `emerald-support-bot` — a Blockstream-specific demo. It has been pivoted into Greater, the platform. The Blockstream demo is preserved at `/demo/blockstream` as the live FinTech showcase.

| Area | Status |
|------|--------|
| Greater shell (landing, six personas, case studies, contact form) | ✅ Live |
| Blockstream / FinTech live demo | ✅ Live (ported from Emerald) |
| Browser-local LLM (WebGPU + Transformers.js) | ✅ Wired (Llama-3.2-1B-Instruct q4f16 + bge-small-en-v1.5, IndexedDB vector store, thought-trace UI, cloud fallback) |
| Generic web-scraping ingestion | ✅ Live (server-side Readability extraction + sitemap walker; in-browser chunking, embedding, and IndexedDB persistence; no LLM during ingestion) |
| Bitcoin knowledge ingestion (Core/Knots/OpTech/BitcoinTalk) with bias tagging | ✅ Builder script live (bias toggle UI lands in Phase 5); built bundle is gitignored |
| Pipes.pink integration (proprietary persona weights) | 🚧 Stubbed (gitignored) |
| OpenClaw signed-corpus catalog | 🪐 Aspirational — see `/openclaw` |

## Architecture

```
greater/
├── artifacts/
│   ├── api-server/          Express API — Blockstream demo intent matcher + LLM
│   └── emerald/             Greater frontend (React + Vite, wouter routing)
│       ├── src/
│       │   ├── pages/
│       │   │   ├── Home.tsx              Greater landing — six persona cards
│       │   │   ├── PersonaPage.tsx       Per-persona case study
│       │   │   ├── DemoHolding.tsx       "Coming online" holding screen
│       │   │   ├── BlockstreamDemo.tsx   Live FinTech demo (Blockstream branded)
│       │   │   ├── About.tsx             About Greater
│       │   │   └── OpenClaw.tsx          Aspirational OpenClaw page
│       │   ├── components/
│       │   │   ├── Layout.tsx            Greater nav + footer + contact CTA
│       │   │   ├── ContactFormModal.tsx  Web3Forms direct-POST contact form
│       │   │   ├── ChatWidget.tsx        Blockstream demo chat widget
│       │   │   └── ...
│       │   ├── llm/                      Browser-local LLM stack
│       │   │   ├── llmWorker.ts          Web Worker — Transformers.js (WebGPU)
│       │   │   ├── LLMProvider.tsx       Mounted above router; persists across nav
│       │   │   ├── vectorStore.ts        IndexedDB-backed cosine-sim retriever
│       │   │   ├── seedCorpus.ts         Hand-curated Bitcoin/Blockstream chunks
│       │   │   └── ModelInfoPopover.tsx  (i) popover + cache-clear control
│       │   ├── data/
│       │   │   └── personas.ts           Single source of truth for the 6 bots
│       │   └── index.css                 CHB design system tokens
│       └── public/images/personas/       Persona hero images
├── lib/
│   ├── api-spec/            OpenAPI 3.1 spec + Orval config
│   ├── api-client-react/    Generated React Query hooks
│   ├── api-zod/             Generated Zod schemas
│   └── db/                  Drizzle ORM + PostgreSQL schema
└── data/                    Gitignored: pipes/, weights/ (production-only)
```

## Design system

Greater follows the [colonhyphenbracket](https://hire.colonhyphenbracket.pink) design system:

- **Pink** `#FE299E` — primary, accent, ring
- **Blue** `#01a9f4` — secondary callouts and iconography
- **Inter** — body & headings
- **JetBrains Mono** — labels, eyebrows, microtype
- **Major Mono Display** — wordmark only (the `>` in `>greater`)
- No box-shadows; elevation is implemented via overlay utilities (`.hover-elevate`, `.active-elevate`)
- Pill buttons; thin borders; lots of negative space

The Blockstream demo route deliberately retains the Blockstream brand styling (dark nav, emerald accents, light article body) to remain an authentic representation of the original prototype.

## Running locally

### Prerequisites

- Node.js 24+
- pnpm
- PostgreSQL 14+ (`DATABASE_URL` env var)
- A [Web3Forms](https://web3forms.com) access key for the contact form (`VITE_WEB3FORMS_ACCESS_KEY`)
- A [Together.AI](https://together.ai) API key for the Blockstream demo's server-side fallback (`TOGETHER_API_KEY`)

### Setup

```bash
pnpm install
pnpm --filter @workspace/db run push
pnpm --filter @workspace/scripts run seed-articles
pnpm run dev
```

The Greater frontend is served at `/` (or the artifact's preview path). The Blockstream live demo is at `/demo/blockstream`. The API server runs on its own port.

## Routes

| Route | Page |
|-------|------|
| `/` | Greater landing — six persona cards |
| `/about` | About Greater |
| `/openclaw` | OpenClaw aspirational page |
| `/bots/:slug` | Per-persona case study (one of: `startups`, `faith`, `schools`, `small-business`, `healthtech`, `fintech`) |
| `/demo/:slug` | "Coming online" holding screen for non-FinTech personas |
| `/demo/blockstream` | Live Blockstream support demo (FinTech persona showcase) |

## Knowledge ingestion

Greater's RAG corpus has two layers:

1. **The generic, in-product scraper.** Open the chat widget, click the
   ⚙ settings icon, and choose **Manage knowledge base**. Paste a URL or
   sitemap and it will be fetched server-side (`POST /api/ingest/extract`
   and `POST /api/ingest/sitemap`), cleaned with Mozilla Readability,
   chunked deterministically in the browser, embedded with the local
   sentence-transformer, and persisted to IndexedDB. **No LLM is invoked
   during ingestion** — extraction and embedding are deterministic.

2. **The Bitcoin knowledge bundle.** The builder script at
   `scripts/src/build-bitcoin-seed.ts` aggregates the full Bitcoin
   OpTech newsletter archive, the last 12 months of merged commits from
   `bitcoin/bitcoin` (tagged `bias: "core"`) and `bitcoinknots/bitcoin`
   (tagged `bias: "knots"`), plus a curated list of high-signal
   BitcoinTalk threads from
   `scripts/src/bitcoin-seed/bitcointalk-threads.json`.

   The script and its source list are FOSS; the resulting bundle at
   `data/seeds/bitcoin.json` is gitignored. The script is
   **anonymous-first, throttled, and resumable** — it requires no
   credentials, transparently sleeps through GitHub's anonymous
   rate-limit windows (and tells you so), caches every successful page
   to `data/seeds/.cache/`, and resumes cleanly from the last cached
   page on rerun. Without a token, expect ~2–3 hours wall time. With
   `GITHUB_TOKEN` set to a fine-grained read-only token (5,000 req/hr
   instead of 60), the build finishes in ~2 minutes.

   ```
   pnpm --filter @workspace/scripts run build-bitcoin-seed
   cp data/seeds/bitcoin.json artifacts/emerald/public/seeds/bitcoin.json
   ```

   The Blockstream demo loads the bundle from `/seeds/bitcoin.json` on
   first run and shows a one-time progress indicator while it's
   embedded into IndexedDB. Subsequent loads see a meta flag and skip
   the work. If the bundle is absent (the FOSS shell case), the demo
   silently runs without it.

### Ingestion conventions

Any new ingestion or scraping job that lands in this repo should follow
the same three rules the Bitcoin builder follows:

- **Anonymous-first.** Tokens are an optimization, never a requirement.
  The script must complete a useful build with no credentials.
- **Throttled by the server, not by guesswork.** When the upstream
  exposes a rate-limit budget (e.g. GitHub's `X-RateLimit-Remaining`
  / `X-RateLimit-Reset` headers), read it and sleep until reset; never
  burst. For shared community hosts that don't publish a budget, hold
  to a small fixed delay between requests so that we never become a
  reason their traffic graph spikes.
- **Resumable.** Per-page output is cached to disk; reruns skip cached
  pages. A killed run loses no completed pages.

Surface progress and any sleeps to the operator. A 90-minute build is
fine; a silent 90-minute build is not.

## Contributing

The shell is MIT-licensed. PRs and forks are welcome and encouraged. A clean fork should build, install, and run the Blockstream demo end-to-end on its own — the only thing missing will be the curated Bitcoin knowledge bundle (which the included builder script can regenerate from public sources in 2 minutes with a token, or 2–3 hours without). The proprietary persona-tuned weights and `pipes.pink` adapters that production deployments use live in `data/pipes/`, `data/weights/`, and `data/seeds/`, all of which are gitignored — that's the part that's for hire.

## Credits

- Original Emerald prototype: built as a Blockstream interview portfolio piece
- Greater pivot: turning the prototype into a platform that scales to six industries
- Design system: colonhyphenbracket
- Live demo content: derived from public Blockstream help center material; not an official Blockstream product

## License

MIT — see `LICENSE`.
