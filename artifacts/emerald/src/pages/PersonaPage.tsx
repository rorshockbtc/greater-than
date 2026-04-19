import React from "react";
import { Link, useRoute } from "wouter";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { getPersona } from "@/data/personas";
import { ContactCTASection } from "@/components/ContactCTASection";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import NotFound from "@/pages/not-found";
import { ShieldCheck } from "lucide-react";

const BASE = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL;

/**
 * Case-study page for a single persona, mounted at /bots/:slug
 * (the public spec uses "bots", not "personas").
 */
export default function PersonaPage() {
  const [, params] = useRoute("/bots/:slug");
  const persona = params ? getPersona(params.slug) : undefined;

  useDocumentTitle(persona ? persona.name : null);

  if (!persona) return <NotFound />;

  const isLive = persona.demoStatus === "live";
  const demoHref =
    persona.slug === "fintech" ? "/demo/blockstream" : `/demo/${persona.slug}`;

  return (
    <article className="pb-4">
      <div className="border-b border-border bg-secondary/40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10">
          <Link
            href="/"
            className="chb-mono-label text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
            data-testid="link-back-home"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All bots
          </Link>
          <p className="chb-mono-eyebrow text-muted-foreground mt-6 mb-2">
            {persona.name}
          </p>
          <h1 className="chb-serif-headline text-3xl sm:text-5xl leading-[1.1] max-w-2xl">
            {persona.tagline}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mt-4 max-w-2xl leading-relaxed">
            {persona.pain}
          </p>

          <div className="mt-8">
            <Link
              href={demoHref}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover-elevate active-elevate active:scale-[0.97]"
              data-testid={`link-demo-${persona.slug}`}
            >
              Try Demo
              <ArrowRight className="w-4 h-4" />
            </Link>
            {!isLive && (
              <p className="chb-mono-label text-muted-foreground mt-3">
                {persona.demoLabel}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="aspect-[16/9] rounded-xl overflow-hidden border border-card-border bg-secondary/50">
          <img
            src={`${BASE}${persona.heroImage}`}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pb-16">
        <CaseStudyMarkdown markdown={persona.caseStudy} />

        {(persona.slug === "healthtech" || persona.slug === "fintech") && (
          <CompliancePosture slug={persona.slug} />
        )}

        <div className="mt-12 pt-8 border-t border-border flex flex-wrap gap-3">
          <Link
            href={demoHref}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover-elevate active-elevate active:scale-[0.97]"
            data-testid={`link-demo-foot-${persona.slug}`}
          >
            Try Demo
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border text-sm font-medium hover-elevate active-elevate active:scale-[0.97]"
            data-testid="link-all-bots"
          >
            All bots
          </Link>
        </div>
      </div>

      <ContactCTASection tone="muted" />
    </article>
  );
}

/**
 * Minimal markdown renderer for the case-study format we author in
 * personas.ts (`##` headings + paragraphs only). Intentionally avoids a
 * full markdown dependency since the corpus is fully under our control.
 */
function CaseStudyMarkdown({ markdown }: { markdown: string }) {
  const blocks = parseBlocks(markdown);
  return (
    <div className="prose-styles">
      {blocks.map((block, i) => {
        if (block.type === "h2") {
          return (
            <h2
              key={i}
              className="text-2xl sm:text-3xl font-semibold tracking-tight mt-12 mb-4"
            >
              {block.text}
            </h2>
          );
        }
        return (
          <p
            key={i}
            className="text-base sm:text-lg text-foreground/85 leading-relaxed mb-5"
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

/**
 * "Compliance posture" subsection for the two regulated verticals.
 * Short, plain-language, and links to `/compliance#…` so a procurement
 * reviewer can drill into the engineering-grade document. Honesty
 * matters here: the FOSS shell makes no certification claims; the
 * subsection says so out loud.
 */
function CompliancePosture({ slug }: { slug: "healthtech" | "fintech" }) {
  const isHealth = slug === "healthtech";
  return (
    <aside
      aria-labelledby={`compliance-${slug}-heading`}
      className="mt-14 rounded-xl border border-border bg-secondary/40 p-6 sm:p-8"
      data-testid={`compliance-posture-${slug}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-4 h-4 text-pink-500" aria-hidden="true" />
        <p className="chb-mono-eyebrow text-muted-foreground">
          Compliance posture
        </p>
      </div>
      <h2
        id={`compliance-${slug}-heading`}
        className="text-xl sm:text-2xl font-semibold tracking-tight"
      >
        {isHealth
          ? "Healthtech: shell-side honesty, deployment-side compliance."
          : "Fintech: not advice, not a custodian, not a vector for phishing."}
      </h2>
      <p className="text-base text-muted-foreground mt-3 leading-relaxed">
        {isHealth
          ? "The FOSS shell runs in the visitor's browser. No PHI is transmitted in the default flow. Greater itself is not a Business Associate and holds no HIPAA attestation — a HIPAA-grade production deployment owns the BAA, the audit logging, encryption at rest, and access controls. The bot is a navigation aid that routes to a clinician, not a clinical decision-maker."
          : "The FOSS shell answers locally and refuses to ask for keys, seed phrases, or account credentials. Greater is not a custodian, not a regulated entity, and not a substitute for tax, legal, or financial advice. A regulated production deployment owns the KYC/AML plumbing, jurisdiction-specific record retention, and any consumer-protection disclosures their market requires."}
      </p>
      <div className="mt-5 flex flex-wrap gap-3 text-sm">
        <Link
          href={`/compliance#${slug}`}
          className="inline-flex items-center gap-1.5 text-pink-600 hover:underline underline-offset-2"
          data-testid={`link-compliance-${slug}`}
        >
          Read the full compliance posture &rarr;
        </Link>
        <span className="text-muted-foreground/50">·</span>
        <a
          href="https://github.com/rorshockbtc/greater-than/blob/main/COMPLIANCE.md"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          COMPLIANCE.md on GitHub &rarr;
        </a>
      </div>
    </aside>
  );
}

type Block = { type: "h2" | "p"; text: string };

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length) {
      const text = buf.join(" ").trim();
      if (text) blocks.push({ type: "p", text });
      buf = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("## ")) {
      flush();
      blocks.push({ type: "h2", text: line.slice(3).trim() });
    } else if (line === "") {
      flush();
    } else {
      buf.push(line);
    }
  }
  flush();
  return blocks;
}
