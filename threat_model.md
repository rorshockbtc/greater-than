# Threat Model

## Project Overview

Greater is a FOSS lead-generation chat widget. The headline product
is a sovereign-by-default support bot: the LLM (Llama-3.2-1B) and the
embedder (bge-small-en-v1.5) run in the visitor's browser via WebGPU,
backed by an IndexedDB vector store. The Bitcoin pack additionally
runs a deterministic catalog-first navigator with no embedding pass.

Tech stack:

- **Frontend**: React 19 + Vite + Tailwind 4 + shadcn/ui
  (`artifacts/greater`).
- **Backend**: Node + Express 5 + Drizzle ORM + PostgreSQL
  (`artifacts/api-server`). Hosts ingestion, escalation/feedback,
  cloud-LLM fallback proxy.
- **Build scripts**: tsx + @xenova/transformers + jsdom +
  Mozilla Readability for the Bitcoin seed builder
  (`scripts/src`).
- **External services**: Together.AI (cloud-LLM fallback), Web3Forms
  (contact form), Neon/Supabase Postgres, GitHub (source hosting +
  CI). Hugging Face is the runtime CDN for model weights.

Users:

- **Visitors** to operator sites that have embedded the Greater
  shell. Unauthenticated, untrusted.
- **Operators** — small businesses, niche-domain founders, and
  Bitcoiners who self-host the shell with their own corpus.
- **The studio** (rorshockbtc / ColonHyphenBracket) — operator of
  `hire.colonhyphenbracket.pink`, sole consumer of the
  admin-feedback endpoint.

There are no end-user accounts. There is no per-visitor login. The
shell is intentionally anonymous by default.

## Assets

- **Visitor message content** — questions visitors type into the
  chat widget. On the default flow this never leaves the device. On
  the cloud-fallback path (capped at 3 calls per session) it is sent
  to Together.AI. Compromise risk: leakage to a third party violates
  the project's headline "no vendor between you and your customers"
  promise.
- **Operator API secrets** — `TOGETHER_API_KEY`,
  `ADMIN_FEEDBACK_KEY`, `DATABASE_URL`. Compromise of
  `TOGETHER_API_KEY` allows arbitrary cloud-LLM charges.
  Compromise of `ADMIN_FEEDBACK_KEY` allows reading all submitted
  feedback. Compromise of `DATABASE_URL` allows reading and writing
  all persisted data.
- **Curated catalog content** — `artifacts/greater/public/catalog/`
  and the gitignored `data/pipes/`. The shipped Bitcoin catalog is
  public; proprietary Pipes are the studio's commercial asset.
- **Persisted data** — articles, feedback submissions, ingestion
  audit rows in PostgreSQL. Contains operator-side text and
  ingestion-target URLs. Does not contain visitor PII unless the
  operator wires it in.
- **Project brand and trademark** — see `TRADEMARK.md`. A
  rebrand-and-redistribute attack on the marks dilutes the project's
  marketability.

## Trust Boundaries

- **Visitor browser ↔ operator origin** — the chat widget runs in
  the visitor's tab. Anything the visitor types is the visitor's; the
  shell must not exfiltrate it on the default flow.
- **Visitor browser ↔ api-server** — the only routes that cross this
  boundary are: ingestion (`POST /api/ingest`, `POST /api/ingest/sitemap`,
  `POST /api/ingest/rss`), cloud-LLM fallback (`POST /api/chat`),
  ticket escalation (`POST /api/escalate`), and feedback submission
  (`POST /api/feedback`, `POST /api/suggestion`). The api-server is
  untrusted from the browser's perspective and the browser is
  untrusted from the api-server's perspective. Every browser-reachable
  route is rate-limited via `express-rate-limit`:
  - `/api/ingest*` — 30 req/min/IP burst + 500 pages/day/IP quota.
  - `/api/chat` — 20 req/min/IP (server-side backstop on top of the
    client-side per-session `CLOUD_CALL_BUDGET`).
  - `/api/escalate` — 6 req/min/IP.
  - `/api/feedback`, `/api/suggestion` — 12 req/min/IP each.
- **api-server ↔ PostgreSQL** — direct credentialed access via
  Drizzle ORM. SQL injection at this boundary would expose all
  persisted data.
- **api-server ↔ Together.AI** — outbound HTTPS with a shared
  secret. Cloud-fallback message content crosses this boundary.
- **api-server ↔ arbitrary public web (ingestion)** — the highest-
  risk outbound boundary. The `/ingest` endpoint fetches operator-
  supplied URLs server-side. SSRF is the headline risk; mitigations
  documented below.
- **Operator admin ↔ api-server** — the admin-feedback endpoint
  uses a shared `ADMIN_FEEDBACK_KEY` header. Single-operator scope
  by design; not suitable for multi-tenant administration.
- **Public repo ↔ proprietary corpora** — `data/pipes/` and
  `data/seeds/` are gitignored. A misconfigured `.gitignore` or an
  accidental `git add -f` would leak the studio's commercial work.

## Scan Anchors

- **Production web entry points**:
  - `artifacts/greater/src/App.tsx` — marketing site + chat widget.
  - `artifacts/api-server/src/app.ts` — Express bootstrap. Routes
    in `artifacts/api-server/src/routes/` (`articles.ts`, `chat.ts`,
    `feedback.ts`, `health.ts`, `ingest.ts`).
- **Highest-risk code areas**:
  - `artifacts/api-server/src/routes/ingest.ts` — SSRF guard,
    redirect-revalidation, daily-quota limiter, sitemap walker.
    Any change here is a security review.
  - `artifacts/api-server/src/lib/llm.ts` — Together.AI client;
    only place `TOGETHER_API_KEY` is read.
  - `artifacts/api-server/src/routes/feedback.ts` — admin-key check.
  - `artifacts/greater/src/llm/catalog/antiDrift.ts` — refusal gate
    that runs before the LLM. Bypasses here let off-topic content
    reach the model.
- **Public surfaces**: marketing pages, demo widgets, `/ingest`
  POST. Authenticated surfaces: `/admin/feedback` (shared key).
- **Dev-only / not production**: `artifacts/mockup-sandbox` —
  component preview server, not deployed.

## Threat Categories

### Spoofing

There are no per-visitor accounts. The two spoofing surfaces are:

- **Admin feedback endpoint** uses a shared secret
  (`ADMIN_FEEDBACK_KEY`) sent in the `x-admin-key` header.
  `adminGuard()` in `feedback.ts` length-equalises and
  constant-time compares with `crypto.timingSafeEqual`; failures
  return 404 so the route does not advertise itself. Query-string
  fallback (`?key=`) was removed because query strings leak through
  access logs, browser history, and Referer headers. The shared
  key MUST be kept server-side and out of any client bundle.
- **Cloud-fallback proxy (`/api/chat`)** is reachable by any
  browser. Two layers protect Together.AI quota:
  1. **Client-side**: per-session `CLOUD_CALL_BUDGET`
     (`VITE_CLOUD_CALL_BUDGET`, default 3, settable to 0 to opt
     out of the path entirely). UX/cost control.
  2. **Server-side**: `chatLimiter` (20 req/min/IP) in
     `routes/chat.ts`. This is the actual security control; it
     applies regardless of what the client claims its budget is,
     so a forked widget that strips the cap still cannot run away
     with operator quota.

### Tampering

- **Ingestion input** — operator-supplied URLs are validated via
  the SSRF guard *before* fetch (see Information Disclosure +
  Elevation of Privilege). All redirects are re-validated. Sitemap
  entries are re-validated.
- **Catalog data** — shipped under `public/catalog/`. The browser
  trusts the catalog file as authoritative; an attacker who can
  modify the deployed `dist/` directory can change refusal copy or
  citations. Mitigation is operational (deploy-pipeline integrity)
  not architectural.
- **Database writes** — all queries use Drizzle ORM with
  parameterised statements. The advisory tracked at
  `GHSA-gpj5-g38j-94v9` (drizzle-orm SQL injection via improperly
  escaped identifiers) is patched in `>=0.45.2`; the project pins
  `^0.45.2` via the workspace catalog.

### Repudiation

- The api-server logs every ingestion request (URL + IP + outcome)
  to the structured request log; logs are not user-modifiable.
- Feedback submissions are persisted with a server-generated
  `created_at` timestamp.
- Cloud-fallback calls are counted per session and logged with the
  session id; the operator can audit Together.AI billing against the
  log if needed.

### Information Disclosure

- **Visitor message content on the default flow** — never leaves the
  browser. Inference and embedding both run in a Web Worker on
  WebGPU.
- **Visitor message content on the cloud-fallback path** — sent to
  Together.AI under TLS. The widget badges every cloud reply
  "Cloud" so the visitor knows the boundary was crossed.
- **Server secrets** (`TOGETHER_API_KEY`, `DATABASE_URL`,
  `ADMIN_FEEDBACK_KEY`) MUST be loaded from environment only.
  `process.env.*` reads are concentrated in
  `artifacts/api-server/src/lib/` and the routes — there are no
  hardcoded fallbacks. `VITE_WEB3FORMS_ACCESS_KEY` is *intended*
  to be public (Web3Forms uses public access keys with origin
  allowlisting); this is documented in `SECURITY.md`.
- **Error responses** must not include database error text or
  stack traces. Production error handler returns generic 5xx
  payloads.
- **PostgreSQL** — the admin-feedback page returns only the operator's
  own feedback rows; the query is unconditionally scoped (single-
  operator design). If multi-tenancy is added, this query MUST gain
  a tenant-id predicate enforced server-side.

### Denial of Service

- **Public ingestion endpoint** — wrapped in two limiters
  (`ingestLimiter` for burst, `dailyQuotaLimiter` capped at 500
  pages/day/IP). Body size is bounded by Express's default JSON
  parser limit; URL lists are bounded in code.
- **Cloud-fallback** — capped at 3 calls per session and rate-limited
  per IP at the api-server.
- **Catalog navigator** — pure-function BM25 over a small in-memory
  edge set. Bounded compute per request.
- **Browser-local LLM** — runs on the visitor's GPU; no server
  resource is consumed by inference.
- **path-to-regexp ReDoS** advisories
  (`GHSA-j3q9-mxjg-w52f`, `GHSA-27v5-c462-wpq7`) are mitigated by
  pinning `path-to-regexp` to `>=8.4.0` via workspace overrides.

### Elevation of Privilege

- **SSRF on `/api/ingest*`** is the headline elevation risk.
  `artifacts/api-server/src/routes/ingest.ts` enforces:
  - DNS-resolved IP must not be loopback (127/8, ::1), link-local
    (169.254/16, fe80::/10, including the AWS metadata endpoint),
    private RFC1918 (10/8, 172.16/12, 192.168/16), unique-local
    IPv6 (fc00::/7), 0.0.0.0, broadcast, multicast, or reserved.
  - Redirects are re-resolved and re-validated through the same
    guard before being followed.
  - Child sitemap URLs (sitemap-of-sitemaps entries) are
    re-validated before fetching.
  - The `/api/ingest/extract` endpoint re-validates its input URL
    on every call.
  - Caveat: the `/api/ingest/sitemap` response returns the list of
    discovered page URLs **without** running each one through the
    SSRF guard first (the cost would be a DNS lookup per URL on a
    sitemap of up to 5 000 URLs). This is bounded because the only
    supported way for the client to fetch a returned URL is via
    `/api/ingest/extract`, which re-validates. Direct callers MUST
    NOT trust the URL list as already-vetted.
  - Caveat: a determined attacker can arrange a DNS rebinding
    TOCTOU between the guard's `dns.lookup()` precheck and the
    eventual `fetch()`. This is documented under deferred risks.
- **Authorization** — the admin-feedback endpoint is the only role-
  gated surface. The check runs server-side against
  `ADMIN_FEEDBACK_KEY` on every request.
- **SQL injection** — covered above; Drizzle pinned to a patched
  version, no string-concatenation queries in the codebase.
- **Insecure deserialization** — the catalog and seed JSON are
  fetched from same-origin static assets and parsed with native
  `JSON.parse`. No `eval`, no dynamic `require` of user-supplied
  paths.
- **Path traversal** — there are no file-serving routes that take a
  user-supplied path; all served files are static-built artefacts
  under `dist/`.
- **Arbitrary code execution via dependency**
  (`GHSA-xq3m-2v4x-88gg`, protobufjs `<7.5.5` reachable via
  `@xenova/transformers` in build scripts) is mitigated by pinning
  `protobufjs` to `>=7.5.5` via workspace overrides. The
  vulnerable code path is build-time only (not deployed to
  production), but the override eliminates it entirely.

## Deferred / accepted risks

These are documented so they are not re-discovered as surprises:

- **`VITE_WEB3FORMS_ACCESS_KEY` in the client bundle** — accepted.
  Web3Forms is designed for public access keys with origin
  allowlisting. Operators who need stronger guarantees should
  proxy the contact form through their own backend.
- **Cloud-fallback path can leak message content to Together.AI** —
  accepted, badged in UI, capped per session. Operators who cannot
  accept this should set `VITE_CLOUD_CALL_BUDGET=0` (and rely on
  the api-server's `/api/chat` limiter as the backstop).
- **Sitemap response is not pre-filtered through SSRF guard** —
  accepted as a cost trade-off (DNS lookup per URL on lists of up
  to 5 000 URLs). Mitigated end-to-end by `/api/ingest/extract`
  revalidation; documented under Elevation of Privilege.
- **DNS rebinding TOCTOU on the SSRF guard** — accepted as a
  residual risk. The current architecture validates the resolved
  IP and then fetches by hostname; an adversary controlling the
  authoritative DNS server can return a public A record to the
  guard and a private one to `fetch()`. A full mitigation requires
  resolving once and connecting to the resolved IP with the
  hostname pinned in the SNI/Host header — feasible but not yet
  implemented. The realistic exploitation surface is operator-
  initiated ingestion of attacker-supplied URLs, which is already
  daily-quota'd per IP.
- **Marketing site loads Google Webfonts** — accepted, documented
  in `COMPLIANCE.md`. Operators who need offline-only fonts should
  self-host a font subset.
- **Single-operator admin authentication** — accepted, documented
  in `SECURITY.md`. Multi-tenant administration is out of scope.
