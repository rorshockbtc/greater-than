import React, { useEffect } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { ArrowLeft, Bell } from "lucide-react";
import { getPersona } from "@/data/personas";
import { useContact } from "@/components/ContactContext";
import { ContactCTASection } from "@/components/ContactCTASection";
import NotFound from "@/pages/not-found";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function DemoHolding() {
  const [, params] = useRoute("/demo/:slug");
  const [, setLocation] = useLocation();
  const persona = params ? getPersona(params.slug) : undefined;
  const { open: openContact } = useContact();
  useDocumentTitle(persona ? `${persona.name} demo` : null);

  // Personas whose demo is live get routed to their dedicated demo route
  // instead of the holding screen. Today that's only FinTech →
  // /demo/blockstream; future live personas should be added here.
  const liveDemoRoutes: Record<string, string> = {
    fintech: "/demo/fintech",
  };
  const liveTarget = persona ? liveDemoRoutes[persona.slug] : undefined;

  useEffect(() => {
    if (liveTarget) setLocation(liveTarget, { replace: true });
  }, [liveTarget, setLocation]);

  if (!persona) return <NotFound />;
  if (liveTarget) return null;

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        <Link
          href={`/bots/${persona.slug}`}
          className="chb-mono-label text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 mb-10"
          data-testid="link-back-persona"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to {persona.name}
        </Link>

        <p className="chb-mono-eyebrow text-muted-foreground mb-3">
          {persona.name} demo &mdash; coming online
        </p>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1]">
          The {persona.name.toLowerCase()} bot is being indexed &mdash; be the first client.
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground mt-5 leading-relaxed">
          {persona.demoLabel}. The architecture is identical to the live{" "}
          <Link
            href="/demo/blockstream"
            className="underline underline-offset-4 hover:text-foreground"
          >
            FinTech demo
          </Link>{" "}
          &mdash; what differs is the curated knowledge base, the persona's
          declared perspective, and the persona-specific escalation flow.
        </p>

        <div className="mt-10 rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
          <p className="chb-mono-label text-amber-600 dark:text-amber-400 mb-2">
            Proprietary Pipe — not in the FOSS shell
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The Greater shell is open source. This persona&rsquo;s corpus,
            embeddings, and system-prompt adapters are <em>not</em>. They are
            curated and delivered as a signed Pipe via pipes.pink — the
            proprietary extension layer that sits on top of the FOSS shell.
            Forking the repo will give you the scaffold; it will not give you
            the data.
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-secondary/30 p-6">
          <div className="flex items-start gap-4">
            <div
              className="w-10 h-10 rounded-full border border-border flex items-center justify-center shrink-0"
              style={{ color: "#FE299E" }}
            >
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold mb-1.5">
                Want to be the pilot?
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Pilot deployments get the full architecture &mdash; corpus
                curation, indexing, browser-LLM tuning &mdash; at favorable
                terms in exchange for a public case study. If you operate in
                this space and want to be the showcase deployment for{" "}
                {persona.name.toLowerCase()}, get in touch.
              </p>
              <button
                type="button"
                onClick={openContact}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover-elevate active-elevate active:scale-[0.97]"
                data-testid="button-pilot-contact"
              >
                Pilot contact form
              </button>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <p className="chb-mono-label text-muted-foreground mb-3">
            In the meantime
          </p>
          <ul className="space-y-2 text-base">
            <li>
              <Link
                href={`/bots/${persona.slug}`}
                className="text-foreground hover:underline underline-offset-4"
              >
                Read the {persona.name.toLowerCase()} case study &rarr;
              </Link>
            </li>
            <li>
              <Link
                href="/demo/blockstream"
                className="text-foreground hover:underline underline-offset-4"
              >
                Try the live FinTech demo &rarr;
              </Link>
            </li>
            <li>
              <Link
                href="/about"
                className="text-foreground hover:underline underline-offset-4"
              >
                What is Greater? &rarr;
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <ContactCTASection tone="muted" />
    </>
  );
}
