import React from "react";
import { Link } from "wouter";
import { ArrowRight, Lock, Radio, Zap } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { PageHero } from "@/components/EditorialHeader";

/**
 * Vision page for Greater's NOSTR integration.
 *
 * The pitch: NOSTR's event model maps naturally onto a sovereign,
 * distributed knowledge base. You publish encrypted events to a
 * private relay you control; Greater subscribes and keeps its KB
 * updated. No central server. No cloud DB. No third-party knowing
 * what your business knows.
 */

export default function Nostr() {
  useDocumentTitle("NOSTR · Greater");

  return (
    <article className="pb-24">
      <PageHero
        eyebrow="Sovereign sync"
        edition="Brief № 02 — Spring 2026"
        headline="NOSTR as a private,"
        accent="encrypted knowledge bus."
        lede={
          <>
            Most AI tools force your knowledge into their database.
            Greater can pull from a NOSTR relay you control — publicly
            accessible, entirely private, event-sourced.
          </>
        }
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 space-y-16">

        <section>
          <h2 className="text-xl font-semibold mb-4">The problem with every other KB</h2>
          <p className="text-muted-foreground leading-relaxed">
            Every knowledge-base product — Notion, Confluence, SharePoint,
            custom RAG SaaS — has the same architectural smell: your documents
            live in their database, your queries go through their API, and you
            are one acquisition or outage away from losing the whole thing.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            The NOSTR model inverts this. You own the keys. You choose the
            relay. You can self-host it on a $5 VPS or use any public relay
            with a private filter. Nobody can read your events without the
            decryption key, and nobody can delete them without taking the relay
            down.
          </p>
        </section>

        <div className="grid sm:grid-cols-3 gap-5">
          <FeatureCard
            icon={Lock}
            title="Encrypted at rest"
            body="Events are encrypted with NIP-04 (AES-256-CBC, shared secret). Your relay sees ciphertext. Greater decrypts locally, in-browser, using your key — which never leaves your machine."
          />
          <FeatureCard
            icon={Radio}
            title="Real-time sync"
            body="Subscribe once. Every new event the operator publishes to the relay flows into Greater's embedding pipeline and is available for retrieval on the next query. No polling. No webhook config."
          />
          <FeatureCard
            icon={Zap}
            title="Event-sourced"
            body="Each piece of knowledge is a discrete, timestamped, signed event. Retractions, corrections, and versioned updates all model naturally. Your KB has provenance that a static dump never has."
          />
        </div>

        <section>
          <h2 className="text-xl font-semibold mb-4">How it works in practice</h2>
          <ol className="space-y-5">
            {[
              {
                n: "1",
                title: "You publish to your relay",
                body: "Write a note (kind 1), a long-form article (kind 30023), or an encrypted DM (kind 4) from any NOSTR client — Damus, Amethyst, Snort, or your own script. Tag it however your workflow demands.",
              },
              {
                n: "2",
                title: "Greater subscribes via the Knowledge panel",
                body: 'Open the "Sovereign sync" tab in Greater\'s knowledge panel, paste your relay URL and public key (npub), and hit Connect. Greater fetches all matching events and begins embedding them locally.',
              },
              {
                n: "3",
                title: "Decryption happens in your browser",
                body: "For private events, Greater uses your NIP-07 browser extension (Alby, nos2x) to decrypt without ever seeing your private key. If you prefer, paste your nsec — it is held in memory only and is never stored or transmitted.",
              },
              {
                n: "4",
                title: "Retrieval stays local",
                body: "The embeddings land in IndexedDB on your device. When you ask a question, Greater retrieves the relevant chunks from your local vector store and grounds the answer in your own knowledge. Nothing leaves the browser.",
              },
            ].map((step) => (
              <li key={step.n} className="flex gap-4">
                <span className="shrink-0 w-7 h-7 rounded-full bg-[hsl(var(--accent))] text-white flex items-center justify-center text-sm font-bold mt-0.5">
                  {step.n}
                </span>
                <div>
                  <h3 className="font-semibold mb-1">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-secondary/40 border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-3">
            The use-cases that excite me
          </h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {[
              "A family publishes encrypted notes about household decisions, medical history, and legal documents to a home relay. The Greater shell on any family member's machine can answer questions grounded in that shared, private knowledge. When a family member passes, their memory can be preserved.",
              "A church publishes sermon notes, pastoral letters, and doctrinal positions to a community relay. Members ask the Greater shell questions; the shell answers from the actual corpus, not a generic LLM's hallucinated theology. Notes can be internal or external.",
              "A Bitcoin company publishes internal incident reports, compliance notes, and runbooks to a private relay. The on-call engineer gets a RAG-grounded answer from internal docs without any of it touching a third-party API. Context can be built out for devTools, allowing new developers to quickly onboard",
              "A solo operator uses a private relay as a second brain — publishing links, notes, and document summaries from a mobile client. The Greater shell on their laptop indexes everything and makes it searchable via natural language.",
            ].map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[hsl(var(--accent))] shrink-0 mt-0.5">→</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <aside
            className="mt-5 text-xs text-muted-foreground border-l-2 border-[hsl(var(--accent))/0.4] pl-3 italic"
          >
            These are architecturally straightforward to wire today. The harder
            work (relay selection, key management UX, team relay auth) is
            what a production engagement with my studio covers. However, there are many excellent guides on the internet for getting started with NOSTR!
          </aside>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Try it now</h2>
          <p className="text-muted-foreground leading-relaxed mb-5">
            Open any Greater demo, click the settings icon in the chat
            widget header, and choose <strong>Knowledge base</strong>.
            The <strong>NOSTR</strong> tab lets you connect a relay and
            index events right now — no account, no API key, no Postgres.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/demo/blockstream"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--accent))] hover:underline"
            >
              Open FinTech demo
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <a
              href="https://github.com/rorshockbtc/greater-than"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Read the source
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </section>

      </div>
    </article>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Lock;
  title: string;
  body: string;
}) {
  // Editorial-entry treatment matching the home-page primitive: no
  // box, hairline top rule, hanging design glyph in the gutter. The
  // lucide icon is preserved here because it's small (w-4 h-4), tinted
  // to the page accent, and reads as a typographic ornament rather than
  // the standard "rounded card with corner-icon" template tile.
  return (
    <div className="chb-editorial-entry">
      <span className="chb-numeral" aria-hidden="true" style={{ fontSize: "1.5rem", marginTop: "0.05rem" }}>
        <Icon className="w-4 h-4 text-[hsl(var(--accent))]" />
      </span>
      <div className="flex flex-col gap-2">
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
