import React from "react";
import { Link } from "wouter";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/**
 * /compliance — plain-English compliance posture for a procurement
 * reviewer. Same content as `COMPLIANCE.md`, lighter tone, designed
 * to be skimmable in two minutes. Anchors are stable so disclaimer
 * banners can deep-link.
 *
 * Honesty rule: the FOSS shell is a *shell*. Greater itself is not
 * SOC 2 / HIPAA / PCI certified — the deploying organization owns
 * certification. This page is matter-of-fact about that, which is
 * the only credible way to write it.
 */
export default function Compliance() {
  useDocumentTitle("Compliance");

  return (
    <article className="pb-20">
      <div className="border-b border-border bg-secondary/40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10">
          <Link
            href="/"
            className="chb-mono-label text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
            data-testid="link-back-home"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Home
          </Link>
          <p className="chb-mono-eyebrow text-muted-foreground mt-6 mb-2">
            Compliance
          </p>
          <h1 className="chb-serif-headline text-3xl sm:text-5xl leading-[1.05] max-w-2xl">
            Compliance posture, written down.
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mt-5 max-w-2xl leading-relaxed">
            Greater is a FOSS shell. The shell itself is not a certified
            product — Greater the project doesn't hold HIPAA, SOC 2, PCI,
            or any other audit attestation. What follows is what the
            shell does today, what it does not claim, and what a
            production deployment has to add to credibly meet each
            standard.
          </p>
          <p className="text-sm text-muted-foreground mt-4 italic">
            For the engineering-grade version of this document, see{" "}
            <a
              href="https://github.com/rorshockbtc/greater-than/blob/main/COMPLIANCE.md"
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2"
            >
              COMPLIANCE.md
            </a>{" "}
            in the repo.
          </p>
        </div>
      </div>

      <nav
        aria-label="Compliance sections"
        className="border-b border-border bg-background sticky top-14 z-10 backdrop-blur"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
          {[
            ["general", "Defaults"],
            ["healthtech", "Healthtech"],
            ["fintech", "Fintech"],
            ["hipaa", "HIPAA"],
            ["wcag", "WCAG 2.2 AA"],
            ["gdpr", "GDPR"],
            ["ccpa", "CCPA"],
            ["pci", "PCI DSS"],
            ["soc2", "SOC 2"],
          ].map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="chb-mono-label text-muted-foreground hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 space-y-12">
        <Section
          id="general"
          title="What the FOSS shell does by default"
        >
          <p>
            Greater's default flow is browser-local. The model
            (Llama-3.2-1B-Instruct, q4f16) and the embeddings model
            (bge-small-en-v1.5) run in a Web Worker on WebGPU. The
            vector store is IndexedDB on the visitor's device. No user
            message is transmitted to a server when the local model is
            ready and answering.
          </p>
          <p>
            There are two caveats. First: the marketing-site{" "}
            <code>index.html</code> loads webfonts from{" "}
            <code>fonts.googleapis.com</code>, which is a network
            request your visitor's browser will make on first paint.
            If you need zero third-party egress, self-host the fonts.
            Second: the cloud fallback. If WebGPU isn't
            available, or the local model is still downloading, the
            widget can call out to a server-side LLM (Together.AI in the
            reference deployment) for the first three turns of the
            session. Every cloud reply ships with a "Cloud" badge — the
            provenance is visible to the visitor at all times, and the
            cap is enforced client-side. Message content stays
            in-browser by default; the cloud-fallback path is the
            only exception, and it labels itself.
          </p>
          <p className="callout">
            <strong>What this means for a deployer.</strong> If your
            deployment cannot tolerate any cloud egress, set{" "}
            <code>VITE_CLOUD_CALL_BUDGET=0</code> in your <code>.env</code>{" "}
            (or edit the default in <code>LLMProvider.tsx</code>). The
            widget will surface a "WebGPU unsupported — please use a
            Chromium-based browser" message instead of falling back.
            The api-server also rate-limits the <code>/chat</code> route
            server-side as a backstop, so the cap holds even against
            a caller that has stripped the client-side budget.
          </p>
        </Section>

        <Section id="healthtech" title="Healthtech-specific posture">
          <p>
            The healthtech demo opens with a disclaimer banner that
            says, in plain language: this is a member-portal assistant,
            it is not a doctor, and it will not give medical advice. The
            banner asks the visitor not to share PHI in a public demo
            and links here.
          </p>
          <p>
            The FOSS shell does not encrypt anything at rest by default
            beyond what the browser provides for IndexedDB. There is no
            audit log of conversations on the server in the default
            flow — there is no server in the default flow. The shell is
            not a Business Associate and cannot be one; a deployer
            handling PHI needs a deployment-side architecture (BAA-
            covered hosting, server-side audit logging, encryption at
            rest, an actual provider in the loop for clinical
            questions). The chatbot is a navigation aid, not a clinical
            tool.
          </p>
        </Section>

        <Section id="fintech" title="Fintech-specific posture">
          <p>
            The fintech demo opens with a disclaimer that says: not
            financial, tax, or legal advice; the bot will never ask for
            keys, seed phrases, or account credentials, and anyone who
            does is phishing you.
          </p>
          <p>
            The shell will not handle PAN data, will not ask for
            cardholder data, and is not in PCI scope. For a regulated
            fintech production deployment, the operator owns: KYC/AML
            integration, jurisdiction-specific record retention,
            consumer-protection disclaimers required in their market,
            and audit logging of any escalation that touches a customer
            account.
          </p>
        </Section>

        <Section id="hipaa" title="HIPAA">
          <p>
            <strong>What the shell does today:</strong> runs locally in
            the visitor's browser. Does not transmit PHI in the default
            flow. Does not log conversations server-side in the default
            flow.
          </p>
          <p>
            <strong>What the shell does not claim:</strong> Greater the
            project is not a Business Associate, has no BAA to sign, and
            holds no HIPAA attestation.
          </p>
          <p>
            <strong>What a HIPAA-grade deployment must add:</strong>{" "}
            BAA-covered hosting and any third-party model provider used
            in the cloud fallback path; encryption at rest; server-side
            audit logging; access controls; an incident-response
            process; a privacy notice; PHI minimization in retained
            transcripts. Treat the bot as an aid that routes to humans,
            not a clinical decision-maker.
          </p>
        </Section>

        <Section id="wcag" title="WCAG 2.2 AA">
          <p>
            <strong>Marketing site:</strong> targets WCAG 2.2 AA. Body
            text uses near-black on white (~16:1, AAA). The pink
            brand accent (<code>#FE299E</code>) is used as a CTA
            background; white-on-pink measures ~3.5:1, which meets
            the ≥3:1 threshold for non-text UI components and large
            text but not the 4.5:1 normal-text threshold. If your
            deployment needs strict AA-normal compliance on CTA copy,
            swap to a darker pink — see{" "}
            <a
              href="https://github.com/rorshockbtc/greater-than/blob/main/COMPLIANCE.md#adawcag-22-aa"
              target="_blank"
              rel="noreferrer noopener"
              className="underline"
            >
              COMPLIANCE.md
            </a>{" "}
            for the recipe.
          </p>
          <p>
            Every interactive element shows a focus ring. The
            skip-to-content link is the first focusable element on
            every marketing-site page (and on the persona demo
            shells). Motion respects <code>prefers-reduced-motion</code>.
            Streaming chat tokens are wrapped in an{" "}
            <code>aria-live="polite"</code> region so screen readers
            announce updates without interrupting the user.
          </p>
          <p>
            <strong>Chat widget:</strong> the disclaimer banner is
            announced as <code>role="status"</code>. Bot replies are
            keyboard-navigable. Citations are real anchors with visible
            link styling. The thought-trace disclosure is keyboard-
            operable.
          </p>
          <p>
            If you find a violation, please{" "}
            <a
              href="https://github.com/rorshockbtc/greater-than/issues"
              target="_blank"
              rel="noreferrer noopener"
              className="underline"
            >
              open an issue
            </a>{" "}
            — accessibility regressions are the kind I want to fix
            quickly.
          </p>
        </Section>

        <Section id="gdpr" title="GDPR">
          <p>
            <strong>What the shell does:</strong> stores nothing
            identifying about the visitor. The IndexedDB vector store
            holds the knowledge corpus, not the user. Transcripts are
            kept only in <code>sessionStorage</code> for the support-
            ticket preview screen and are cleared when the tab closes.
            No cookies set by Greater. No analytics by default.
          </p>
          <p>
            <strong>What a deployment needs to add:</strong> a privacy
            notice covering the cloud fallback path; data-subject
            rights handling for any server-side transcript log you
            choose to keep; a record of processing activities; lawful
            basis for any analytics you bolt on.
          </p>
        </Section>

        <Section id="ccpa" title="CCPA / CPRA">
          <p>
            Same posture as GDPR: the shell does not sell or share
            personal information because it does not collect it in the
            default flow. A California consumer's "right to know,"
            "right to delete," and "right to opt out" are
            architecturally trivial when the data lives in the
            consumer's own browser. A deployment that adds server-side
            transcript logging owns the disclosures and the deletion
            workflow.
          </p>
        </Section>

        <Section id="pci" title="PCI DSS">
          <p>
            Greater does not collect, transmit, or store cardholder
            data. The shell is out of PCI scope. The chat widget will
            not ask for card numbers, CVV, expiry, or any element of
            cardholder data, and operators should not configure prompts
            that do.
          </p>
        </Section>

        <Section id="soc2" title="SOC 2">
          <p>
            Greater the project is not SOC 2 attested. SOC 2 is a
            statement about an organization's controls, not a property
            of a software shell — the deploying organization owns the
            attestation, end to end. The shell is auditable in the
            sense that it is open source: every line of code that runs
            in the visitor's browser, every prompt sent to the model,
            and every retrieved chunk shown to the user is inspectable
            in the repo at{" "}
            <a
              href="https://github.com/rorshockbtc/greater-than"
              target="_blank"
              rel="noreferrer noopener"
              className="underline inline-flex items-center gap-1"
            >
              github.com/rorshockbtc/greater-than
              <ExternalLink className="w-3 h-3" />
            </a>
            .
          </p>
        </Section>
      </div>
    </article>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-32 border-t border-border pt-10 first:border-t-0 first:pt-0"
    >
      <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">
        {title}
      </h2>
      <div className="prose-styles space-y-4 text-base text-foreground/85 leading-relaxed [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_.callout]:border-l-2 [&_.callout]:border-pink-500/60 [&_.callout]:pl-4 [&_.callout]:py-1 [&_.callout]:bg-pink-500/5 [&_.callout]:rounded-r [&_a]:text-pink-600 [&_a]:hover:underline">
        {children}
      </div>
    </section>
  );
}
