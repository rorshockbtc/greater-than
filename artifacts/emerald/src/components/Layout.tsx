import React from "react";
import { Link, useLocation } from "wouter";
import { Home as HomeIcon, Layers, Info, MessageSquare, Github } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useContact } from "@/components/ContactContext";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/about", label: "About" },
  { href: "/openclaw", label: "OpenClaw" },
];

/**
 * Format the build timestamp injected by `vite.config.ts` `define`.
 * Surfaced in the footer so a curious visitor can see when the bundle
 * they're running was actually compiled — a small "real human pushed
 * this" cue in real markup.
 */
function formatBuildStamp(): { date: string; iso: string } {
  const iso =
    typeof __BUILD_TIMESTAMP__ === "string"
      ? __BUILD_TIMESTAMP__
      : new Date().toISOString();
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return { date, iso };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { open: openContact } = useContact();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Skip-to-content link — visually hidden until focused. WCAG 2.4.1. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:text-sm"
      >
        Skip to content
      </a>

      <Header location={location} onContact={openContact} />

      <main id="main-content" className="flex-1 pb-20 md:pb-0" tabIndex={-1}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer onContact={openContact} />

      <BottomNav location={location} onContact={openContact} />
    </div>
  );
}

/**
 * Inline X (formerly Twitter) glyph. Lucide does not ship one; the
 * brand asset is a simple two-stroke wordmark we can render as a
 * lightweight inline SVG to keep the bundle small.
 */
function XIcon({ className, ...rest }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      {...rest}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

function ChbWordmark({ className }: { className?: string }) {
  return (
    <a
      href="https://colonhyphenbracket.pink"
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        "inline-flex items-baseline gap-1 select-none hover:opacity-80 transition-opacity",
        className,
      )}
      data-testid="link-footer-chb-mark"
    >
      <span
        className="chb-display text-base leading-none"
        style={{ color: "#FE299E" }}
        aria-hidden="true"
      >
        :-]
      </span>
      <span className="chb-mono-label text-foreground/80">
        colonhyphenbracket
      </span>
    </a>
  );
}

function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("inline-flex items-baseline gap-1 select-none", className)}
      data-testid="link-wordmark"
    >
      <span
        className="chb-display text-2xl leading-none"
        style={{ color: "#FE299E" }}
        aria-hidden="true"
      >
        &gt;
      </span>
      <span className="font-semibold text-base tracking-tight">greater</span>
    </Link>
  );
}

function Header({
  location,
  onContact,
}: {
  location: string;
  onContact: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-background/75 border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Wordmark />

          <nav className="hidden md:flex items-center gap-7" aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/" ? location === "/" : location.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "chb-mono-label transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                  data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {item.label}
                </Link>
              );
            })}
            <Button
              size="sm"
              onClick={onContact}
              className="rounded-full active:scale-[0.97]"
              data-testid="button-nav-contact"
            >
              Contact
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
}

function BottomNav({
  location,
  onContact,
}: {
  location: string;
  onContact: () => void;
}) {
  const items: { href: string; label: string; icon: typeof HomeIcon }[] = [
    { href: "/", label: "Home", icon: HomeIcon },
    { href: "/#personas", label: "Bots", icon: Layers },
    { href: "/about", label: "About", icon: Info },
  ];
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/90 backdrop-blur border-t border-border"
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch justify-around h-14">
        {items.map((it) => {
          const active =
            it.href === "/"
              ? location === "/"
              : it.href.startsWith("/#")
                ? false
                : location.startsWith(it.href);
          return (
            <Link
              key={it.label}
              href={it.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 hover-elevate active-elevate",
                active ? "text-foreground" : "text-muted-foreground",
              )}
              data-testid={`link-bottomnav-${it.label.toLowerCase()}`}
            >
              <it.icon className="w-5 h-5" />
              <span className="chb-mono-label text-[10px] tracking-[0.18em]">
                {it.label}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onContact}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover-elevate active-elevate"
          data-testid="button-bottomnav-contact"
        >
          <MessageSquare className="w-5 h-5" style={{ color: "#FE299E" }} />
          <span className="chb-mono-label text-[10px] tracking-[0.18em]">
            Contact
          </span>
        </button>
      </div>
    </nav>
  );
}

function Footer({ onContact }: { onContact: () => void }) {
  const { date, iso } = formatBuildStamp();

  return (
    <footer className="border-t border-border mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <Wordmark />
            <p className="text-sm text-muted-foreground mt-3 max-w-xs leading-relaxed">
              Sovereign-by-default support bots. FOSS shell, persona-tuned demos,
              fractional architecture for hire.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              Built by <ChbWordmark />.
            </p>
          </div>

          <div>
            <h4 className="chb-mono-label text-foreground mb-4">Project</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/about"
                  className="text-muted-foreground hover:text-foreground"
                >
                  About Greater
                </Link>
              </li>
              <li>
                <Link
                  href="/how-it-works"
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="link-footer-how-it-works"
                >
                  How it works
                </Link>
              </li>
              <li>
                <Link
                  href="/proof"
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="link-footer-proof"
                >
                  Proof &mdash; real chats
                </Link>
              </li>
              <li>
                <Link
                  href="/changelog"
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="link-footer-changelog"
                >
                  Changelog
                </Link>
              </li>
              <li>
                <Link
                  href="/compliance"
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="link-footer-compliance"
                >
                  Compliance
                </Link>
              </li>
              <li>
                <Link
                  href="/openclaw"
                  className="text-muted-foreground hover:text-foreground"
                >
                  OpenClaw
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/rorshockbtc/greater-than"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                  data-testid="link-footer-github-project"
                >
                  <Github className="w-3.5 h-3.5" aria-hidden="true" />
                  github.com/rorshockbtc/greater-than
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="chb-mono-label text-foreground mb-4">Get in touch</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://colonhyphenbracket.pink"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="link-footer-author-site"
                >
                  colonhyphenbracket.pink
                </a>
              </li>
              <li>
                <a
                  href="https://hire.colonhyphenbracket.pink"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="link-footer-hire"
                >
                  hire.colonhyphenbracket.pink
                </a>
              </li>
              <li>
                <a
                  href="https://x.com/RoRshockBTC"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                  data-testid="link-footer-x"
                >
                  <XIcon className="w-3 h-3" aria-hidden="true" />
                  @RoRshockBTC
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onContact}
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="button-footer-contact"
                >
                  Contact form
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row justify-between gap-3 text-xs text-muted-foreground">
          <p>&copy; 2026 colonhyphenbracket. FOSS &mdash; released under MIT.</p>
          <p
            className="font-mono"
            data-testid="text-build-stamp"
            title={iso}
          >
            v0.1 &middot; built {date} &middot; browser-local LLM &middot; no first-party analytics
          </p>
        </div>
      </div>
    </footer>
  );
}
