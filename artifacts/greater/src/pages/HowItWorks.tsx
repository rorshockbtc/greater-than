import React from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { PageHero } from "@/components/EditorialHeader";

/**
 * One-screen technical explainer. Hand-drawn-feel SVG diagram, plain
 * prose, links to the actual source files in the repo. No marketing
 * fluff — the audience here is HN, the curious developer, and the
 * procurement reviewer who wants to see what's under the hood.
 */
export default function HowItWorks() {
  useDocumentTitle("How it works");

  return (
    <article className="pb-20">
      <PageHero
        eyebrow="How it works"
        edition="Brief № 04 — Spring 2026"
        headline="Browser-local LLM,"
        accent="citations you can click."
        lede={
          <>
            One page. No diagrams of cubes. The flow that runs every
            time a visitor asks a question on a Greater demo — drawn
            with type, not with rectangles.
          </>
        }
      />

      <FlowStrip />

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-20 space-y-10">
        <Block
          n="01"
          heading="Question lands in the browser"
          body="The visitor types into the chat widget. Nothing leaves the device on the default flow. The question is handed to a Web Worker that has loaded a small instruction-tuned model (Llama-3.2-1B-Instruct, q4f16) onto WebGPU."
          file="artifacts/greater/src/llm/llmWorker.ts"
        />
        <Block
          n="02"
          heading="Retrieval pulls the relevant chunks"
          body="Before the model runs, the question is embedded with bge-small-en-v1.5 (also browser-local). The embedding is matched against the IndexedDB-backed vector store using cosine similarity. The top 4–8 chunks survive."
          file="artifacts/greater/src/llm/vectorStore.ts"
        />
        <Block
          n="03"
          heading="The model writes an answer with citation markers"
          body="The retrieved chunks are inlined into a system prompt with explicit instructions to cite sources by index ([1], [2,3], etc.). The model streams tokens back; the widget renders them with the citation markers turned into clickable links to the original page."
          file="artifacts/greater/src/components/ChatWidget.tsx"
        />
        <Block
          n="04"
          heading="The thought trace stays inspectable"
          body="Every retrieved chunk is rendered behind a 'Thought trace' disclosure: the cosine similarity score, the source page, the verbatim chunk text. The visitor (or a curious developer) can see exactly what the model was given."
          file="artifacts/greater/src/components/ChatMessage.tsx"
        />
        <Block
          n="05"
          heading="Cloud fallback is honest, capped, and labelled"
          body="If WebGPU isn't available — Safari, mid-download, ancient hardware — the widget falls back to a server endpoint (Together.AI) for the first three turns of the session. Every cloud reply ships with a 'Cloud' badge instead of 'Local · Private'. After three calls, the session is local-only and says so."
          file="artifacts/greater/src/llm/LLMProvider.tsx"
        />
        <Block
          n="06"
          heading="Ingestion is deterministic, anonymous-first, resumable"
          body="The Bitcoin seed builder pulls the OpTech archive, the last twelve months of bitcoin/bitcoin and bitcoinknots/bitcoin commits, and a curated list of BitcoinTalk threads. No API keys required. Sleeps through GitHub's anonymous rate-limit windows and tells you it's doing it. Caches every page to disk and resumes from the last cached page on rerun."
          file="scripts/src/build-bitcoin-seed.ts"
        />
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-20">
        <div className="border-t border-foreground/15 pt-8">
          <p className="chb-mono-eyebrow mb-3">What this means</p>
          <h2 className="chb-section-headline text-2xl sm:text-3xl leading-[1.1] tracking-[-0.012em] max-w-2xl">
            No vendor sits between you and your customers.
          </h2>
          <p className="text-base text-foreground/75 mt-4 leading-relaxed max-w-2xl">
            The shell is MIT. The model is open-weight. The corpus is
            yours. The runtime cost is the visitor's device. The only
            thing you pay for is the work of curating a knowledge base
            sharp enough to win comparisons — which is the part I do
            for hire. You can build it yourself if you'd prefer; it's
            likely more time-efficient to hire someone who's already
            done it.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/about"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover-elevate active-elevate active:scale-[0.97]"
              data-testid="link-howitworks-about"
            >
              The architecture, in detail
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="https://github.com/rorshockbtc/greater-than"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border text-sm font-medium hover-elevate active-elevate active:scale-[0.97]"
              data-testid="link-howitworks-github"
            >
              Read the source
            </a>
          </div>
        </div>
      </section>
    </article>
  );
}

/**
 * Editorial step entry. Replaces the previous "small uppercase mono
 * pink numeral + bold sans heading + small mono filemark" treatment
 * with a hairline-ruled magazine-grade chapter beat: large italic
 * serif numeral hanging in the gutter, hairline top rule, file path
 * as a quiet inline ornament rather than a separate metadata line.
 */
function Block({
  n,
  heading,
  body,
  file,
}: {
  n: string;
  heading: string;
  body: string;
  file: string;
}) {
  return (
    <div className="grid sm:grid-cols-[4rem_1fr] gap-3 sm:gap-8 items-start border-t border-foreground/12 pt-6">
      <span
        className="font-serif italic font-light leading-none text-foreground/55 select-none"
        style={{ fontSize: "clamp(2rem, 3vw, 2.4rem)" }}
        aria-hidden="true"
      >
        {n}
      </span>
      <div>
        <h3 className="chb-section-headline text-xl sm:text-2xl leading-[1.15] tracking-[-0.01em]">
          {heading}
        </h3>
        <p className="text-base text-foreground/75 mt-3 leading-relaxed">
          {body}
        </p>
        <p className="font-mono text-[12px] text-foreground/55 mt-3">
          <span className="text-[#FE299E]">↳</span>{" "}
          <span className="text-foreground/70">{file}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Typographic flow strip. The previous SVG flowchart with rounded
 * rectangles + curved arrows read like a Figma mockup — the user
 * called it "the world's most boring flowchart." This replacement is
 * pure type: each stage rendered as a serif label with an italic
 * sub-line beneath, separated by a single pink arrow. Reads as a
 * masthead lineup, not as a chart.
 *
 * Layout: a flex row that wraps on narrow viewports so the four
 * stages stack vertically on phones with vertical pink arrows
 * between them.
 */
function FlowStrip() {
  const stages: Array<{ label: string; sub: string; accent?: boolean }> = [
    { label: "Browser", sub: "visitor's tab" },
    { label: "WebGPU model", sub: "Llama-3.2-1B" },
    { label: "RAG retrieval", sub: "top 4–8 chunks" },
    { label: "Cited answer", sub: "with [1][2] links", accent: true },
  ];
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 mt-14">
      <div className="border-t border-b border-foreground/15 py-10">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-baseline gap-6 sm:gap-2">
          {stages.map((s, i) => (
            <React.Fragment key={s.label}>
              <div className="flex-1 min-w-0">
                <div
                  className={`chb-section-headline leading-[1.05] tracking-[-0.012em] ${s.accent ? "" : "text-foreground"}`}
                  style={{
                    fontSize: "clamp(1.4rem, 2.6vw, 2.1rem)",
                    color: s.accent ? "#FE299E" : undefined,
                  }}
                >
                  {s.label}
                </div>
                <div className="font-serif italic text-foreground/65 mt-1.5 text-sm sm:text-base">
                  {s.sub}
                </div>
              </div>
              {i < stages.length - 1 && (
                <div
                  aria-hidden="true"
                  className="self-center sm:self-baseline shrink-0 font-serif italic"
                  style={{
                    color: "#FE299E",
                    fontSize: "clamp(1.4rem, 2.4vw, 1.8rem)",
                  }}
                >
                  <span className="hidden sm:inline">→</span>
                  <span className="sm:hidden">↓</span>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
        <p className="text-sm text-foreground/65 mt-6 leading-relaxed italic font-serif max-w-2xl">
          Default flow — nothing leaves the device. Cloud fallback
          exists, is capped at three calls per session, and labels
          itself when used.
        </p>
      </div>
    </div>
  );
}

