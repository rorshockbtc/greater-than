import React from 'react';
import { Link } from 'wouter';
import { ArrowRight, ShieldAlert, Bitcoin, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ContactCTASection } from '@/components/ContactCTASection';
import { SkipToContent } from '@/components/SkipToContent';

/**
 * Landing page for the FinTech persona demo at /demo/fintech.
 *
 * Why this page exists
 * --------------------
 * The "Try the live demo" CTAs across the site used to dump visitors
 * directly into the Blockstream demo with no framing. Two problems:
 *
 *   1. Without context, the Blockstream support scenario reads as
 *      "a chat widget on a Bitcoin help page" — interesting, but the
 *      *business* hook (real CX failure → measurable rescue) is buried
 *      in a small intro modal that visitors dismiss.
 *
 *   2. The bot is grounded in a general Bitcoin knowledge bundle, not
 *      just Blockstream support content. It can answer Core/Knots,
 *      RBF, mempool policy, etc. — but the host page is so
 *      Blockstream-branded that visitors don't think to try those
 *      questions.
 *
 * This chooser fixes both: it leads with the origin story (the real
 * Blockstream Green wallet email that motivated the whole project),
 * then offers two doors into the same bot — one on a vendor support
 * page, one on a vendor-neutral wiki page. Same proprietary Bitcoin
 * bundle, same fintech persona, two different framings.
 */
export default function FintechChooser() {
  useDocumentTitle('FinTech Demo — Greater');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SkipToContent />

      {/* Top nav strip — Greater branding stays visible the entire
          time the visitor is on this page. The two demo destinations
          spoof other brands; this lander does not. */}
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Greater
          </Link>
          <span className="text-xs font-mono text-muted-foreground">
            persona: fintech &amp; bitcoin
          </span>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10">
          <p className="chb-mono-eyebrow text-primary mb-3">
            FinTech &amp; Bitcoin demo
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Pick where you want to see the bot.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-3xl">
            The same browser-local model is mounted on both pages. The only differences are the page chrome and the suggested questions. Try whichever framing speaks to you — or do both, the bot is identical.
          </p>
        </div>

        {/* Origin story — the failure mode that motivated the whole
            project. Framed as a CX bug with measurable business cost
            so the value prop reads to a buyer, not just a hobbyist. */}
        <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 mb-12">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-amber-500/10 text-amber-600 p-2.5 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold mb-3">
                Why this demo exists — the email that started Greater
              </h2>
              <div className="space-y-3 text-base text-muted-foreground leading-relaxed">
                <p>
                  In late 2025 a real Blockstream Green wallet user (me) got an "unauthorized login" notification email. The email's "Get help" link landed on an empty help-center page with a 1–2 business day support SLA. Holding a Bitcoin wallet you think might be compromised, while waiting two days for a human, is a bad customer experience and a worse trust event.
                </p>
                <p>
                  The original Blockstream-specific support bot was a one-weekend hack to fix that one page. Greater is what it grew into: an opinionated lead-gen platform that ships an industry-specific support bot to your help center, runs entirely in the visitor's browser, costs you zero per-query, and never phones home with their data. The Blockstream demo is preserved as the proof — exactly the failure that motivated it, with the rescue running live.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid sm:grid-cols-2 gap-6">
          <ChooserCard
            href="/demo/blockstream"
            accentClass="bg-emerald-500/10 text-emerald-600"
            icon={<ShieldAlert className="w-5 h-5" />}
            title="See it on Blockstream"
            subtitle="The original CX bug, fixed."
            body="A spoofed Blockstream Help Center 'unauthorized login' page — the one whose missing answer started this whole project. The bot is grounded in Blockstream Green and Jade docs and walks the panicked user through the freeze-account flow."
            ctaLabel="Open the Blockstream demo"
            testId="link-fintech-chooser-blockstream"
          />
          <ChooserCard
            href="/demo/bitcoin"
            accentClass="bg-orange-500/10 text-orange-600"
            icon={<Bitcoin className="w-5 h-5" />}
            title="See it on Bitcoin Info"
            subtitle="Same bot, vendor-neutral framing."
            body="A generic Bitcoin community wiki page about Bitcoin Core vs Knots. Same proprietary Bitcoin bundle, but the suggested prompts are about node policy, RBF, and mempool rules — to show the bot isn't a one-page Blockstream FAQ."
            ctaLabel="Open the Bitcoin Info demo"
            testId="link-fintech-chooser-bitcoin"
          />
        </div>
      </main>

      <ContactCTASection />
    </div>
  );
}

interface ChooserCardProps {
  href: string;
  accentClass: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  body: string;
  ctaLabel: string;
  testId: string;
}

function ChooserCard({
  href,
  accentClass,
  icon,
  title,
  subtitle,
  body,
  ctaLabel,
  testId,
}: ChooserCardProps) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-border bg-card p-6 hover-elevate active-elevate transition-shadow"
      data-testid={testId}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`rounded-lg p-2 ${accentClass}`}>{icon}</div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-tight">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">
        {body}
      </p>
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary group-hover:gap-2.5 transition-all">
        {ctaLabel}
        <ArrowRight className="w-4 h-4" />
      </span>
    </Link>
  );
}
