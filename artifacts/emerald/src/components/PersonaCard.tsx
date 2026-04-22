import React, { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronUp, ChevronDown } from "lucide-react";
import { type Persona } from "@/data/personas";
import { isGreaterMode } from "@/pipes/registry";
import type { PipePersona } from "@workspace/pipes";
import { cn } from "@/lib/utils";

const BASE = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL;

/**
 * Persona card with a collapsible hero image and TWO pinned CTAs at
 * the bottom: "Try Demo" and "Read Case Study".
 *
 * `featured` renders the wider hero variant used for FinTech on the
 * homepage: image left, copy right at lg+, with a "Live · Full corpus"
 * pill instead of the secondary framing the others carry.
 *
 * Pill semantics:
 *  - featured (FinTech, Pipe loaded): "Live · Full corpus"
 *  - Pipe loaded, not featured: "Demo available"
 *  - No Pipe in FOSS shell: "Proprietary · for hire"
 *    These personas need a curated Pipe (corpus + adapters) that is
 *    not distributed with the open-source shell.
 */
export function PersonaCard({
  persona,
  featured = false,
}: {
  persona: Persona;
  featured?: boolean;
}) {
  const [imageOpen, setImageOpen] = useState(true);
  const hasPipe = isGreaterMode(persona.slug as PipePersona);
  const demoHref = `/demo/${persona.slug}`;

  const pillLabel = featured
    ? "Live · Full corpus"
    : hasPipe
      ? "Demo available"
      : "Proprietary · for hire";
  const pillClass = featured
    ? "text-pink-600 dark:text-pink-400 border-pink-500/40 bg-pink-500/5"
    : hasPipe
      ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/5"
      : "text-muted-foreground border-border bg-secondary/40";

  return (
    <article
      className={cn(
        "flex flex-col rounded-xl border bg-card overflow-hidden",
        featured ? "border-pink-500/30 lg:flex-row" : "border-card-border",
      )}
      data-testid={`card-persona-${persona.slug}`}
    >
      <div
        className={cn(
          "border-card-border",
          featured
            ? "lg:w-1/2 lg:border-r lg:border-b-0 border-b"
            : "border-b",
        )}
      >
        <button
          type="button"
          onClick={() => setImageOpen((v) => !v)}
          className="w-full flex flex-col gap-1.5 px-4 py-2.5 hover-elevate text-left"
          aria-expanded={imageOpen}
          data-testid={`button-toggle-image-${persona.slug}`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="chb-mono-label text-foreground leading-snug">
              {persona.shortName}
            </span>
            {imageOpen ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            )}
          </div>
          <span
            className={cn(
              "chb-mono-label px-1.5 py-0.5 rounded border self-start",
              pillClass,
            )}
            data-testid={`badge-status-${persona.slug}`}
          >
            {pillLabel}
          </span>
        </button>

        <AnimatePresence initial={false}>
          {imageOpen && (
            <motion.div
              key="hero"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden bg-secondary/50"
            >
              <div className={featured ? "aspect-[4/3] lg:aspect-auto lg:h-full lg:min-h-[260px]" : "aspect-[16/9]"}>
                <img
                  src={`${BASE}${persona.heroImage}`}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={cn("p-5 flex-1 flex flex-col", featured && "lg:p-7")}>
        {featured && (
          <p className="chb-mono-eyebrow text-pink-600 dark:text-pink-400 mb-3">
            Launch demo · {persona.name}
          </p>
        )}
        <h3
          className={cn(
            "font-semibold leading-snug mb-2",
            featured ? "text-xl sm:text-2xl" : "text-lg",
          )}
        >
          {persona.tagline}
        </h3>
        <p
          className={cn(
            "text-muted-foreground leading-relaxed",
            featured ? "text-sm sm:text-base" : "text-sm line-clamp-3",
          )}
        >
          {persona.pain}
        </p>

        <div className="mt-5 pt-4 border-t border-border flex flex-wrap gap-2">
          <Link
            href={demoHref}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium hover-elevate active-elevate active:scale-[0.97]"
            data-testid={`link-card-demo-${persona.slug}`}
          >
            Try Demo
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href={`/bots/${persona.slug}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border text-xs font-medium hover-elevate active-elevate active:scale-[0.97]"
            data-testid={`link-card-case-${persona.slug}`}
          >
            Read Case Study
          </Link>
        </div>
      </div>
    </article>
  );
}
