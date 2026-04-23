import React from "react";
import { ArrowRight } from "lucide-react";
import { useContact } from "@/components/ContactContext";

/**
 * Persistent "Interested in improving your support?" CTA section.
 * Required by the Greater spec to appear near every page's footer
 * (including the Blockstream demo route, which renders outside the
 * Greater Layout). Copy is exact per spec.
 */
export function ContactCTASection({ tone = "default" }: { tone?: "default" | "muted" }) {
  const { open } = useContact();
  const bg =
    tone === "muted"
      ? "bg-secondary/40 border-t border-border"
      : "bg-background border-t border-border";

  return (
    <section className={bg} data-testid="section-contact-cta">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="max-w-xl">
            <p className="chb-mono-eyebrow text-muted-foreground mb-2">
              Get in touch
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Interested in improving your support? Contact:
            </h2>
          </div>
          <button
            type="button"
            onClick={open}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover-elevate active-elevate self-start sm:self-auto"
            data-testid="button-cta-section-contact"
          >
            Open contact form
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
