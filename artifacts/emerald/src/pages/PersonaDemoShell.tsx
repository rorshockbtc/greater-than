import React, { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { ChatWidget } from "@/components/ChatWidget";
import { ContactCTASection } from "@/components/ContactCTASection";
import { ScenarioModal } from "@/components/ScenarioModal";
import { PipeProvider } from "@/pipes/PipeContext";
import { useLLM } from "@/llm/LLMProvider";
import { getPersona, type Persona } from "@/data/personas";
import NotFound from "@/pages/not-found";
import type { PipePersona } from "@workspace/pipes";

/**
 * Generic per-persona demo route. Wraps the Greater chat widget in a
 * believable mock host page (configured per-persona in `personas.ts`)
 * and triggers the persona-specific seed bundle to load on mount.
 *
 * Five of the six demos use this shell; FinTech keeps the bespoke
 * Blockstream-branded `BlockstreamDemo.tsx` because that is the
 * portfolio piece the rest of the marketing was built around.
 */
export default function PersonaDemoShell() {
  const [, params] = useRoute("/demo/:slug");
  const persona = params ? getPersona(params.slug) : undefined;

  if (!persona) return <NotFound />;
  // The FinTech persona has its own bespoke route — `App.tsx` should
  // route /demo/blockstream there before this component is reached,
  // but be defensive.
  if (!persona.scenario) return <NotFound />;

  return <PersonaDemoShellInner persona={persona} />;
}

function PersonaDemoShellInner({ persona }: { persona: Persona }) {
  const scenario = persona.scenario!;
  const llm = useLLM();
  const [showScenario, setShowScenario] = useState(true);

  // Each persona's seed bundle is loaded on demand. The FOSS fork
  // (which ships no /seeds/*.json) gets a 404 silently; the bundle
  // loader marks the slug "absent" so it won't keep re-checking.
  useEffect(() => {
    llm.requestSeedBundle(scenario.seedSlug);
  }, [llm, scenario.seedSlug]);

  return (
    <PipeProvider persona={persona.slug as PipePersona}>
      <div className="min-h-screen bg-white text-foreground flex flex-col">
        <MockNav persona={persona} />
        <MockBreadcrumb persona={persona} />

        <main className="flex-1">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <article>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight mb-5">
                {scenario.shell.articleTitle}
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed mb-10">
                {scenario.shell.articleLede}
              </p>

              <div className="space-y-8">
                {scenario.shell.articleSections.map((section) => (
                  <section key={section.heading}>
                    <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">
                      {section.heading}
                    </h2>
                    <p className="text-base text-muted-foreground leading-relaxed">
                      {section.body}
                    </p>
                  </section>
                ))}
              </div>

              <div className="mt-12 rounded-xl border border-gray-200 bg-gray-50/60 px-5 py-4 text-sm text-gray-700 leading-relaxed">
                <p className="mb-1">
                  <span className="font-semibold text-gray-900">
                    Have a specific question?
                  </span>{" "}
                  Use the assistant in the bottom-right corner. It runs in your
                  browser and quotes its sources.
                </p>
                <p className="text-xs text-gray-500">
                  This is a Greater portfolio demo. {scenario.shell.brand} is a
                  fictional company; the chat shell is real.
                </p>
              </div>
            </article>
          </div>
        </main>

        <MockFooter persona={persona} />

        {/* Greater contact CTA lives outside the mock host's chrome
            and uses Greater's CHB design tokens. Required on every
            demo page so the visitor knows how to engage. */}
        <ContactCTASection />

        <ScenarioModal
          open={showScenario}
          onClose={() => setShowScenario(false)}
          onTryPrompt={() => {
            setShowScenario(false);
            // Defer slightly so the chat widget has time to mount its
            // open animation. The persona-specific welcome appears
            // before the user's prefilled question lands.
            setTimeout(() => prefillChat(scenario.promptSuggestion), 250);
          }}
          scenario={scenario}
          brand={scenario.shell.brand}
          personaName={persona.name}
        />

        <ChatWidget
          welcomeMessage={scenario.welcome}
          placeholder={scenario.placeholder}
          bundleLabel={`${scenario.shell.brand} demo corpus`}
        />
      </div>
    </PipeProvider>
  );
}

/**
 * Open the chat widget and drop the suggested prompt into the input
 * box without sending. Done DOM-side because ChatWidget owns its own
 * input state and we don't want to invasively lift it; the data-testid
 * hooks already in the widget make this targeted and safe.
 */
function prefillChat(prompt: string) {
  // Click the closed-state floating button to open the widget.
  const openBtn = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Open chat"]',
  );
  openBtn?.click();
  // Wait one frame for the textarea to mount.
  requestAnimationFrame(() => {
    const ta = document.querySelector<HTMLTextAreaElement>(
      '.chat-widget textarea',
    );
    if (!ta) return;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    setter?.call(ta, prompt);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
  });
}

function MockNav({ persona }: { persona: Persona }) {
  const shell = persona.scenario!.shell;
  return (
    <nav className="bg-[#111316] text-white sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-md ${shell.accentBg} flex items-center justify-center font-bold text-sm`}
            >
              {shell.brand[0]}
            </div>
            <span className="font-bold text-lg tracking-tight">
              {shell.brand}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-gray-300">
            {shell.navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
          <Link
            href={`/bots/${persona.slug}`}
            className="text-[11px] font-mono text-white/50 hover:text-white/80 transition-colors hidden sm:inline-flex items-center gap-1.5"
          >
            &lt; back to Greater
          </Link>
        </div>
      </div>
    </nav>
  );
}

function MockBreadcrumb({ persona }: { persona: Persona }) {
  const crumbs = persona.scenario!.shell.breadcrumb;
  const accent = persona.scenario!.shell.accentText;
  return (
    <div className="border-b border-gray-200 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          {crumbs.map((crumb, i) => {
            const last = i === crumbs.length - 1;
            return (
              <React.Fragment key={`${crumb}-${i}`}>
                {i > 0 && <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                {last ? (
                  <span className="text-muted-foreground">{crumb}</span>
                ) : (
                  <a
                    href="#"
                    className={`${accent} hover:opacity-80 transition-opacity`}
                  >
                    {crumb}
                  </a>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MockFooter({ persona }: { persona: Persona }) {
  const shell = persona.scenario!.shell;
  return (
    <footer className="bg-[#111316] text-gray-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-5 h-5 rounded-sm ${shell.accentBg} flex items-center justify-center text-[10px] font-bold text-white`}
            >
              {shell.brand[0]}
            </div>
            <span className="text-gray-300 font-semibold">{shell.brand}</span>
          </div>
          <p className="text-xs text-gray-500 text-center sm:text-right">
            {shell.footerNote}
          </p>
        </div>
      </div>
    </footer>
  );
}
