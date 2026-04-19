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
| Browser-local LLM (WebGPU + Transformers.js) | 🚧 In progress |
| Generic web-scraping ingestion | 🚧 Planned |
| Bitcoin knowledge ingestion (Core/Knots/OpTech/BitcoinTalk) with bias toggle | 🚧 Planned |
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
- PostgreSQL (Replit provides via `DATABASE_URL`)
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

## Contributing

The shell is MIT-licensed. PRs and forks are welcome and encouraged. The proprietary persona-tuned weights, pipes data, and curator-specific corpora that make production deployments work live in `data/pipes/` and `data/weights/`, both of which are gitignored — that is the part that's for hire.

## Credits

- Original Emerald prototype: built as a Blockstream interview portfolio piece
- Greater pivot: turning the prototype into a platform that scales to six industries
- Design system: colonhyphenbracket
- Live demo content: derived from public Blockstream help center material; not an official Blockstream product

## License

MIT — see `LICENSE`.
