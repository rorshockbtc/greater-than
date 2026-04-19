import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Lock, Cpu, FileText, AlertCircle } from "lucide-react";
import { personas } from "@/data/personas";
import { PersonaCard } from "@/components/PersonaCard";
import { ContactCTASection } from "@/components/ContactCTASection";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function Home() {
  useDocumentTitle("");
  return (
    <>
      <Hero />
      <PrinciplesStrip />
      <PersonasGrid />
      <ContactCTASection tone="muted" />
    </>
  );
}

function Hero() {
  return (
    <section className="border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28">
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 flex flex-wrap gap-3"
        >
          <a
            href="#personas"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover-elevate active-elevate active:scale-[0.97]"
            data-testid="link-hero-personas"
          >
            See the six bots
            <ArrowRight className="w-4 h-4" />
          </a>
          <Link
            href="/about"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border text-sm font-medium hover-elevate active-elevate active:scale-[0.97]"
            data-testid="link-hero-about"
          >
            What is Greater?
          </Link>
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
    <section className="border-b border-border bg-secondary/40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="mb-8">
          <p className="chb-mono-eyebrow text-muted-foreground mb-2">
            How it works
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight max-w-2xl">
            FOSS shell, in-browser inference, hired-out customization.
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((it) => (
            <div key={it.title} className="flex flex-col gap-2">
              <it.icon className="w-5 h-5" style={{ color: "#01a9f4" }} />
              <h3 className="text-sm font-semibold">{it.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{it.body}</p>
            </div>
          ))}
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
