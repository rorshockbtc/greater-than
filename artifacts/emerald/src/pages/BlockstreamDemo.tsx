import React, { useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ShieldAlert, Lock, KeyRound, Smartphone, AlertTriangle, ChevronRight, ExternalLink, CheckCircle2 } from 'lucide-react';
import { ChatWidget } from '@/components/ChatWidget';
import { ContactCTASection } from '@/components/ContactCTASection';
import { PipeProvider } from '@/pipes/PipeContext';
import { useLLM } from '@/llm/LLMProvider';

const sidebarLinks = [
  { label: "Unauthorized login activity", active: true },
  { label: "Recover a lost wallet" },
  { label: "Enable 2FA on your account" },
  { label: "Fix issues connecting Jade via USB" },
  { label: "Fix issues pairing Jade via Bluetooth" },
  { label: "Perform a factory reset" },
];

export default function Home() {
  // Load the proprietary Bitcoin knowledge bundle on mount. On a FOSS
  // fork the file is absent, the loader marks it 'absent' silently,
  // and this demo runs in Generic mode (visibly) with no Bitcoin
  // corpus. Hosted at hire.colonhyphenbracket.pink the bundle is
  // present and the chat widget shows the "Loading … bundle" banner.
  const llm = useLLM();
  useEffect(() => {
    llm.requestSeedBundle('bitcoin');
  }, [llm]);

  return (
    // PipeProvider scopes the active Pipe + bias to this demo route.
    // The Bitcoin Greater Pipe is keyed to persona='fintech'; if no
    // manifest is mounted under data/pipes/, the provider yields
    // pipe=null and the chat widget runs in Generic mode visibly.
    <PipeProvider persona="fintech">
    <div className="min-h-screen bg-white text-foreground flex flex-col">
      <nav className="bg-[#111316] text-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="15" stroke="#10B981" strokeWidth="2" />
                  <path d="M10 16.5L14.5 21L23 11" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
                <span className="font-bold text-lg tracking-tight">Blockstream</span>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
              <a href="https://blockstream.com/products" className="hover:text-white transition-colors">Products</a>
              <a href="https://blockstream.com/newsroom" className="hover:text-white transition-colors">Newsroom</a>
              <a href="https://blockstream.com/developers" className="hover:text-white transition-colors">Developers</a>
              <a href="https://blockstream.com/company" className="hover:text-white transition-colors">Company</a>
              <a href="https://store.blockstream.com" className="hover:text-white transition-colors">Store</a>
              <a href="https://help.blockstream.com" className="text-emerald-400 hover:text-emerald-300 transition-colors">Support</a>
            </div>
          </div>
        </div>
      </nav>

      <div className="border-b border-gray-200 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <a href="https://help.blockstream.com" className="text-emerald-600 hover:text-emerald-700 transition-colors">Blockstream Help Center</a>
            <ChevronRight className="w-3.5 h-3.5" />
            <a href="#" className="text-emerald-600 hover:text-emerald-700 transition-colors">Account Security</a>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-muted-foreground">Unauthorized login activity</span>
          </div>
        </div>
      </div>

      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex gap-12">
            <aside className="hidden lg:block w-64 shrink-0">
              <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">Account Security</h3>
              <nav className="space-y-1">
                {sidebarLinks.map((link) => (
                  <a
                    key={link.label}
                    href="#"
                    className={
                      link.active
                        ? "block text-sm py-2 px-3 rounded-lg bg-emerald-50 text-emerald-700 font-medium border border-emerald-100"
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
                  What to do when you receive an unauthorized login notification
                </h1>

                <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                  If you received an email indicating that someone logged in to your Blockstream account from an unfamiliar device or location, this guide will help you understand what happened and take the appropriate steps to protect your funds.
                </p>

                <div className="callout-note mb-8">
                  <p className="text-sm leading-relaxed">
                    <strong>Don't panic.</strong> Receiving a login notification does not necessarily mean your funds are at risk. Blockstream accounts are protected by multiple layers of security, and in many cases the activity is from a device or network you simply don't recognize at first.
                  </p>
                </div>

                <h2 className="text-2xl font-bold text-foreground mt-10 mb-4">
                  Step 1: Verify the login activity
                </h2>
                <p className="text-base text-muted-foreground leading-relaxed mb-4">
                  Before taking any action, review the details in the notification email:
                </p>
                <ul className="space-y-3 mb-8 ml-1">
                  <ListItem>Check the <strong>device name</strong> and <strong>operating system</strong> — it may be a device you use but don't immediately recognize (e.g., a work laptop, tablet, or new phone).</ListItem>
                  <ListItem>Check the <strong>IP address and location</strong> — VPNs and mobile networks can show unfamiliar locations even for legitimate logins.</ListItem>
                  <ListItem>Check the <strong>timestamp</strong> — does it correspond to a time you were actively using your account?</ListItem>
                </ul>

                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 mb-8">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800 mb-1">If you recognize the activity</p>
                      <p className="text-sm text-emerald-700/80">No further action is needed. These notifications are a normal part of Blockstream's security monitoring. You can review your active sessions at any time in your account settings.</p>
                    </div>
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-foreground mt-10 mb-4 flex items-center gap-3">
                  <ShieldAlert className="w-6 h-6 text-red-500" />
                  Step 2: If you don't recognize the login
                </h2>
                <p className="text-base text-muted-foreground leading-relaxed mb-6">
                  If you are unable to identify the login activity, take these steps <strong>immediately</strong> to secure your account:
                </p>

                <div className="space-y-4 mb-8">
                  <SecurityStep
                    number={1}
                    icon={Lock}
                    title="Freeze account operations"
                    description="Navigate to Settings > Security > Freeze Account. This will temporarily halt all withdrawals and sensitive account changes. Your funds remain safe and accessible once you unfreeze."
                  />
                  <SecurityStep
                    number={2}
                    icon={KeyRound}
                    title="Revoke all active sessions"
                    description="Go to Settings > Security > Active Sessions and click 'Revoke All.' This will log out every device currently connected to your account, including any unauthorized sessions."
                  />
                  <SecurityStep
                    number={3}
                    icon={Smartphone}
                    title="Reset your password and enable 2FA"
                    description="Change your password immediately and enable two-factor authentication (2FA) if it is not already active. We recommend using an authenticator app rather than SMS-based 2FA."
                  />
                </div>

                <div className="callout-note mb-8">
                  <p className="text-sm leading-relaxed">
                    <strong>Important:</strong> Never share your recovery phrase, PIN, or 2FA codes with anyone — including anyone claiming to be from Blockstream support. Our team will never ask for these credentials.
                  </p>
                </div>

                <h2 className="text-2xl font-bold text-foreground mt-10 mb-4">
                  Step 3: Review your transaction history
                </h2>
                <p className="text-base text-muted-foreground leading-relaxed mb-4">
                  After securing your account, check your recent transaction history in the Blockstream App or Green Wallet for any unauthorized activity:
                </p>
                <ul className="space-y-3 mb-8 ml-1">
                  <ListItem>Look for any transactions you don't recognize.</ListItem>
                  <ListItem>Check for any changes to your withdrawal addresses or whitelist settings.</ListItem>
                  <ListItem>Review any API key activity if you use the Blockstream API.</ListItem>
                </ul>

                <h2 className="text-2xl font-bold text-foreground mt-10 mb-4">
                  Still need help?
                </h2>
                <p className="text-base text-muted-foreground leading-relaxed mb-6">
                  If you believe your account has been compromised or you notice unauthorized transactions, contact our support team immediately. You can use the chat assistant in the bottom-right corner to get instant help, or reach out through our official support channels:
                </p>

                <div className="flex flex-wrap gap-3 mb-10">
                  <a
                    href="https://help.blockstream.com"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                  >
                    Contact Support
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href="https://help.blockstream.com/hc/en-us/categories/900000056183"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-foreground rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    View all security articles
                    <ChevronRight className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="border-t border-gray-200 pt-6 mt-10">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Last updated: March 2026</span>
                    <div className="flex items-center gap-1 text-emerald-600">
                      <span className="font-medium">Emerald Verified</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </article>
            </main>
          </div>
        </div>
      </div>

      <footer className="bg-[#111316] text-gray-400 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="15" stroke="#10B981" strokeWidth="2" />
                <path d="M10 16.5L14.5 21L23 11" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              <span className="text-gray-300 font-semibold">Blockstream</span>
            </div>
            <p>&copy; 2026 Blockstream Corporation Inc. — demo content for Greater portfolio purposes.</p>
          </div>
        </div>
      </footer>

      {/* Greater contact CTA — required on every page including the
          Blockstream demo route. Lives outside the Blockstream-branded
          chrome and uses Greater's CHB design tokens. */}
      <ContactCTASection />

      <ChatWidget />
    </div>
    </PipeProvider>
  );
}

function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
      <span className="text-base text-muted-foreground leading-relaxed">{children}</span>
    </li>
  );
}

function SecurityStep({ number, icon: Icon, title, description }: { number: number; icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex gap-4 p-5 bg-gray-50 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
        {number}
      </div>
      <div>
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-1.5">
          <Icon className="w-4 h-4 text-muted-foreground" />
          {title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
