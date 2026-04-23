import React from "react";
import { motion } from "framer-motion";

/**
 * Word-by-word stagger reveal used by every page hero. Each word is
 * an `inline-block` so its translateY animates without disturbing
 * the line below it. Step is intentionally small (~40ms) so even a
 * long line completes well under a second and never feels like a
 * "look at me" moment. framer-motion's `MotionConfig reducedMotion`
 * (set in App.tsx) honors `prefers-reduced-motion` automatically.
 *
 * Accessibility: the visible spans should be aria-hidden and the
 * parent <h1>/<h2> should carry an aria-label with the canonical
 * text — otherwise screen readers concatenate the inline-block
 * spans into one unspaced word. See Home.tsx and Nostr.tsx for the
 * established pattern.
 */
export function WordStagger({
  text,
  delay = 0,
}: {
  text: string;
  delay?: number;
}) {
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
 * Magazine-cover hero used on every interior page (NOSTR, OpenClaw,
 * How it works, About). Scaled down from Home's 8.4rem display size
 * but kept in the same family: serif headline at clamp() scale, a
 * pink serif-italic break-line for the accent phrase, a small italic
 * eyebrow above, an optional vertical "edition" spine on the right
 * gutter.
 *
 * Deliberately NOT a small "eyebrow + bold-sans h1" treatment — that
 * was the standard interior-page pattern that read as a different
 * site from the magazine-cover home page.
 */
export function PageHero({
  eyebrow,
  edition,
  headline,
  accent,
  lede,
}: {
  /** Small italic-serif label above the headline. Sentence case. */
  eyebrow: string;
  /** Vertical spine on the right gutter. Print-magazine binding mark. */
  edition?: string;
  /** First half of the headline. Plain serif. */
  headline: string;
  /** Pink serif-italic phrase that breaks to its own line. */
  accent: string;
  /** Lede paragraph below. */
  lede: React.ReactNode;
}) {
  const fullHeadline = `${headline} ${accent}`;
  return (
    <header className="relative border-b border-border">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-16 pb-20 sm:pt-24 sm:pb-28">
        {/* Vertical edition spine — print-magazine binding mark. */}
        {edition && (
          <div
            aria-hidden="true"
            className="hidden lg:block absolute right-6 top-24 chb-mono-eyebrow text-foreground/45 select-none"
            style={{
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              letterSpacing: "0.02em",
            }}
          >
            {edition}
          </div>
        )}

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="chb-mono-eyebrow mb-6"
        >
          {eyebrow}
        </motion.p>

        <h1
          className="chb-serif-headline leading-[1.02] tracking-[-0.018em] max-w-[18ch]"
          style={{ fontSize: "clamp(2.2rem, 6.4vw, 5.6rem)" }}
          aria-label={fullHeadline}
        >
          <span aria-hidden="true">
            <WordStagger text={headline} />
          </span>
          <br />
          <motion.span
            aria-hidden="true"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.7,
              delay: 0.05 + headline.split(" ").length * 0.04,
              ease: [0.22, 0.61, 0.36, 1],
            }}
            className="font-serif italic"
            style={{ color: "#FE299E" }}
          >
            {accent}
          </motion.span>
        </h1>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            delay: 0.2 + fullHeadline.split(" ").length * 0.04,
          }}
          className="mt-8 max-w-2xl text-base sm:text-lg leading-relaxed text-foreground/80"
        >
          {lede}
        </motion.div>
      </div>
    </header>
  );
}

/* Note: a shared EditorialSectionHeader was prototyped here for use
   on interior pages, but on review the existing per-page section
   structures (h2 + paragraph) on Nostr/OpenClaw/HowItWorks already
   read correctly under the new chb-mono-eyebrow + chb-section-sigil
   typography. Re-introduce only when a second page actually needs
   the §-numeral + hairline opener — premature shared abstraction
   was creating dead-export drift. */
