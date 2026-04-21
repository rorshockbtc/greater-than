import React from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

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
            How it works
          </p>
          <h1 className="chb-serif-headline text-3xl sm:text-5xl leading-[1.05] max-w-2xl">
            Browser-local LLM, deterministic ingestion, citations the
            visitor can click.
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mt-5 max-w-2xl leading-relaxed">
            One page. No diagrams of cubes. The flow that runs every time
            a visitor asks a question on a Greater demo, drawn the way
            I'd sketch it on a whiteboard.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <FlowDiagram />
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed italic">
          ↑ default flow — nothing leaves the device. Cloud fallback exists,
          is capped at 3 calls, and labels itself.
        </p>
      </div>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 space-y-8">
        <Block
          n="01"
          heading="Question lands in the browser"
          body="The visitor types into the chat widget. Nothing leaves the device on the default flow. The question is handed to a Web Worker that has loaded a small instruction-tuned model (Llama-3.2-1B-Instruct, q4f16) onto WebGPU."
          file="artifacts/emerald/src/llm/llmWorker.ts"
        />
        <Block
          n="02"
          heading="Retrieval pulls the relevant chunks"
          body="Before the model runs, the question is embedded with bge-small-en-v1.5 (also browser-local). The embedding is matched against the IndexedDB-backed vector store using cosine similarity. The top 4–8 chunks survive."
          file="artifacts/emerald/src/llm/vectorStore.ts"
        />
        <Block
          n="03"
          heading="The model writes an answer with citation markers"
          body="The retrieved chunks are inlined into a system prompt with explicit instructions to cite sources by index ([1], [2,3], etc.). The model streams tokens back; the widget renders them with the citation markers turned into clickable links to the original page."
          file="artifacts/emerald/src/components/ChatWidget.tsx"
        />
        <Block
          n="04"
          heading="The thought trace stays inspectable"
          body="Every retrieved chunk is rendered behind a 'Thought trace' disclosure: the cosine similarity score, the source page, the verbatim chunk text. The visitor (or a curious developer) can see exactly what the model was given."
          file="artifacts/emerald/src/components/ChatMessage.tsx"
        />
        <Block
          n="05"
          heading="Cloud fallback is honest, capped, and labelled"
          body="If WebGPU isn't available — Safari, mid-download, ancient hardware — the widget falls back to a server endpoint (Together.AI) for the first three turns of the session. Every cloud reply ships with a 'Cloud' badge instead of 'Local · Private'. After three calls, the session is local-only and says so."
          file="artifacts/emerald/src/llm/LLMProvider.tsx"
        />
        <Block
          n="06"
          heading="Ingestion is deterministic, anonymous-first, resumable"
          body="The Bitcoin seed builder pulls the OpTech archive, the last twelve months of bitcoin/bitcoin and bitcoinknots/bitcoin commits, and a curated list of BitcoinTalk threads. No API keys required. Sleeps through GitHub's anonymous rate-limit windows and tells you it's doing it. Caches every page to disk and resumes from the last cached page on rerun."
          file="scripts/src/build-bitcoin-seed.ts"
        />
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
        <div className="rounded-xl border border-border bg-secondary/40 p-6 sm:p-8">
          <p className="chb-mono-eyebrow text-muted-foreground mb-2">
            What this means
          </p>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
            No vendor sits between you and your customers.
          </h2>
          <p className="text-base text-muted-foreground mt-3 leading-relaxed">
            The shell is MIT. The model is open-weight. The corpus is
            yours. The runtime cost is the visitor's device. The only
            thing you pay for is the work of curating a knowledge base
            sharp enough to win comparisons — which is the part I do for
            hire. You can build it yourself if you'd prefer, but it's likely more time-efficient to hire an expert.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
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
    <div className="grid sm:grid-cols-[3rem_1fr] gap-3 sm:gap-6 items-start">
      <span className="chb-mono-eyebrow text-pink-500/80">{n}</span>
      <div>
        <h3 className="text-lg sm:text-xl font-semibold tracking-tight">
          {heading}
        </h3>
        <p className="text-base text-muted-foreground mt-2 leading-relaxed">
          {body}
        </p>
        <p className="font-mono text-[11px] text-muted-foreground/70 mt-2">
          ↳ <span className="text-foreground/70">{file}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Hand-drawn-feel SVG. Slightly off-axis lines, no perfect rectangles,
 * arrows drawn with a wiggle. The point is texture: a curious visitor
 * inspecting the SVG sees real markup, not a stock illustration.
 */
function FlowDiagram() {
  return (
    <svg
      viewBox="0 0 720 220"
      role="img"
      aria-label="Browser to WebGPU model to RAG retrieval to cited answer"
      className="w-full h-auto rounded-xl border border-border bg-secondary/30 p-4"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="#FE299E" />
        </marker>
      </defs>

      {/* Browser */}
      <Node x={20} y={70} w={130} h={80} label="Browser" sub="visitor's tab" />
      {/* WebGPU model */}
      <Node x={195} y={30} w={140} h={70} label="WebGPU model" sub="Llama-3.2-1B" />
      {/* Vector store */}
      <Node x={195} y={130} w={140} h={70} label="Vector store" sub="IndexedDB · bge-small" />
      {/* RAG retrieval */}
      <Node x={385} y={70} w={140} h={80} label="RAG retrieval" sub="top 4–8 chunks" />
      {/* Cited answer */}
      <Node x={570} y={70} w={130} h={80} label="Answer" sub="with [1][2] links" accent />

      {/* Arrows — drawn with slight wiggle so they don't read as Figma */}
      <Arrow d="M 150 100 C 170 90, 180 70, 195 65" />
      <Arrow d="M 150 120 C 170 130, 180 155, 195 160" />
      <Arrow d="M 335 65 C 355 70, 370 80, 385 95" />
      <Arrow d="M 335 165 C 355 160, 370 145, 385 130" />
      <Arrow d="M 525 110 C 545 110, 555 110, 570 110" />

    </svg>
  );
}

function Node({
  x,
  y,
  w,
  h,
  label,
  sub,
  accent,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
  accent?: boolean;
}) {
  // Slight stroke wiggle via dashed-undercoat trick.
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        fill={accent ? "rgba(254,41,158,0.06)" : "rgba(0,0,0,0.02)"}
        stroke={accent ? "#FE299E" : "#999"}
        strokeWidth={accent ? 1.6 : 1.1}
      />
      <text
        x={x + w / 2}
        y={y + h / 2 - (sub ? 4 : 0)}
        textAnchor="middle"
        fontSize="13"
        fontWeight="600"
        fill="currentColor"
      >
        {label}
      </text>
      {sub && (
        <text
          x={x + w / 2}
          y={y + h / 2 + 14}
          textAnchor="middle"
          fontSize="10"
          fill="#737373"
        >
          {sub}
        </text>
      )}
    </g>
  );
}

function Arrow({ d }: { d: string }) {
  return (
    <path
      d={d}
      stroke="#FE299E"
      strokeWidth="1.4"
      fill="none"
      markerEnd="url(#arrow)"
    />
  );
}
