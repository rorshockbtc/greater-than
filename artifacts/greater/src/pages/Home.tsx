import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Lock, Cpu, FileText, AlertCircle, MessageSquare, Github, Globe, Sliders, Wrench, Radio, Zap } from "lucide-react";
import { personas } from "@/data/personas";
import { PersonaCard } from "@/components/PersonaCard";
import { ContactCTASection } from "@/components/ContactCTASection";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import heroImage from "@/assets/greater-hero.png";

export default function Home() {
  // Preserve the static index.html <title> on /.
  useDocumentTitle(null);
  // The meta-bot widget is mounted globally in <Layout>, so every
  // marketing page (Home, About, /bots/:slug, etc.) shows it. Friend
  // review pre-launch: previously it was Home-only, which meant a
  // visitor who clicked through to a case study lost the "ask me
  // about this thing" affordance.
  return (
    <>
      <Hero />
      <PrinciplesStrip />
      <Walkthrough />
      <FeatureHighlights />
      <CXCostSection />
      <PersonasGrid />
      <ContactCTASection tone="muted" />
    </>
  );
}

function Hero() {
  return (
    <section className="relative border-b border-border overflow-hidden">
      {/*
        Decorative steampunk-machine illustration as a low-opacity
        background. Pinned to the right and feathered with a left-to-
        right gradient mask so the headline's first words stay against
        a clean canvas while the cogs and pipes peek through behind the
        pink accent on the right. `aria-hidden` because the image is
        purely decorative — the text already carries the meaning.
      */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none select-none"
      >
        <div
          className="absolute inset-0 motion-safe:animate-none"
          style={{
            backgroundImage: `url(${heroImage})`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right center",
            backgroundSize: "min(900px, 90%) auto",
            opacity: 0.42,
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.45) 30%, rgba(0,0,0,0.95) 65%, rgba(0,0,0,1) 100%)",
            maskImage:
              "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.45) 30%, rgba(0,0,0,0.95) 65%, rgba(0,0,0,1) 100%)",
          }}
        />
        {/* A second, very-soft top-down fade so the hero copy area
            stays clearly the foreground at any viewport height. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, hsl(var(--background) / 0.4) 0%, hsl(var(--background) / 0.15) 35%, hsl(var(--background) / 0.55) 75%, hsl(var(--background)) 100%)",
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-20 pb-28 sm:pt-32 sm:pb-40">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="chb-mono-eyebrow text-muted-foreground mb-10"
        >
          Greater &mdash; sovereign support bots, FOSS by default
        </motion.p>
        {/*
          Display-scale headline. Two visual moves:
          1. Type scale jumps from "marketing-page-large" to
             "magazine-cover-large" via clamp(), so on any wide screen
             the headline is the entire visual event of the page.
          2. The pink phrase becomes a serif-italic break-line — the
             same mixed-typeface trick a print art-director uses to
             stop a long sans headline from feeling like a wall. Also
             carries the brand accent (#FE299E) without needing any
             colored chrome elsewhere.
          The word-by-word stagger is small in time (~30ms steps) and
          uses a single `inline-block` per word so descenders/ascenders
          on the serif line don't collide with the sans line above.
        */}
        <h1
          className="chb-serif-headline text-[clamp(2.6rem,7.6vw,8.4rem)] leading-[0.92] tracking-[-0.012em] max-w-[18ch]"
          data-testid="hero-headline"
          aria-label="Your customers deserve a chatbot that actually knows your business."
        >
          {/* Visual layer — animated, hidden from assistive tech.
              The aria-label above is the canonical text. Wrapping the
              animated spans in aria-hidden prevents screen readers from
              hearing the words as concatenated tokens (the inline-block
              motion.spans suppress real word-spacing). */}
          <span aria-hidden="true">
            <span className="block">
              <WordStagger text="Your customers deserve a chatbot that" />
            </span>
            <span className="block chb-serif-accent" style={{ color: "#FE299E" }}>
              <WordStagger text="actually knows your business" delay={0.32} />
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.32 + 0.04 * 5 + 0.18 }}
                className="inline-block"
              >
                .
              </motion.span>
            </span>
          </span>
        </h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.85 }}
          className="text-lg sm:text-xl text-muted-foreground mt-10 max-w-2xl leading-relaxed"
        >
          The free shell runs entirely in the browser. Six industry templates,
          one architectural conviction: bias is unavoidable, so make it explicit
          and make it yours.
        </motion.p>

        {/* "From the author" line — small, italic, under the lede.
            Anti-AI cue: a real first-person sentence, with a real
            outbound link to the author's site. */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.95 }}
          className="text-sm text-muted-foreground mt-5 italic max-w-2xl"
        >
          — built by{" "}
          <a
            href="https://colonhyphenbracket.pink"
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 hover:text-foreground"
            data-testid="link-hero-author"
          >
            ColonHyphenBracket Studio 
          </a>
          , in public, in pink. The launch demo
          is the FinTech bot — answering real Bitcoin questions in your
          browser, no API key, no signup.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.22 }}
          className="mt-9 flex flex-wrap gap-3"
        >
          <Link
            href="/demo/fintech"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover-elevate active-elevate active:scale-[0.97]"
            data-testid="link-hero-try-demo"
          >
            <MessageSquare className="w-4 h-4" />
            Try the live demo
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#personas"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border text-sm font-medium hover-elevate active-elevate active:scale-[0.97]"
            data-testid="link-hero-personas"
          >
            See the six bots
          </a>
          <a
            href="https://github.com/rorshockbtc/greater-than"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border text-sm font-medium hover-elevate active-elevate active:scale-[0.97]"
            data-testid="link-hero-github"
          >
            <Github className="w-4 h-4" />
            Read the source
          </a>
        </motion.div>
      </div>

      {/*
        Editorial file-stamp in the bottom-right of the hero box. The
        kind of tiny mono mark you see in the corner of a magazine
        layout. Real print designers use these to break the visual
        symmetry of an otherwise rectangular column. Anti-AI cue: a
        real person filed this on a real day.
      */}
      <div
        aria-hidden="true"
        className="hidden sm:flex absolute bottom-5 left-6 chb-filemark items-center gap-3 select-none"
      >
        <span>Filed 04 · 2026</span>
        <span className="inline-block w-6 h-px bg-pink-500/60" />
        <span>Greater v1 · CHB :-]</span>
      </div>

      {/*
        Vertical edition mark on the right gutter — the print-magazine
        "spine" treatment. Sits outside the readable column so it never
        competes with the headline; reads as a single typographic
        ornament that anchors the right edge of the hero. Hidden below
        lg because the gutter doesn't exist there.
      */}
      <div
        aria-hidden="true"
        className="hidden lg:flex absolute right-6 top-32 chb-filemark items-center gap-3 select-none"
        style={{
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          letterSpacing: "0.32em",
        }}
      >
        <span>Edition № 01</span>
        <span className="inline-block w-px h-8 bg-foreground/20" />
        <span>Spring 2026</span>
      </div>
    </section>
  );
}

/**
 * Word-by-word stagger reveal for the hero headline. Each word is
 * an `inline-block` so its translateY animates without disturbing
 * the line below it. Step is intentionally small (~40ms) so on a
 * 7-word line the whole reveal completes in well under a second
 * and never feels like a "look at me animating" moment. Honors
 * `prefers-reduced-motion` via the global override in index.css
 * (framer-motion respects the media query out of the box).
 */
function WordStagger({ text, delay = 0 }: { text: string; delay?: number }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: "0.45em" }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            delay: delay + i * 0.04,
            ease: [0.22, 0.61, 0.36, 1],
          }}
          className="inline-block"
          style={{ marginRight: "0.22em" }}
        >
          {word}
        </motion.span>
      ))}
    </>
  );
}

/**
 * Shared section-header treatment for the Home page. Replaces the
 * old eyebrow-plus-bold-sans-h2 pattern with a numbered editorial
 * sigil and a serif-accent headline. The motion is deliberately
 * understated: a viewport-triggered fade-up on the whole header
 * block, once. `prefers-reduced-motion` is respected via framer
 * motion's built-in honoring + the global override in index.css.
 */
function SectionHeader({
  sigil,
  label,
  children,
  lede,
  align = "left",
  trailing,
}: {
  sigil: string;
  label: string;
  children: React.ReactNode;
  lede?: React.ReactNode;
  align?: "left" | "between";
  trailing?: React.ReactNode;
}) {
  // MoMA Bulletin / Vignelli treatment: a wide horizontal hairline
  // is the section anchor, with the §-numeral hanging at display
  // scale on the left and the small label sitting beside it. The
  // headline lives below the rule, free to scale up to display size
  // without competing with chrome. The hairline `scaleX`s in from
  // the left when the section enters view — the only motion in the
  // opener, deliberately a single gesture.
  const sigilTestId = sigil.toLowerCase().replace(/\W+/g, "-");
  const numeral = sigil.replace(/^§\s*/, "");
  return (
    <div className="mb-16 lg:mb-20">
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5 }}
        className="flex items-baseline gap-4 sm:gap-6 mb-10"
        data-testid={`sigil-${sigilTestId}`}
      >
        <span
          className="font-serif font-light leading-none text-foreground/35 select-none"
          style={{ fontSize: "clamp(1.6rem, 3.2vw, 2.6rem)", letterSpacing: "-0.01em" }}
        >
          §&nbsp;{numeral}
        </span>
        <motion.span
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 0.61, 0.36, 1] }}
          className="flex-1 h-px bg-foreground/20 origin-left"
          aria-hidden="true"
        />
        <span className="chb-mono-eyebrow text-foreground/65 whitespace-nowrap">
          {label}
        </span>
        {align === "between" && trailing && (
          <span className="hidden lg:inline-flex">{trailing}</span>
        )}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.55, delay: 0.15 }}
        className="max-w-4xl"
      >
        <h2 className="chb-section-headline text-[clamp(1.9rem,4.4vw,3.6rem)] leading-[1.02] tracking-[-0.012em]">
          {children}
        </h2>
        {lede && (
          <p className="text-base sm:text-lg text-muted-foreground mt-5 leading-relaxed max-w-2xl">
            {lede}
          </p>
        )}
        {align === "between" && trailing && (
          <div className="mt-6 lg:hidden">{trailing}</div>
        )}
      </motion.div>
    </div>
  );
}

function PrinciplesStrip() {
  const items = [
    {
      icon: Cpu,
      title: "FOSS shell",
      body: "MIT-licensed core. Fork it, run it yourself, ship it on your domain. The shell is free.",
    },
    {
      icon: FileText,
      title: "In-browser inference",
      body: "WebGPU runs the model on the visitor's device. No per-message API tax. No vendor between you and your customers.",
    },
    {
      icon: AlertCircle,
      title: "Pipe-powered customization",
      body: "The corpus, the persona-tuned weights, and the integration into your stack are where deployments actually win — and that customization is hard. Hire me.",
    },
    {
      icon: Lock,
      title: "Explicit bias",
      body: "Pretending to be neutral is a worse failure than being explicit. Every persona declares its perspective up front.",
    },
  ];
  return (
    <section className="border-b border-border bg-secondary/40 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-24 sm:py-32">
        <SectionHeader
          sigil="§ 01"
          label="How it works"
          align="between"
          trailing={
            <aside
              className="self-start lg:self-end max-w-xs text-[12px] leading-snug text-muted-foreground italic px-3 py-2 border-l-2 border-pink-500/60 bg-pink-500/5 rounded-r-md"
              style={{ transform: "rotate(-0.6deg)" }}
              data-testid="aside-margin-note"
            >
              <span className="chb-mono-label text-pink-500/80 not-italic mr-1">
                note —
              </span>
              "Explicit bias" is not just a slogan; it's a refusal. The
              general-purpose chatbots pretending to be neutral are doing
              damage. Ours says where it stands.
            </aside>
          }
        >
          FOSS shell, in-browser inference,{" "}
          <span className="chb-serif-accent">hired-out curation.</span>
        </SectionHeader>
        {/*
          Editorial four-up: no boxes, no lucide-icon-on-corner. The
          previous treatment was a uniform tile grid that, even with
          asymmetric stagger and alternating surfaces, still read as a
          starter-template card row. The replacement is the magazine
          version: hairline top rules, big serif numerals hanging in
          the gutter, vertical hairline dividers between columns on
          desktop. Mobile collapses to a stacked list with mono labels
          instead of giant digits — same primitive, phone-appropriate.
        */}
        <motion.div
          className="chb-editorial-grid chb-editorial-divided chb-cols-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-8 mt-2"
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.05 }}
        >
          {items.map((it, i) => (
            <div key={it.title} className="chb-editorial-entry">
              <span className="chb-numeral" aria-hidden="true">
                <em>0{i + 1}</em>
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="text-[15px] font-semibold leading-snug">{it.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{it.body}</p>
              </div>
            </div>
          ))}
        </motion.div>

        <div className="mt-10 flex flex-wrap gap-3 text-sm">
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground underline underline-offset-2"
            data-testid="link-principles-how-it-works"
          >
            The full architecture &rarr;
          </Link>
          <span className="text-muted-foreground/50">·</span>
          <Link
            href="/proof"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground underline underline-offset-2"
            data-testid="link-principles-proof"
          >
            Real chats &rarr;
          </Link>
          <span className="text-muted-foreground/50">·</span>
          <Link
            href="/compliance"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground underline underline-offset-2"
            data-testid="link-principles-compliance"
          >
            Compliance posture &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}

function Walkthrough() {
  // Three-step tour of what makes Greater concretely different from
  // a generic chatbot. Friend-review feedback ("Jay's tour"): without
  // an explicit walkthrough, visitors don't realise the bottom-right
  // chat is a real demo of the same engine, the bias toggle is a
  // real product feature, and OpenClaw / NOSTR / in-browser are real
  // commitments — they read as marketing nouns.
  const steps = [
    {
      icon: MessageSquare,
      eyebrow: "Step 1",
      title: "Open the bot in the corner.",
      body: "It runs in your browser, not on a server. The first message takes a moment because the model and the corpus are downloading — every message after that is local.",
      audience: "For: any visitor on this site, right now.",
      example: "Try: \"how does this actually work?\"",
      cta: { label: "Watch the loading state", href: "/how-it-works" },
    },
    {
      icon: Sliders,
      eyebrow: "Step 2",
      title: "Flip the bias toggle.",
      body: "Each persona ships its own perspective options — customer view, founder view, member view. Same question, different answer, on purpose. Generic chatbots pretend neutrality; ours names where it stands.",
      audience: "For: founders, support leads, anyone tired of vendor-grade fence-sitting.",
      example: "Try: ask the FinTech bot the same question under \"customer\" then \"company\" view.",
      cta: { label: "Try the FinTech demo", href: "/demo/fintech" },
    },
    {
      icon: Wrench,
      eyebrow: "Step 3",
      title: "Make it yours, three ways.",
      body: "Fork the MIT shell on GitHub, swap your own LLM in via OpenClaw (BYO local model), or ping me to build a curated Pipe with persona-tuned weights for your domain.",
      audience: "For: operators who want a real AI surface without a vendor lock-in tax.",
      example: "Deploys: a Cloudflare Pages static site, a clinic member portal, a church website, an early-stage SaaS docs page.",
      cta: { label: "OpenClaw · NOSTR · the Pipe", href: "/openclaw" },
    },
  ];
  return (
    <section
      id="walkthrough"
      className="border-b border-border"
      data-testid="section-walkthrough"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-24 sm:py-32">
        <SectionHeader
          sigil="§ 02"
          label="A 30-second tour"
          lede={
            <>
              The shortest path from "another AI demo" to "okay, this is
              architecturally different."
            </>
          }
        >
          Three things to do before you decide{" "}
          <span className="chb-serif-accent">whether this is real.</span>
        </SectionHeader>
        {/*
          Editorial three-up: full-height numbered entries instead of
          uniform tile cards. The big serif numeral is the design
          element; the lucide icon corner-tag was redundant and read
          as starter-template chrome. The pink "For:" annotation and
          italic try-this line are kept verbatim — those are voice.
        */}
        <ol className="chb-editorial-grid chb-editorial-divided chb-cols-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10 mt-2">
          {steps.map((s, i) => (
            <li
              key={s.eyebrow}
              className="chb-editorial-entry"
              data-testid={`walkthrough-step-${i + 1}`}
            >
              <span className="chb-numeral" aria-hidden="true">
                0{i + 1}
              </span>
              <div className="flex flex-col gap-3">
                <p className="chb-mono-eyebrow text-muted-foreground">
                  {s.eyebrow}
                </p>
                <h3 className="text-lg font-semibold leading-snug">
                  {s.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {s.body}
                </p>
                <p className="chb-mono-label text-pink-600 dark:text-pink-400">
                  {s.audience}
                </p>
                <p className="text-xs text-foreground/70 italic leading-snug">
                  {s.example}
                </p>
                <div className="mt-2">
                  <Link
                    href={s.cta.href}
                    className="chb-mono-label text-foreground hover:text-pink-500 inline-flex items-center gap-1 underline-offset-2 hover:underline"
                    data-testid={`walkthrough-step-${i + 1}-cta`}
                  >
                    <span>{s.cta.label}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-8 text-sm text-muted-foreground max-w-3xl">
          The chat in the corner is the meta-bot — same engine, same UI,
          same persona-scoped retrieval as the industry demos. Its corpus
          is just this site itself, so you can ask it{" "}
          <em>"how does this actually work?"</em> and get a grounded
          answer with citations.
        </p>
      </div>
    </section>
  );
}

function FeatureHighlights() {
  // Four-feature highlights strip. Friend-review pre-launch + code
  // review feedback: the previous Walkthrough mentioned NOSTR /
  // OpenClaw / in-browser inference / explicit bias only as nouns
  // inside Step 3 prose. They are the four architectural commitments
  // that distinguish Greater from a generic vendor chatbot, so they
  // each get their own card with a one-line "what it is + why" and
  // a direct link to the dedicated page.
  const features = [
    {
      icon: Zap,
      eyebrow: "In-browser inference",
      title: "WebGPU runs the model on the visitor's device.",
      body: "No per-message API tax, no vendor between you and your customers. Message content does not leave the tab.",
      cta: { label: "How it works", href: "/how-it-works" },
      testid: "feature-in-browser",
    },
    {
      icon: Sliders,
      eyebrow: "Explicit bias",
      title: "Every persona declares the perspective it speaks from.",
      body: "Customer view, founder view, member view — toggle mid-conversation. Pretending neutrality is the worse failure mode.",
      cta: { label: "Try the FinTech bias toggle", href: "/demo/fintech" },
      testid: "feature-bias-toggle",
    },
    {
      icon: Cpu,
      eyebrow: "OpenClaw",
      title: "Bring your own local LLM, route the chat through it.",
      body: "Already running a 7B-or-bigger model on the LAN? Configure once in settings; the data still doesn't leave your network.",
      cta: { label: "OpenClaw", href: "/openclaw" },
      testid: "feature-openclaw",
    },
    {
      icon: Radio,
      eyebrow: "NOSTR",
      title: "Sovereign distribution for the curated knowledge layer.",
      body: "Pipe manifests can be authored, versioned, and shipped over NOSTR — no platform gatekeeper between an operator and their bot.",
      cta: { label: "NOSTR", href: "/nostr" },
      testid: "feature-nostr",
    },
  ];
  return (
    <section
      id="features"
      className="border-b border-border bg-secondary/40"
      data-testid="section-feature-highlights"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-24 sm:py-32">
        <SectionHeader
          sigil="§ 03"
          label="Four commitments"
          lede={
            <>
              Each of these has a dedicated page with the engineering-grade
              detail. The summaries below are the one-line version.
            </>
          }
        >
          Where Greater is{" "}
          <span className="chb-serif-accent">architecturally different</span>{" "}
          from a vendor chatbot.
        </SectionHeader>
        {/*
          Editorial 2x2 — the "four commitments" deserve weight. The
          previous 4-up flat row gave each commitment one-quarter of a
          wide screen and turned them into a feature-tiles-with-icons
          row indistinguishable from any AI-template starter. The 2x2
          editorial grid gives each commitment double the column width,
          a hanging serif numeral, and a hairline cross divider in
          the middle. Reads as a magazine sidebar, not a CMS section.
        */}
        <div className="chb-editorial-grid chb-editorial-divided chb-cols-2 grid sm:grid-cols-2 gap-x-10 gap-y-10 mt-2">
          {features.map((f, i) => (
            <article
              key={f.eyebrow}
              className="chb-editorial-entry"
              data-testid={f.testid}
            >
              <span className="chb-numeral" aria-hidden="true">
                <em>0{i + 1}</em>
              </span>
              <div className="flex flex-col gap-3">
                <p className="chb-mono-eyebrow text-muted-foreground">
                  {f.eyebrow}
                </p>
                <h3 className="text-lg font-semibold leading-snug">
                  {f.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.body}
                </p>
                <div className="mt-1">
                  <Link
                    href={f.cta.href}
                    className="chb-mono-label text-foreground hover:text-pink-500 inline-flex items-center gap-1 underline-offset-2 hover:underline"
                    data-testid={`${f.testid}-cta`}
                  >
                    {f.cta.label}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CXCostSection() {
  // Friend-review feedback + Kyle's LinkedIn launch piece: Greater
  // is not just "another chatbot." The market is paying $55-$330
  // per seat + $50 AI add-on + $1-$2 every time a bot resolves an
  // issue. Greater runs in the visitor's browser, so resolution
  // economics are $0 — and the under-surfaced product features
  // (gear menu, support-ticket export) are what make that real.
  // Numbers below are sourced from Kyle's article scheduled for
  // publication and are intentionally cited as ranges, not specs.
  const vendors = [
    { name: "Zendesk Suite", seat: "$55–$115", ai: "$50 AI add-on", per: "$1.50 / resolution" },
    { name: "Intercom", seat: "$29–$132", ai: "—", per: "$0.99 / resolution" },
    { name: "HubSpot", seat: "$90–$150", ai: "—", per: "$1.00 / conversation" },
    { name: "Salesforce", seat: "$25–$330", ai: "—", per: "$2.00 / interaction" },
  ];
  const features = [
    {
      eyebrow: "The gear menu",
      title: "Where the bot's depth lives.",
      body: "Q&A bank, OpenClaw BYO-LLM toggle, persona bias toggle, theme switch — all one click into the chat's settings. The hint inside the bot points first-time visitors there. In your bot, this feature is easily hidden to elevate the customer experience.",
    },
    {
      eyebrow: "Support-ticket export",
      title: "ZenDesk-ready JSON, no per-seat tax.",
      body: "When the bot can't answer, it builds a redacted, locally-summarized ticket payload in the exact shape your helpdesk already accepts. The visitor stays anonymous; the agent gets context.",
      cta: { label: "See the export preview", href: "/demo/fintech/ticket" },
    },
    {
      eyebrow: "$0 / resolution",
      title: "CAC is $400–$15k. Bot resolutions should be free and high quality.",
      body: "Inference runs on the visitor's GPU. There is no per-message API cost to amortize against your acquisition spend, and no vendor sitting between you and your customers.",
    },
  ];
  return (
    <section
      id="cx-cost"
      className="border-b border-border"
      data-testid="section-cx-cost"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-24 sm:py-32">
        <SectionHeader
          sigil="§ 04"
          label="More than a chatbot"
          lede={
            <>
              Modern helpdesks have moved to outcome-based billing — you
              pay every time the AI does its job, and sometimes even when
              it doesn't (SalesForce). That bill scales with your success.
              Greater runs on the visitor's device, so the marginal cost
              of a resolution is zero.
            </>
          }
        >
          The vendor stack charges you a seat tax, an AI tax, and a{" "}
          <span className="chb-serif-accent">per-resolution tax.</span>{" "}
          Greater charges you{" "}
          <span className="text-pink-500">none of that</span>.
        </SectionHeader>

        <div
          className="rounded-xl border border-border bg-card overflow-hidden mb-10"
          data-testid="cx-cost-table"
        >
          <div className="grid grid-cols-12 px-4 sm:px-5 py-2.5 bg-secondary/60 border-b border-border chb-mono-eyebrow text-[11px] text-muted-foreground">
            <div className="col-span-4 sm:col-span-3">Provider</div>
            <div className="col-span-3 sm:col-span-3">Seat</div>
            <div className="hidden sm:block sm:col-span-3">AI add-on</div>
            <div className="col-span-5 sm:col-span-3">Per-event fee</div>
          </div>
          {vendors.map((v) => (
            <div
              key={v.name}
              className="grid grid-cols-12 items-center px-4 sm:px-5 py-3 border-b border-border last:border-b-0 text-sm"
              data-testid={`cx-cost-row-${v.name.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div className="col-span-4 sm:col-span-3 font-medium">
                {v.name}
              </div>
              <div className="col-span-3 sm:col-span-3 font-mono text-xs sm:text-sm">
                {v.seat}
                <span className="text-muted-foreground"> /seat·mo</span>
              </div>
              <div className="hidden sm:block sm:col-span-3 font-mono text-xs sm:text-sm text-muted-foreground">
                {v.ai}
              </div>
              <div className="col-span-5 sm:col-span-3 font-mono text-xs sm:text-sm">
                {v.per}
              </div>
            </div>
          ))}
          <div
            className="grid grid-cols-12 items-center px-4 sm:px-5 py-3 bg-pink-500/5 text-sm"
            data-testid="cx-cost-row-greater"
          >
            <div className="col-span-4 sm:col-span-3 font-semibold text-pink-600 dark:text-pink-400">
              Greater
            </div>
            <div className="col-span-3 sm:col-span-3 font-mono text-xs sm:text-sm">
              $0
              <span className="text-muted-foreground"> · MIT shell</span>
            </div>
            <div className="hidden sm:block sm:col-span-3 font-mono text-xs sm:text-sm text-muted-foreground">
              BYO local LLM (OpenClaw)
            </div>
            <div className="col-span-5 sm:col-span-3 font-mono text-xs sm:text-sm font-semibold">
              $0 / resolution
            </div>
          </div>
        </div>

        {/*
          Editorial three-up follow-on to the cost table. The pink
          eyebrow is the design element here (it's already varied:
          "The gear menu" / "Support-ticket export" / "$0 / resolution"),
          so we skip the numeral and use a thin pink em-dash mark in
          the gutter instead. Different treatment of the same primitive,
          chosen so §01/§02/§03/§04 don't all read as the same shape.
        */}
        <div className="chb-editorial-grid chb-editorial-divided chb-cols-2 grid sm:grid-cols-3 gap-x-8 gap-y-8 mt-2">
          {features.map((f) => (
            <article
              key={f.eyebrow}
              className="chb-editorial-entry"
              data-testid={`cx-cost-feature-${f.eyebrow.toLowerCase().replace(/\W+/g, "-")}`}
            >
              <span
                className="chb-numeral"
                aria-hidden="true"
                style={{ color: "#FE299E", opacity: 0.55, fontSize: "1.6rem", marginTop: "-0.05rem" }}
              >
                §
              </span>
              <div className="flex flex-col gap-2">
                <p className="chb-mono-eyebrow text-pink-600 dark:text-pink-400">
                  {f.eyebrow}
                </p>
                <h3 className="text-base font-semibold leading-snug">
                  {f.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.body}
                </p>
                {f.cta && (
                  <div className="mt-1">
                    <Link
                      href={f.cta.href}
                      className="chb-mono-label text-foreground hover:text-pink-500 inline-flex items-center gap-1 underline-offset-2 hover:underline"
                      data-testid={`cx-cost-feature-cta-${f.eyebrow.toLowerCase().replace(/\W+/g, "-")}`}
                    >
                      {f.cta.label}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>

        <p className="mt-8 text-sm text-muted-foreground max-w-3xl">
          If your CAC is $400–$15k per customer, the math on giving
          every visitor a knowledgeable bot for free is
          straightforward. <Link href="/contact" className="underline underline-offset-2 hover:text-pink-500">Get in touch</Link>{" "}
          if you want one tailored to your knowledge base.
        </p>
      </div>
    </section>
  );
}

function PersonasGrid() {
  // FinTech is the launch bot — full curated corpus, three bias
  // variants, real Bitcoin Q&A. It earns the wide hero card. The
  // other five are real-but-light demos in the same architecture
  // and live in a tighter secondary grid below. This intentionally
  // breaks the pre-launch "six identical cards" shape, which read
  // as "six interchangeable starters" — the friend-review note that
  // triggered this whole pass.
  const fintech = personas.find((p) => p.slug === "fintech");
  const others = personas.filter((p) => p.slug !== "fintech");
  return (
    <section id="personas" className="py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <SectionHeader
            sigil="§ 05"
            label="Six industries / six bots"
            lede={
              <>
                FinTech is the launch demo — a more fully curated
                multi-thousand-snippet corpus, a Q&amp;A bank, and three
                bias variants you can toggle mid-conversation. The other
                five are the same architecture running on a small seed
                corpus: real persona, real prompts, real refusal
                behaviour. Each card links to the case study for the
                substantive narrative; the demo button opens the bot
                itself. If you have a complex product ecosystem, you can
                maintain a core knowledge base for all products and then
                customize bot instances for each product.
              </>
            }
          >
            One launch bot,{" "}
            <span className="chb-serif-accent">five real-but-light</span>{" "}
            demos.
          </SectionHeader>
        </div>

        {fintech && (
          <div className="mb-8">
            <PersonaCard persona={fintech} featured />
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {others.map((p) => (
            <PersonaCard key={p.slug} persona={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
