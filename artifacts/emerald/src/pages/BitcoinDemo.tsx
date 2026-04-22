import React, { useEffect } from 'react';
import { Link } from 'wouter';
import { ChevronRight, ExternalLink, ArrowLeft, Info } from 'lucide-react';
import { ChatWidget } from '@/components/ChatWidget';
import { ContactCTASection } from '@/components/ContactCTASection';
import { SkipToContent } from '@/components/SkipToContent';
import { PipeProvider } from '@/pipes/PipeContext';
import { useLLM } from '@/llm/LLMProvider';
import { getPersona } from '@/data/personas';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { BITCOIN_CHARTER } from '@/data/harness/bitcoinCharter';

/**
 * Sibling demo to BlockstreamDemo: same fintech persona and same
 * proprietary Bitcoin knowledge bundle, mounted on a neutral
 * "Bitcoin community wiki" host page so visitors can see the bot
 * answering vendor-agnostic Bitcoin questions (Core vs Knots, mempool
 * policy, opt-in RBF, etc.) instead of Blockstream-specific support
 * questions. The chat widget itself is identical — only the suggested
 * prompts and the host chrome differ.
 */

const sidebarLinks = [
  { label: "Bitcoin Core vs Knots", active: true },
  { label: "Running a full node" },
  { label: "Replace-by-Fee (RBF) explained" },
  { label: "Mempool policy and relay rules" },
  { label: "Taproot and script upgrades" },
  { label: "Hardware wallets — what to look for" },
];

export default function BitcoinDemo() {
  useDocumentTitle("Bitcoin Core vs Bitcoin Knots — Bitcoin Info Wiki", {
    raw: true,
  });

  // Same proprietary Bitcoin bundle as the Blockstream demo. The
  // bundle is keyed to persona='fintech' and contains general Bitcoin
  // knowledge as well as Blockstream-specific docs; on this page we
  // surface the general side via the suggested prompts.
  const llm = useLLM();
  useEffect(() => {
    llm.requestSeedBundle('bitcoin');
  }, [llm]);

  // No pre-roll scenario modal here. The Blockstream demo opens with
  // the wallet-email failure-mode framing because that's where the
  // story lives; this vendor-neutral wiki page has its framing handled
  // upstream on the /demo/fintech chooser, so dropping a second modal
  // would be redundant and tonally wrong (the modal copy is
  // Blockstream-specific).
  const fintech = getPersona('fintech');
  const scenario = fintech?.scenario;

  return (
    <PipeProvider persona="fintech" personaDefaults={fintech?.defaultBias}>
      <div className="min-h-screen bg-white text-foreground flex flex-col">
        <SkipToContent />

        {/* Greater-branded back-pill above the spoofed host chrome.
            Made deliberately prominent (CHB pink, full-width strip)
            so visitors don't get marooned inside the demo and can
            always get back to the main Greater experience. */}
        <BackToGreaterStrip />

        <nav className="bg-[#F7931A] text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-2.5">
                <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
                  <circle cx="16" cy="16" r="15" fill="white" />
                  <text x="16" y="22" textAnchor="middle" fontSize="18" fontWeight="700" fill="#F7931A" fontFamily="serif">₿</text>
                </svg>
                <span className="font-bold text-lg tracking-tight">Bitcoin Info</span>
                <span className="text-xs font-mono text-white/70 hidden sm:inline ml-2">a community knowledge wiki</span>
              </div>
              <div className="hidden md:flex items-center gap-6 text-sm font-medium text-white/90">
                <a href="#" className="hover:text-white transition-colors">Articles</a>
                <a href="#" className="hover:text-white transition-colors">Glossary</a>
                <a href="#" className="hover:text-white transition-colors">Contribute</a>
              </div>
            </div>
          </div>
        </nav>

        <div id="main-content" tabIndex={-1} className="border-b border-gray-200 bg-gray-50/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <a href="#" className="text-[#F7931A] hover:text-[#d97c0a] transition-colors">Bitcoin Info Wiki</a>
              <ChevronRight className="w-3.5 h-3.5" />
              <a href="#" className="text-[#F7931A] hover:text-[#d97c0a] transition-colors">Node software</a>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-muted-foreground">Bitcoin Core vs Bitcoin Knots</span>
            </div>
          </div>
        </div>

        <div className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex gap-12">
              <aside className="hidden lg:block w-64 shrink-0">
                <h3 className="text-sm font-semibold text-foreground mb-4">Node software</h3>
                <nav className="space-y-1">
                  {sidebarLinks.map((link) => (
                    <a
                      key={link.label}
                      href="#"
                      className={
                        link.active
                          ? "block text-sm py-2 px-3 rounded-lg bg-orange-50 text-[#d97c0a] font-medium border border-orange-100"
                          : "block text-sm py-2 px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-gray-50 transition-colors"
                      }
                    >
                      {link.label}
                    </a>
                  ))}
                </nav>
              </aside>

              <main className="flex-1 min-w-0 max-w-3xl">
                <article>
                  <h1 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight mb-6">
                    Bitcoin Core vs Bitcoin Knots — what's the difference?
                  </h1>

                  <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                    Bitcoin Core is the reference implementation of the Bitcoin protocol — the codebase most full nodes on the network run today. Bitcoin Knots is a downstream fork that ships with a stricter mempool policy and a few additional features. Both produce the same blockchain. The difference is what each node will <em>relay and mine</em>, not what it considers valid.
                  </p>

                  <div className="callout-note mb-8">
                    <p className="text-sm leading-relaxed">
                      <strong>Use the chat assistant in the bottom-right</strong> to ask follow-ups about node policy, RBF, OP_RETURN limits, or anything else covered by the Bitcoin knowledge bundle. The bot runs entirely in your browser and is grounded in a curated corpus — it will tell you when a question falls outside what it knows.
                    </p>
                  </div>

                  <h2 className="text-2xl font-bold text-foreground mt-10 mb-4">
                    The short version
                  </h2>
                  <ul className="space-y-3 mb-8 ml-1">
                    <ListItem><strong>Same consensus rules.</strong> A block valid to Core is valid to Knots and vice versa. Neither implementation can fork the chain on its own.</ListItem>
                    <ListItem><strong>Different relay/mempool policy.</strong> Knots ships with stricter defaults — for example, lower OP_RETURN size limits and tighter standardness rules around inscription-style transactions.</ListItem>
                    <ListItem><strong>Different release cadence.</strong> Knots is maintained by a small team and tracks Core upstream, applying its policy patches on top.</ListItem>
                  </ul>

                  <h2 className="text-2xl font-bold text-foreground mt-10 mb-4">
                    Why the distinction matters
                  </h2>
                  <p className="text-base text-muted-foreground leading-relaxed mb-4">
                    Mempool and relay policy is how the network expresses social preference about what kinds of transactions get propagated and mined. Two reasonable people can disagree about whether ordinals-style data inscriptions are spam, fee-paying users, or both — and the policy debate has gotten heated. If you run a node, the implementation you choose is one of the few direct levers you have on that policy.
                  </p>
                  <p className="text-base text-muted-foreground leading-relaxed mb-8">
                    None of this affects custody, wallet compatibility, or the validity of your coins. Both implementations follow the same consensus rules; the disagreement is about what's neighborly to forward to your peers, not about what's valid.
                  </p>

                  <h2 className="text-2xl font-bold text-foreground mt-10 mb-4">
                    Want to know more?
                  </h2>
                  <p className="text-base text-muted-foreground leading-relaxed mb-6">
                    Try asking the chat assistant: "What's opt-in RBF?", "How does mempool policy differ from consensus?", or "Should I run my own node?". The bot is grounded in the same Bitcoin knowledge bundle that powers the Blockstream support demo — only the framing of this page is different.
                  </p>

                  <div className="flex flex-wrap gap-3 mb-10">
                    <a
                      href="https://bitcoincore.org"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#F7931A] text-white rounded-lg text-sm font-medium hover:bg-[#d97c0a] transition-colors"
                    >
                      bitcoincore.org
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href="https://bitcoinknots.org"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-foreground rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      bitcoinknots.org
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="border-t border-gray-200 pt-6 mt-10">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Last updated: April 2026</span>
                      <div className="flex items-center gap-1.5 text-[#d97c0a]">
                        <Info className="w-4 h-4" />
                        <span className="font-medium">Community-maintained</span>
                      </div>
                    </div>
                  </div>
                </article>
              </main>
            </div>
          </div>
        </div>

        <footer className="bg-gray-900 text-gray-400 text-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden="true">
                  <circle cx="16" cy="16" r="15" fill="#F7931A" />
                  <text x="16" y="22" textAnchor="middle" fontSize="18" fontWeight="700" fill="white" fontFamily="serif">₿</text>
                </svg>
                <span className="text-gray-300 font-semibold">Bitcoin Info</span>
              </div>
              <p>Demo content for the Greater portfolio — not affiliated with any Bitcoin project.</p>
            </div>
          </div>
        </footer>

        <ContactCTASection />

        <ChatWidget
          routeSlug="bitcoin"
          personaSlug="fintech"
          personaBrand="Bitcoin Info"
          personaSystemPrompt={scenario?.systemPrompt}
          defaultHarnessText={BITCOIN_CHARTER}
          personaExampleTopics={[
            'Differences between Bitcoin Core and Knots',
            'Mempool policy vs consensus rules',
            'Opt-in Replace-by-Fee (RBF)',
            'Running your own full node',
          ]}
          // Override the Blockstream-specific suggested prompts with
          // vendor-neutral Bitcoin questions appropriate to a generic
          // wiki host. The bot itself is unchanged.
          suggestedPrompts={[
            "What's the difference between Core and Knots?",
            "What is opt-in RBF?",
            "Should I run my own full node?",
            "What are mempool policy rules?",
          ]}
        />
      </div>
    </PipeProvider>
  );
}

function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-base text-muted-foreground leading-relaxed">
      <span className="text-[#F7931A] mt-1.5 shrink-0">•</span>
      <span>{children}</span>
    </li>
  );
}

/**
 * Greater-branded sticky strip above the spoofed host chrome. Uses
 * Greater's CHB pink so it's visually distinct from the host (which
 * is the whole point: visitors must always know they're inside a
 * Greater portfolio demo and can get back).
 */
function BackToGreaterStrip() {
  return (
    <div className="bg-[hsl(330,80%,60%)] text-white text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-4">
        <Link
          href="/demo/fintech"
          className="inline-flex items-center gap-2 font-medium hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Greater
        </Link>
        <span className="hidden sm:inline text-white/80 text-xs font-mono">
          You're in a Greater portfolio demo — the chat widget is the real product.
        </span>
      </div>
    </div>
  );
}
