# Security Policy

Greater is a sovereign-by-default chat-widget shell. We take security seriously, especially because the project is positioned as a privacy-preserving alternative to vendor chatbots — a credible vulnerability would undermine the entire thesis.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.**

Use one of these private channels:

1. **Preferred — GitHub private security advisory.** Open one at
   https://github.com/rorshockbtc/greater-than/security/advisories/new
2. **Alternative — encrypted email.** `security@colonhyphenbracket.pink`
   (PGP key fingerprint published on https://colonhyphenbracket.pink).

Include:

- A clear description of the issue and its impact.
- Steps to reproduce, or a proof-of-concept.
- Affected commit SHA (or release tag) if known.
- Whether the issue is exploitable on the live site
  (`hire.colonhyphenbracket.pink`) or only against a local checkout.

## Response targets

- **Acknowledgement**: within 72 hours.
- **Initial assessment**: within 7 days.
- **Fix or mitigation**: within 30 days for high/critical, 90 days for
  moderate/low.
- **Coordinated disclosure**: we will work with you on a disclosure
  timeline. Default is 90 days from initial report or 7 days after a
  fix ships, whichever is sooner.

We do not currently run a paid bug-bounty programme. We will credit
reporters in `NOTICE` and the release notes unless you ask us not to.

## Scope

**In scope** (this repository):

- The Greater shell (`artifacts/greater`) — chat widget, navigator,
  catalog retrieval, anti-drift gate.
- The API server (`artifacts/api-server`) — ingestion, escalation,
  feedback, cloud-fallback proxy.
- Build scripts (`scripts/src`) — seed builders, smoke harnesses.
- The catalog data shipped under
  `artifacts/greater/public/catalog/bitcoin/`.

**Out of scope**:

- Proprietary Pipes and curated corpora that live under
  `data/pipes/` or `data/seeds/` (gitignored, not in this repo).
  Report Pipe-specific issues to `security@colonhyphenbracket.pink`
  directly.
- Issues in upstream dependencies that are not exploitable through
  Greater's surface. We do track and bump CVEs (see "Dependency
  hygiene" below) but please report upstream first.
- Browser-local model behaviour (hallucinations, jailbreaks against
  the LLM itself). The model is open-weight Llama-3.2-1B-Instruct;
  jailbreak research belongs upstream. Anti-drift refusal failures
  *are* in scope when they let off-topic content reach the LLM.
- Issues in third-party services (Together.AI, Web3Forms, Neon).

## Known security-relevant design decisions

These are deliberate. They are not vulnerabilities; they are
documented in `COMPLIANCE.md` and `threat_model.md`:

- The default flow runs inference in the visitor's browser — message
  content does not leave the device.
- The cloud-fallback path at `POST /api/chat` (3-call cap per
  session by default, badged "Cloud") *does* send message content
  to Together.AI when WebGPU is unavailable. Operators who cannot
  accept this should set `VITE_CLOUD_CALL_BUDGET=0` in their
  `.env`. The api-server additionally rate-limits the route at 20
  req/min/IP server-side as a backstop against any caller that
  bypasses the client-side cap.
- `VITE_WEB3FORMS_ACCESS_KEY` is publicly visible in the bundle by
  design — Web3Forms uses public access keys with origin allowlisting.
- The admin-feedback endpoint uses a shared secret
  (`ADMIN_FEEDBACK_KEY`) sent as the `x-admin-key` header,
  compared in constant-time. It is intended for single-operator
  use, not multi-tenant administration.

## Dependency hygiene

`pnpm audit --prod` runs as part of pre-release review. Direct
dependencies are bumped on the next release after a CVE is published;
transitive vulnerabilities are pinned via `pnpm-workspace.yaml`
`overrides` when the upstream is slow to update.

## Reference

- `threat_model.md` — STRIDE walkthrough specific to Greater.
- `COMPLIANCE.md` — control table mapping each compliance promise to
  the file that enforces it.
- `NOTICE` — third-party attributions.
