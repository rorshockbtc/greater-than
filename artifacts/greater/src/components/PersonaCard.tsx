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

  // Status badge — editorial italic-serif with a leading color dot
  // instead of the previous tinted-rect "Demo available / Proprietary
  // · for hire" pills. The emerald variant in particular failed on
  // the cream surface; this version gets all its contrast from the
  // dot, so the type stays muted and the cards read as a magazine
  // grid rather than a status-pill grid.
  const pillLabel = featured
    ? "Live · full corpus"
    : hasPipe
      ? "Demo available"
      : "Proprietary · for hire";
  const dotColor = featured
    ? "hsl(328 99% 58%)"
    : hasPipe
      ? "hsl(160 70% 38%)"
      : "hsl(0 0% 55%)";

  return (
    <article
      className={cn(
        // Sharper corners + neutral border across all variants. The
        // previous featured pink-border tried to do the heavy lifting
        // for hierarchy and ended up competing with the brand pink in
        // the CTA. Hierarchy now comes from size + the brand-pink
        // eyebrow line, not chrome.
        "flex flex-col rounded-sm border border-card-border bg-card overflow-hidden",
        featured && "lg:flex-row",
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
            className="inline-flex items-center gap-1.5 self-start text-[0.78rem] italic text-muted-foreground"
            style={{ fontFamily: 'var(--font-serif)' }}
            data-testid={`badge-status-${persona.slug}`}
          >
            <span
              aria-hidden="true"
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: dotColor }}
            />
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
          <p
            className="mb-3 text-[0.82rem] italic"
            style={{ fontFamily: 'var(--font-serif)', color: 'hsl(328 99% 45%)' }}
          >
            Launch demo · {persona.name}
          </p>
        )}
        <h3
          className={cn(
            "font-semibold leading-snug mb-2 tracking-tight",
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

        {/* CTA row — sharper, more typographic. The primary action
            (Try Demo) is the only filled element on the card, sized
            to read as a button without the rounded-full quick-reply
            shape. The case-study action is a quiet underlined text
            link so the two CTAs no longer compete for the eye. */}
        <div className="mt-5 pt-4 border-t border-border flex flex-wrap items-center gap-x-5 gap-y-2 mt-auto">
          <Link
            href={demoHref}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm bg-primary text-primary-foreground text-[13px] font-medium hover-elevate active-elevate active:scale-[0.98]"
            data-testid={`link-card-demo-${persona.slug}`}
          >
            Try the demo
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href={`/bots/${persona.slug}`}
            className="inline-flex items-center gap-1 text-[13px] text-foreground/80 hover:text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground/60 transition-colors"
            data-testid={`link-card-case-${persona.slug}`}
          >
            Read the case study
            <ArrowRight className="w-3 h-3" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
