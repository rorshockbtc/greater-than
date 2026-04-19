# Compliance posture

> Greater is a free, open-source shell. Greater the project is not a
> certified product — it does not hold HIPAA, SOC 2, PCI, or any other
> third-party audit attestation, and it never will, because compliance
> attestations describe an *organization's controls*, not a piece of
> open-source software. What follows is what the shell does today,
> what it does not claim, and what a deploying organization has to add
> to credibly meet each standard.

The credibility of this document depends on it being matter-of-fact.
If you find an over-claim, please open an issue at
[github.com/rorshockbtc/greater-than/issues](https://github.com/rorshockbtc/greater-than/issues)
— accuracy regressions are the kind I want to fix quickly.

## What the FOSS shell does by default

- **Browser-local inference.** Llama-3.2-1B-Instruct (q4f16) and
  bge-small-en-v1.5 run in a Web Worker on WebGPU. No user message is
  transmitted to a server when the local model is ready and answering.
- **IndexedDB vector store.** The knowledge corpus and any in-product
  ingested pages are persisted in the visitor's browser. The shell
  does not transmit them anywhere.
- **No first-party analytics by default.** The shell sets no
  first-party cookies, ships no first-party analytics, and does not
  register a service worker that phones home. *Caveat:* the
  marketing-site `index.html` loads webfonts from `fonts.googleapis.com`,
  which is a Google-served network request the visitor's browser will
  make on first paint. If your deployment requires zero third-party
  egress on first paint, self-host the fonts.
- **Cited answers.** Every retrieved chunk fed to the model is
  inspectable to the visitor via the "Thought trace" disclosure on
  every reply.
- **Cloud fallback exists, is capped, is labelled.** If WebGPU isn't
  available or the local model isn't ready, the widget can call a
  server endpoint (Together.AI in the reference deployment) for the
  first three turns of the session. Every cloud reply ships with a
  visible "Cloud" badge. The cap is enforced client-side; once it's
  hit, the badge changes to "Local-only · cloud rate-limited" so the
  provenance stays honest.

If your deployment cannot tolerate any cloud egress, set
`CLOUD_CALL_BUDGET = 0` in
`artifacts/emerald/src/llm/LLMProvider.tsx`. The widget will surface a
"WebGPU unsupported — please use a Chromium-based browser" message
instead of falling back.

---

## HIPAA

**What the shell does today.** Runs locally in the visitor's browser.
Does not transmit PHI in the default flow. Does not log conversations
server-side in the default flow.

**What the shell does not claim.** Greater the project is not a
Business Associate, has no BAA to sign, and holds no HIPAA
attestation.

**What a HIPAA-grade deployment must add.**

- BAA-covered hosting and a BAA with any third-party model provider
  used in the cloud-fallback path.
- Encryption at rest for any server-side transcript log you choose to
  keep.
- Server-side audit logging of access to transcripts and PHI.
- Access controls (RBAC, MFA, session timeout) on any operator
  surfaces.
- An incident-response process and a breach-notification workflow.
- A Notice of Privacy Practices presented to users.
- Treat the bot as an aid that routes to humans, not a clinical
  decision-maker. The healthtech demo's first-message disclaimer says
  this explicitly.

The healthtech demo opens with a persona-tuned compliance banner that
asks the visitor not to share PHI in a public demo and links to
`/compliance#healthtech`.

---

## ADA / WCAG 2.2 AA

**Marketing site target.** WCAG 2.2 AA.

- **Contrast.** Body text uses near-black on white (≈ 16:1, meets
  AAA). The pink brand accent (`#FE299E`) is used as a *background*
  for primary CTA buttons; white-on-`#FE299E` measures ≈ 3.5:1, which
  meets the WCAG 2.2 ≥ 3:1 threshold for non-text UI components and
  large text but does **not** meet the 4.5:1 normal-text threshold.
  CTA labels are rendered at 14 px / `font-medium`; if your
  deployment needs strict AA-normal compliance on CTA copy, swap the
  primary background to a darker pink (`#C8197D` measures ≈ 4.6:1
  with white) by overriding `--primary` in `index.css`.
- **Focus.** Every interactive element shows a 2-pixel pink focus
  ring with a visible offset (`index.css`).
- **Skip link.** The first focusable element on every page is "Skip
  to content" (`Layout.tsx`).
- **Motion.** `@media (prefers-reduced-motion: reduce)` neutralizes
  CSS transitions and animation timings. Framer Motion already
  honors the OS preference for its motion components.
- **Landmarks.** `<header>`, `<nav>`, `<main>`, `<footer>` on every
  page; mobile bottom nav uses `<nav aria-label="Mobile
  navigation">`.
- **Streaming chat.** The transcript is wrapped in
  `role="log" aria-live="polite"` so screen readers announce new
  bot turns without interrupting the user.
- **Disclaimer banner.** Rendered as `role="status"` so it's
  announced when the chat opens.
- **Citations.** Real `<a>` elements with visible link styling.
- **Thought trace.** Keyboard-operable disclosure widget.

If you find a violation, please
[open an issue](https://github.com/rorshockbtc/greater-than/issues).

---

## GDPR

**What the shell does.** Stores nothing identifying about the
visitor. The IndexedDB vector store holds the knowledge corpus, not
the user. Transcripts are kept only in `sessionStorage` for the
support-ticket preview screen and are cleared when the tab closes.
No cookies set by Greater. No analytics by default.

**What a deployment needs to add.**

- A privacy notice that covers the cloud fallback path.
- Data-subject rights handling (access, erasure, portability) for any
  server-side transcript log you choose to keep.
- A Record of Processing Activities (Article 30).
- Lawful basis for any analytics you bolt on.
- Data Processing Agreements with any sub-processors (e.g. the cloud
  fallback model provider).
- A data-protection contact and, where required, a DPO.

---

## CCPA / CPRA

Same posture as GDPR: the shell does not "sell" or "share" personal
information because it does not collect it in the default flow. A
California consumer's right to know, right to delete, and right to
opt out are architecturally trivial when the data lives in the
consumer's own browser. A deployment that adds server-side
transcript logging owns the disclosures and the deletion workflow.

---

## PCI DSS

Greater does not collect, transmit, or store cardholder data. The
shell is out of PCI scope. The chat widget will not ask for card
numbers, CVV, expiry, or any element of cardholder data, and
operators should not configure prompts that do.

---

## SOC 2

Greater the project is not SOC 2 attested. SOC 2 is a statement
about an organization's controls, not a property of a software
shell — the deploying organization owns the attestation, end to
end.

The shell is *auditable* in the sense that it is open source: every
line of code that runs in the visitor's browser, every prompt sent
to the model, and every retrieved chunk shown to the user is
inspectable in the repo at
[github.com/rorshockbtc/greater-than](https://github.com/rorshockbtc/greater-than).

---

## Vertical-specific posture

### Healthtech

The healthtech demo opens with a disclaimer that says, in plain
language: this is a member-portal assistant, it is not a doctor, and
it will not give medical advice. The banner asks the visitor not to
share PHI in a public demo. The shell does not encrypt anything at
rest by default beyond what the browser provides for IndexedDB.
There is no audit log of conversations on the server in the default
flow — there is no server in the default flow. A deployer handling
PHI needs the deployment-side architecture described in the HIPAA
section above.

### Fintech

The fintech demo opens with a disclaimer that says: not financial,
tax, or legal advice; the bot will never ask for keys, seed
phrases, or account credentials, and anyone who does is phishing
you. The shell will not handle PAN data and is not in PCI scope.
For a regulated production deployment the operator owns: KYC/AML
integration, jurisdiction-specific record retention, consumer-
protection disclaimers required in their market, and audit logging
of any escalation that touches a customer account.

### Other personas

Startups, faith, schools, and small-business demos open with a
lighter, persona-appropriate disclaimer (see
`artifacts/emerald/src/data/disclaimers.ts`). Each links back to
this document via `/compliance`.

---

## Reporting concerns

Open an issue at
[github.com/rorshockbtc/greater-than/issues](https://github.com/rorshockbtc/greater-than/issues),
or contact the author via the form at
[hire.colonhyphenbracket.pink](https://hire.colonhyphenbracket.pink).
