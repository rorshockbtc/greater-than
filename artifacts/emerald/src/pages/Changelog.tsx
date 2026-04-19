import React from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/**
 * Hand-written build log. Not a git log dump — these are the changes
 * the *visitor* notices, in plain prose. New entries go on top.
 */
const ENTRIES: { date: string; title: string; body: string }[] = [
  {
    date: "Apr 19, 2026",
    title: "Compliance posture, written down",
    body:
      "Added COMPLIANCE.md and a /compliance page with deep-linkable anchors per standard (HIPAA, WCAG, GDPR, CCPA, PCI, SOC 2). The healthtech and fintech demos now open with a persona-tuned disclaimer banner before the first turn — visually distinct, dismissible per session, announced by screen readers. The accessibility pass got contrast, focus rings, the skip-to-content link, and aria-live on streaming chat over the line for WCAG 2.2 AA on the marketing site.",
  },
  {
    date: "Apr 19, 2026",
    title: "Anti-AI design pass",
    body:
      "Pulled the homepage out of the uniform-grid look that pattern-matches as 'AI-generated' in 2026 — added a build-stamp footer (you can see when this bundle was actually compiled at the bottom of every page), a 'from the author' line under the hero, a margin-note caveat, and the steampunk hero illustration as a low-opacity background behind the headline. The /how-it-works diagram is hand-drawn-feel SVG, not a stock cube.",
  },
  {
    date: "Apr 19, 2026",
    title: "/proof, /how-it-works, /changelog",
    body:
      "Three new pages aimed at the curious visitor. /proof shows real chat sessions from the running demos with author commentary; /how-it-works walks the request lifecycle from browser keystroke to cited answer; this page (/changelog) replaces the auto-generated commit dump with a hand-written log of what changed for the user.",
  },
  {
    date: "Apr 18, 2026",
    title: "Pre-launch head, favicon, typography",
    body:
      "Branded <head> on every route — title, description, canonical, OG card, theme-color pink. Favicon pipeline (sharp + png-to-ico) emits the SVG/ICO/16/32/180/512 set from one source. The 1200×630 OG card is shareable. Hero H1s switched to Fraunces (serif) so the page doesn't read as wall-to-wall Inter.",
  },
  {
    date: "Apr 17, 2026",
    title: "Pipes — Core/Knots bias toggle wired",
    body:
      "The Bitcoin demo's chat now shows a bias toggle (Neutral / Core / Knots) when a Pipe with multi-bias options is mounted. Switching mid-conversation drops an inline note in the transcript and the model gets a bias-specific system prompt + bias-filtered retrieval set on the next turn. The transcript stays honest — the next answer can disagree with an earlier one because the perspective changed.",
  },
  {
    date: "Apr 16, 2026",
    title: "Pipe loader, registry, status panel",
    body:
      "A Pipe is a curated, opinionated knowledge bundle authored by a domain expert. The Vite plugin reads any manifests in data/pipes/ (gitignored) and inlines them as virtual:greater-pipes. The chat widget binds one Pipe per persona; a status panel in the settings menu shows pipe id, version, bias options, and a 'Disconnect Pipe' button that drops the session into Generic mode honestly.",
  },
  {
    date: "Apr 15, 2026",
    title: "Generic web-scraping ingestion",
    body:
      "The chat widget's settings menu now opens a 'Manage knowledge base' panel. Paste a URL or sitemap; the server fetches it (Mozilla Readability), the browser chunks it paragraph-aware, embeds each chunk with the local sentence-transformer, and persists to IndexedDB. No LLM in the ingestion path — extraction and embedding are deterministic, so reruns produce the same chunks twice.",
  },
  {
    date: "Apr 14, 2026",
    title: "Browser-local LLM landed (WebGPU)",
    body:
      "Llama-3.2-1B-Instruct (q4f16) + bge-small-en-v1.5 running in a Web Worker on WebGPU. IndexedDB-backed vector store. Thought-trace UI shows every retrieved chunk with similarity scores. Cloud fallback (Together.AI) is capped at 3 calls per session and labels itself; after the cap, the badge changes to 'Local-only · cloud rate-limited' so provenance stays honest.",
  },
  {
    date: "Apr 13, 2026",
    title: "Pivot — Emerald → Greater",
    body:
      "The original repo was a Blockstream-specific support bot prototype. The pivot turns it into Greater, a platform for industry-specific support bots — six personas, FOSS shell, browser-local inference, hired-out customization. The Blockstream demo is preserved at /demo/blockstream as the live FinTech showcase and the proof of what a fully-tuned Greater bot looks like.",
  },
];

export default function Changelog() {
  useDocumentTitle("Changelog");

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
            Changelog
          </p>
          <h1 className="chb-serif-headline text-3xl sm:text-5xl leading-[1.05] max-w-2xl">
            Build log.
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mt-5 max-w-2xl leading-relaxed">
            What changed, why it matters to whoever's using this.
            Hand-written. New entries go on top.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 space-y-8">
        {ENTRIES.map((e, i) => (
          <Entry key={i} {...e} />
        ))}
      </div>
    </article>
  );
}

function Entry({
  date,
  title,
  body,
}: {
  date: string;
  title: string;
  body: string;
}) {
  return (
    <div className="grid sm:grid-cols-[8rem_1fr] gap-2 sm:gap-6 items-start border-b border-border/60 pb-8">
      <p className="chb-mono-label text-muted-foreground pt-1">{date}</p>
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-base text-muted-foreground mt-2 leading-relaxed">
          {body}
        </p>
      </div>
    </div>
  );
}
