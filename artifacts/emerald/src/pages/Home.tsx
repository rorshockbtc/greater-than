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
              "linear-gradient(to bottom, hsl(var(--background)) 0%, hsl(var(--background) / 0.6) 40%, hsl(var(--background) / 0.2) 100%)",
          }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="chb-mono-eyebrow text-muted-foreground mb-6"
        >
          Greater &mdash; sovereign support bots, FOSS by default
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="chb-serif-headline text-4xl sm:text-6xl leading-[1.05] max-w-4xl"
        >
          Your customers deserve a chatbot that{" "}
          <span style={{ color: "#FE299E" }}>actually knows your business</span>.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12 }}
          className="text-lg sm:text-xl text-muted-foreground mt-6 max-w-2xl leading-relaxed"
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
          transition={{ duration: 0.5, delay: 0.18 }}
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
    </section>
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="mb-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="chb-mono-eyebrow text-muted-foreground mb-2">
              How it works
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight max-w-2xl">
              FOSS shell, in-browser inference, hired-out customization.
            </h2>
          </div>

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
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((it, i) => (
            <div
              key={it.title}
              className="flex flex-col gap-2"
              // Tiny, intentional asymmetry on the second card so the
              // grid doesn't read as machine-perfect. WCAG: rotation
              // is purely visual; no meaning is conveyed by it.
              style={i === 1 ? { transform: "translateY(6px) rotate(-0.3deg)" } : undefined}
            >
              <it.icon className="w-5 h-5" style={{ color: "#01a9f4" }} />
              <h3 className="text-sm font-semibold">{it.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{it.body}</p>
            </div>
          ))}
        </div>

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
      cta: { label: "OpenClaw &middot; NOSTR &middot; the Pipe", href: "/openclaw" },
    },
  ];
  return (
    <section
      id="walkthrough"
      className="border-b border-border"
      data-testid="section-walkthrough"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10 max-w-2xl">
          <p className="chb-mono-eyebrow text-muted-foreground mb-2">
            A 30-second tour
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Three things to do before you decide whether this is real.
          </h2>
          <p className="text-base text-muted-foreground mt-3">
            The shortest path from "another AI demo" to "okay, this is
            architecturally different."
          </p>
        </div>
        <ol className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {steps.map((s, i) => (
            <li
              key={s.eyebrow}
              className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-5"
              style={
                i === 1 ? { transform: "translateY(8px)" } : undefined
              }
              data-testid={`walkthrough-step-${i + 1}`}
            >
              <div className="flex items-center gap-2">
                <s.icon
                  className="w-5 h-5"
                  style={{ color: "#01a9f4" }}
                  aria-hidden="true"
                />
                <p className="chb-mono-eyebrow text-muted-foreground">
                  {s.eyebrow}
                </p>
              </div>
              <h3 className="text-lg font-semibold leading-snug">
                {s.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {s.body}
              </p>
              <p className="chb-mono-label text-[10px] text-pink-600 dark:text-pink-400">
                {s.audience}
              </p>
              <p className="text-xs text-foreground/70 italic leading-snug">
                {s.example}
              </p>
              <div className="mt-auto pt-2">
                <Link
                  href={s.cta.href}
                  className="chb-mono-label text-foreground hover:text-pink-500 inline-flex items-center gap-1 underline-offset-2 hover:underline"
                  data-testid={`walkthrough-step-${i + 1}-cta`}
                >
                  <span dangerouslySetInnerHTML={{ __html: s.cta.label }} />
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10 max-w-2xl">
          <p className="chb-mono-eyebrow text-muted-foreground mb-2">
            Four commitments
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Where Greater is architecturally different from a vendor chatbot.
          </h2>
          <p className="text-base text-muted-foreground mt-3">
            Each of these has a dedicated page with the
            engineering-grade detail. The summaries below are the
            one-line version.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f) => (
            <article
              key={f.eyebrow}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5"
              data-testid={f.testid}
            >
              <div className="flex items-center gap-2">
                <f.icon
                  className="w-5 h-5"
                  style={{ color: "#01a9f4" }}
                  aria-hidden="true"
                />
                <p className="chb-mono-eyebrow text-muted-foreground">
                  {f.eyebrow}
                </p>
              </div>
              <h3 className="text-base font-semibold leading-snug">
                {f.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {f.body}
              </p>
              <div className="mt-auto pt-2">
                <Link
                  href={f.cta.href}
                  className="chb-mono-label text-foreground hover:text-pink-500 inline-flex items-center gap-1 underline-offset-2 hover:underline"
                  data-testid={`${f.testid}-cta`}
                >
                  {f.cta.label}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </article>
          ))}
        </div>
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
          <p className="chb-mono-eyebrow text-muted-foreground mb-3">
            Six industries / six bots
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight max-w-3xl">
            One launch bot, five real-but-light demos.
          </h2>
          <p className="text-base text-muted-foreground mt-3 max-w-2xl">
            FinTech is the launch demo &mdash; a full curated multi-thousand-snippet
            corpus, a Q&amp;A bank, and three bias variants you can toggle
            mid-conversation. The other five are the same architecture
            running on a small seed corpus: real persona, real prompts,
            real refusal behaviour. Each card links to the case study
            for the substantive narrative; the demo button opens the
            bot itself.
          </p>
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
