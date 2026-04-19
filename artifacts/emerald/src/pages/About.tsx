import React from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { ContactCTASection } from "@/components/ContactCTASection";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function About() {
  useDocumentTitle("About");
  return (
    <>
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <p className="chb-mono-eyebrow text-muted-foreground mb-4">
          About Greater
        </p>
        <h1 className="chb-serif-headline text-4xl sm:text-5xl leading-[1.1]">
          Sovereign by default. Opinionated on purpose.
        </h1>

        <div className="space-y-6 mt-10 text-base sm:text-lg text-foreground/85 leading-relaxed">
          <p>
            Greater is a free, open-source shell for browser-local support
            bots. The model runs in the visitor's browser via WebGPU. There
            is no per-message API cost, no third-party data egress as a
            default behavior, and no vendor between you and your customers.
          </p>
          <p>
            The shell ships with six persona templates &mdash; Startups,
            Faith-Based Organizations, Private Schools &amp; Families, Small
            Businesses, HealthTech, and FinTech. Each persona has its own
            declared perspective; the bot tells the visitor up front whose
            lens it is speaking from. Pretending to be neutral, in our
            opinion, is a worse failure than being explicit.
          </p>

          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-12 mb-2">
            What is FOSS, what is for hire
          </h2>
          <p>
            The shell is MIT-licensed. Fork it, run it yourself, ship it on
            your own domain. The work clients hire me for is the corpus
            curation (turning your docs, sermons, listings, articles, or
            commit history into an indexed knowledge base the bot can speak
            from), the integration into your specific stack, and the
            architectural calls that make the bot actually close the lead
            instead of irritating the visitor.
          </p>
          <p>
            The bias toggle, the OpenClaw integration, and the proprietary
            persona-tuned weights are gitignored. The shell does not need
            them to be useful, but the production deployments do.
          </p>

          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-12 mb-2">
            What it is not
          </h2>
          <p>
            Greater is not a chaplain, a doctor, a lawyer, or a financial
            advisor. It is a corpus-bounded support surface. When asked
            something outside its corpus, it says so and routes the visitor
            to a human channel the operator controls. That conservative
            posture is the product, not a limitation.
          </p>

          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-12 mb-2">
            The author
          </h2>
          <p>
            Built by colonhyphenbracket. Bitcoin-Core inclined, Knots-curious.
            Available for fractional architecture engagements via{" "}
            <a
              href="https://hire.colonhyphenbracket.pink"
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-4 hover:text-foreground"
            >
              hire.colonhyphenbracket.pink
            </a>
            .
          </p>
        </div>

        <div className="mt-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border text-sm font-medium hover-elevate active-elevate active:scale-[0.97]"
            data-testid="link-about-home"
          >
            See the six bots
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </article>

      <ContactCTASection tone="muted" />
    </>
  );
}
