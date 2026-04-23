# Greater — Technical Overview

A short, honest description of what Greater is, what it tries to
prove, and the problems it had to solve to get there. For the
"how do I run it" version, read [`README.md`](./README.md). For
the security and compliance posture, read
[`COMPLIANCE.md`](./COMPLIANCE.md), [`SECURITY.md`](./SECURITY.md),
and [`threat_model.md`](./threat_model.md).

---

## The thesis

**Support chatbots should not be a recurring tax.** Every commercial
"AI customer support" platform charges per message, mediates the
conversation through their cloud, and trains on whatever passes
through. Greater pushes hard against that default by running the
language model **inside the visitor's browser** on WebGPU, with a
hand-curated topic catalog as the actual knowledge layer. The
operator owns the corpus, the visitor's data never leaves the tab,
and the per-message marginal cost is zero.

There is a labelled, client-capped cloud fallback for browsers
without WebGPU — but the default flow is local, the badge on every
reply tells you which path served it, and the per-session cap
prevents runaway cloud spend.

---

## Architecture in one diagram

```
┌──────────────────────────────────────────────────────────────┐
│  Visitor's browser tab                                       │
│                                                              │
│  ┌──────────────┐    ┌────────────────────┐                  │
│  │  ChatWidget  │───▶│  Intent classifier │  (regex, <5ms)   │
│  └──────┬───────┘    └─────────┬──────────┘                  │
│         │                      │  conversational             │
│         │                      ▼                             │
│         │              ┌────────────────┐                    │
│         │              │ Templated reply│ (no model needed)  │
│         │              └────────────────┘                    │
│         │ content                                            │
│         ▼                                                    │
│  ┌───────────────────┐    ┌──────────────────────────────┐   │
│  │ Catalog navigator │───▶│ Pipe / persona system prompt │   │
│  │   (anti-drift)    │    └──────────────┬───────────────┘   │
│  └────────┬──────────┘                   │                   │
│           │ confidence + chunks          │                   │
│           ▼                              ▼                   │
│   ┌──────────────────────────────────────────────┐           │
│   │  Worker: SmolLM2-135M (default, ~90 MB)      │           │
│   │          SmolLM2-360M (opt-in, ~250 MB)      │           │
│   │          bge-small-en-v1.5 embedder (~30 MB) │           │
│   └──────────────────────────────────────────────┘           │
│           │                                                  │
│           ▼                                                  │
│   ChatMessage + chips + trust ribbon + source badge          │
└──────────────────────────────────────────────────────────────┘
```

Nothing on this diagram talks to a Greater-owned server during a
normal conversation. The marketing site loads Google webfonts and
the optional cloud fallback exists; both are explicit, both are
labelled.

---

## What we actually built

### 1. Browser-local inference, sized for mobile data

Earlier prototypes shipped Llama-3.2-1B (~830 MB) as the default
download. In real sessions on real connections that download
rarely completed before the visitor gave up, so the bot felt
permanently "loading." The current default is **SmolLM2-135M-Instruct
at q4** — about 90 MB — which finishes in seconds on a moderate
connection and runs on WebGPU.

For visitors who want sharper synthesis, the model info popover
exposes a one-click upgrade to **SmolLM2-360M** (~250 MB). The
button shows the size up front and adds a louder warning when the
viewport reads as a phone, because asking someone on a cellular
plan to silently pull a quarter-gigabyte is rude.

The swap is **transactional**: the worker builds the new pipeline
into a temp variable, only commits `llm` after success, and the
provider only updates `activeLlmModelId` after the worker confirms
ready. A failed deep-model download leaves the small model serving
inference and the upgrade button visible for retry — never strands
the bot in a no-model state.

### 2. Catalog-as-curator, model-as-glue

The model is not the knowledge. The knowledge is a hand-curated
**catalog of topic branches** with structural citations. Every
substantive answer rides on a leaf brief from the catalog; the
local LLM's job is to write it in a natural voice. This is what
makes a 90 MB model coherent enough to be useful — it never has to
remember Bitcoin trivia, only how to phrase it.

The navigator scores the visitor's question against branches and
returns either:

- a high-confidence leaf (model polishes the brief), or
- a low-confidence clarify (rendered as **clickable chips** below
  the bubble — one tap goes deeper, no menu typing).

An anti-drift gate checks every answer against the source brief
before render. Mismatches downgrade to a refusal with three escape
hatches: browse the curated bank, email a human, rephrase.

### 3. Intent classifier in front of the catalog walk

Greetings, thanks, smalltalk, closings, "are you a bot?", and
"what can you do?" are not bitcoin questions. The catalog walk
used to chew on them anyway, and a single-token collision was
enough to land "thanks" on a real UTXO leaf. The visitor would
get a wall of text in response to "hi."

A regex/keyword classifier now runs **before** the catalog walk in
~5 ms with no model dependency. Non-content turns ship a templated
reply from a variation pool (so the bot doesn't sound like a
switch statement), and capability probes surface the persona's
suggested-prompt list as chips. Content turns fall through to the
catalog as before.

### 4. Chips, optimistic state, and the conversation contract

Every clarify answer renders as **chips** instead of `1. **Branch** — …`
markdown. Tapping a chip routes through `handleSend` so the
transcript, telemetry, and history stay coherent. The typing pulse
carries a "Checking my notes…" caption so the visitor knows the
bot is doing retrieval, not stalling.

History is bounded at 10 user-bot pairs, sent to the synthesizer
on every turn so follow-up questions ("elaborate", "why?") have
context to score against.

### 5. Honest provenance on every reply

Every bot bubble carries a **source badge** (qa-cache · local ·
openclaw · cloud), a **trust score**, and an expandable **thought
trace** showing the actual chunks that were retrieved. Cloud
fallback is rate-limited per session and labelled with the reason
("loading", "unsupported", "local-error"). When the per-session
cloud cap is hit, the badge reads "Local-only · cloud
rate-limited" instead of pretending nothing happened. Refusals
say *why* they refused.

### 6. Bias as a first-class control

For topics where neutrality is a polite fiction (Bitcoin, in
particular: Core vs Knots, hard-money vs investment-vehicle,
self-custody vs convenience), the widget exposes a **bias strip**.
Switching it changes both the retrieval filter (which catalog
slices are eligible) and the system prompt (how the model frames
the answer). The current bias is shown next to the source badge,
so visitors can see *why* an answer leans the way it does.

### 7. BYO local LLM (OpenClaw)

Visitors who run a local OpenAI-compatible endpoint (Ollama,
llama.cpp server, LM Studio, etc.) can point the widget at it
through a settings panel. When OpenClaw is active, every
substantive turn routes through the visitor's own compute and the
cloud fallback is bypassed entirely.

---

## Hard problems we ran into

- **Mobile-data responsibility.** A 1 GB model download is a
  mobile-data event. The fix wasn't a compression flag, it was
  picking a smaller model class entirely (SmolLM2 family) and
  exposing the upgrade as an *opt-in*.

- **Identity leakage.** Earlier builds let the underlying
  Llama / SmolLM identify itself when asked "what model are you?".
  The persona system prompt now intercepts meta-bot intents and
  the intent classifier handles the question without a model call.

- **Ranker collisions on conversational turns.** "thanks" beats
  most catalog branches on cosine similarity by accident. The
  intent classifier removes the entire class of these failures
  by short-circuiting before the walk.

- **Clarify menus that read like FAQs.** Numbered markdown
  ("1. **Lightning** — …") trained visitors to type "1" — and
  then a stale menu from three turns ago could hijack a real "1
  satoshi" question. Chips killed both problems: the picker is
  visual, and the chip's label gets sent verbatim.

- **Transactional upgrade.** The first cut of "load deeper model"
  flipped UI state before the worker confirmed success. A failed
  download stranded the bot. The current contract: commit only on
  the worker's `ready` event, restore `ready` status on swap
  failure, keep the upgrade button visible.

- **Embedder version skew.** Transformers.js v4 needs an ONNX
  build with the `data location` metadata field. The Xenova upload
  of bge-small-en-v1.5 didn't have it; the onnx-community port
  does. Same model, same dimensions, just a different upload.

---

## What's next

- **Streamed token rendering.** The 360M deep model is fast enough
  on mid-tier WebGPU to make streaming visibly better. Worker
  protocol already carries the hooks; the renderer doesn't yet
  consume them.

- **Catalog editor in-browser.** The catalog is currently a
  source-tree artifact. The natural next step is a static-page
  editor that lets a non-developer fork, edit, and republish their
  branches without ever touching the terminal.

- **Per-persona deep-model defaults.** Some industries (legal,
  medical) genuinely benefit from the 360M model out of the gate
  on desktop traffic. The persona manifest will grow a
  `defaultModel` field so the operator picks.

- **Sync-fork GitHub Action.** A scheduled action that auto-syncs
  a fork against upstream so non-developers running the static
  install never have to click a button. Tracked in
  [issues](https://github.com/rorshockbtc/greater-than/issues).

---

## Where the code lives

| Concern | Path |
|---|---|
| Chat widget | `artifacts/greater/src/components/ChatWidget.tsx` |
| Bubble + chips render | `artifacts/greater/src/components/ChatMessage.tsx`, `ChatChips.tsx` |
| LLM provider + worker | `artifacts/greater/src/llm/LLMProvider.tsx`, `llmWorker.ts` |
| Model config | `artifacts/greater/src/llm/config.ts` |
| Intent classifier | `artifacts/greater/src/llm/intentClassifier.ts` |
| Catalog navigator + anti-drift | `artifacts/greater/src/llm/catalog/` |
| Pipe registry | `artifacts/greater/src/pipes/` |

The shell is MIT. The persona Pipes wrapping proprietary corpora
are not part of the FOSS shell; they live with the operator who
curates them. That's the line.
