import React, { useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useLLM } from "@/llm/LLMProvider";
import { ArrowRight, Lock, Cpu, FileText, AlertCircle, MessageSquare, Github } from "lucide-react";
import { personas } from "@/data/personas";
import { PersonaCard } from "@/components/PersonaCard";
import { ContactCTASection } from "@/components/ContactCTASection";
import { ChatWidget } from "@/components/ChatWidget";
import { PipeProvider } from "@/pipes/PipeContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import heroImage from "@/assets/greater-hero.png";
import { GREATER_META_BOT } from "@/data/greater-meta-bot";

export default function Home() {
  // Preserve the static index.html <title> on /.
  useDocumentTitle(null);
  // Queue the meta-bot seed bundle on mount, mirroring how
  // BlockstreamDemo + PersonaDemoShell trigger their own corpora.
  // The provider serializes installs behind the embedder readiness,
  // so it's safe to call before the model is loaded; effect re-runs
  // are de-duped by `installedBundleSlugsRef` inside the provider.
  const llm = useLLM();
  useEffect(() => {
    llm.requestSeedBundle("greater");
  }, [llm]);
  return (
    <>
      <Hero />
      <PrinciplesStrip />
      <PersonasGrid />
      <ContactCTASection tone="muted" />
      {/*
        Greater meta-bot — the dogfooding chat widget. Same engine,
        same UI, same persona-scoped retrieval as the industry demos;
        only the corpus and system prompt differ. Pinned bottom-right
        so visitors who land on the marketing page can ask "how does
        this actually work?" without leaving the page.
      */}
      {/*
        ChatWidget calls usePipe(), so it must mount inside a
        PipeProvider. The "greater" persona has no Pipe registered
        (and no persona-default bias) — getActivePipe returns null
        and the provider falls back to biasSource="none", which
        renders the widget without a bias selector. That's exactly
        what we want for the meta-bot: no toggles, just answers.
      */}
      <PipeProvider persona="greater">
        <ChatWidget
          personaSlug={GREATER_META_BOT.slug}
          personaBrand={GREATER_META_BOT.brand}
          personaSystemPrompt={GREATER_META_BOT.systemPrompt}
          refusalScope={GREATER_META_BOT.refusalScope}
          personaExampleTopics={[...GREATER_META_BOT.exampleTopics]}
          suggestedPrompts={[...GREATER_META_BOT.suggestedPrompts]}
          welcomeMessage={GREATER_META_BOT.welcome}
          placeholder={GREATER_META_BOT.placeholder}
          bundleLabel="Greater meta-bot corpus"
        />
      </PipeProvider>
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
            href="/demo/blockstream"
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

function PersonasGrid() {
  return (
    <section id="personas" className="py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <p className="chb-mono-eyebrow text-muted-foreground mb-3">
            Six industries / six bots
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight max-w-3xl">
            Each card is a real product surface, not a placeholder.
          </h2>
          <p className="text-base text-muted-foreground mt-3 max-w-2xl">
            One demo is wired live today (FinTech &mdash; the Blockstream bot).
            The other five are persona-tuned holding pages while we index their
            pilot corpora.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {personas.map((p) => (
            <PersonaCard key={p.slug} persona={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
