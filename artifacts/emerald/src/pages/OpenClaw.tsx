import { Link } from "wouter";
import { ArrowLeft, Check, Cpu, Hourglass, Rocket } from "lucide-react";
import { ContactCTASection } from "@/components/ContactCTASection";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/**
 * OpenClaw vision page.
 *
 * The shipped product today is the BYO-LLM toggle in the chat
 * widget — any visitor can point Greater at their own
 * OpenAI-compatible endpoint and stop Greater's cloud calls cold.
 * The 1–2 week and 6–10 week tiers describe what we'd build next
 * with sponsorship: a signed peer-to-peer handshake demo over
 * WebRTC, then a production-grade P2P inference mesh with
 * sandboxing, per-peer rate limiting, and optional Lightning
 * micro-settlement.
 */
export default function OpenClaw() {
  useDocumentTitle("OpenClaw");
  return (
    <>
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <Link
          href="/"
          className="chb-mono-label text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Home
        </Link>

        <p className="chb-mono-eyebrow text-muted-foreground mb-4">
          Open infrastructure
        </p>
        <h1 className="chb-serif-headline text-4xl sm:text-5xl leading-[1.1]">
          OpenClaw &mdash; the seam that keeps Greater honest.
        </h1>

        <div className="space-y-6 mt-10 text-base sm:text-lg text-foreground/85 leading-relaxed">
          <p>
            Most &ldquo;AI assistants&rdquo; want you to send your data
            to their servers, then trust the answer that comes back.
            Greater inverts that: the model runs in <em>your</em>{" "}
            browser, the corpus is loaded from a signed manifest, and
            the cloud is a fallback &mdash; not the default.
          </p>
          <p>
            OpenClaw is the integration that takes this one step
            further: it lets you replace Greater&rsquo;s in-browser
            model with <em>your own</em> local LLM. Today that means a
            small toggle in the chat widget. Tomorrow, with help, it
            means a peer-to-peer mesh: a friend or a hobbyist running
            a real GPU box can serve your inference over a signed
            WebRTC handshake, with no central relay and no SaaS
            middleman.
          </p>
        </div>

        {/* ---------------- Roadmap tiers ---------------- */}

        <section className="mt-16 grid gap-5">
          <Tier
            icon={<Check className="w-4 h-4" />}
            eyebrow="Today · shipped"
            title="Bring your own LLM endpoint"
            tone="ok"
          >
            <p>
              The chat widget already has an OpenClaw settings panel
              (Settings &rarr; <em>OpenClaw mode (BYO LLM)</em>). Point
              it at any OpenAI-compatible HTTP endpoint &mdash; Ollama,
              llama.cpp, LM Studio, vLLM, a colleague&rsquo;s shared
              vLLM box &mdash; and Greater starts routing every chat
              turn through it. No cloud call is made. Per-message
              badges in the transcript stay honest about which path
              served the answer.
            </p>
            <ul className="mt-3 space-y-1 text-[15px] text-foreground/80">
              <li className="flex gap-2">
                <span className="text-violet-400">&rsaquo;</span>
                Per-message OpenClaw badge so you can audit provenance.
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400">&rsaquo;</span>
                Settings persist to localStorage; nothing leaves your
                browser.
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400">&rsaquo;</span>
                Retrieval (RAG) still runs against the in-browser
                embedder, so your model answers grounded in the same
                snippets the in-browser model would have used.
              </li>
            </ul>
          </Tier>

          <Tier
            icon={<Hourglass className="w-4 h-4" />}
            eyebrow="1–2 weeks of work · with sponsorship"
            title="Signed peer-to-peer handshake demo"
            tone="next"
          >
            <p>
              The next step past &ldquo;BYO endpoint on your own
              machine&rdquo; is &ldquo;BYO endpoint shared with someone
              you trust.&rdquo; We&rsquo;d ship a small handshake
              protocol on top of WebRTC: each side publishes a
              public key, signs the SDP offer/answer, and a Greater
              client can route inference to a friend&rsquo;s
              llama.cpp box without either of you owning a public IP
              or paying for a relay.
            </p>
            <ul className="mt-3 space-y-1 text-[15px] text-foreground/80">
              <li className="flex gap-2">
                <span className="text-emerald-400">&rsaquo;</span>
                Published-key directory (just a static JSON file at
                first; no central server) + an in-widget invite link.
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400">&rsaquo;</span>
                Demo: two friends on different home networks, one
                running llama.cpp, the other querying it through
                Greater &mdash; with the handshake key visible in the
                provenance badge so the asker knows who served the
                answer.
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400">&rsaquo;</span>
                Falls back gracefully: if the peer is offline the
                widget reverts to the in-browser model (or the
                visitor&rsquo;s own OpenClaw endpoint).
              </li>
            </ul>
          </Tier>

          <Tier
            icon={<Rocket className="w-4 h-4" />}
            eyebrow="6–10 weeks of work · with sponsorship"
            title="Production P2P + optional Lightning settlement"
            tone="future"
          >
            <p>
              Hardening the handshake into something a stranger can
              safely run for you. That means real abuse handling on
              the serving side &mdash; per-asker request budgets,
              prompt-content sandboxing, output-token throttling,
              automatic disconnect on jailbreak attempts &mdash; and
              an optional Lightning channel for micro-settlement, so a
              hobbyist running a 70B box for the public can recoup
              electricity costs without standing up a full SaaS
              stack.
            </p>
            <ul className="mt-3 space-y-1 text-[15px] text-foreground/80">
              <li className="flex gap-2">
                <span className="text-foreground/40">&rsaquo;</span>
                Per-peer rate limiting and request-cost accounting.
              </li>
              <li className="flex gap-2">
                <span className="text-foreground/40">&rsaquo;</span>
                Sandboxed runner profile (resource caps, output
                length caps, kill switch).
              </li>
              <li className="flex gap-2">
                <span className="text-foreground/40">&rsaquo;</span>
                Optional Lightning settlement (pay-per-token via
                LN-URL); off by default so non-Bitcoin users get the
                rest of the stack for free.
              </li>
            </ul>
          </Tier>
        </section>

        {/* ---------------- Why this matters ---------------- */}

        <section className="mt-16 space-y-4 text-base sm:text-lg text-foreground/85 leading-relaxed">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Why the indirection matters
          </h2>
          <p>
            The default arrangement in AI today is: a vendor owns the
            model, owns the inference hardware, owns the network path
            between you and the model, and decides on your behalf
            what counts as an answer. Every step in that chain is a
            place where your question can be logged, your answer can
            be re-shaped, and your access can be revoked.
          </p>
          <p>
            OpenClaw is a small, practical attack on that chain. The
            BYO-LLM toggle that ships today moves the inference
            hardware back to the user. The P2P handshake on the
            roadmap moves the network path off vendor relays. The
            optional Lightning settlement layer means a stranger can
            serve your inference without either of you trusting a
            third-party billing system. None of this requires Greater
            to exist; the seams are all standard web primitives.
          </p>
        </section>

        {/* ---------------- How to try it ---------------- */}

        <section className="mt-12 rounded-lg border border-violet-500/30 bg-violet-500/5 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="w-4 h-4 text-violet-300" />
            <h3 className="text-lg font-semibold">
              Try OpenClaw mode in 60 seconds
            </h3>
          </div>
          <ol className="list-decimal pl-5 space-y-1 text-[15px] text-foreground/85">
            <li>
              Install <code className="font-mono text-sm">ollama</code>{" "}
              and run{" "}
              <code className="font-mono text-sm">
                ollama pull llama3.2:1b
              </code>
              .
            </li>
            <li>
              Start it with CORS enabled so the browser can reach it:
              <pre className="mt-1 mb-1 bg-black/40 border border-white/10 rounded p-2 text-[13px] font-mono overflow-x-auto">
                OLLAMA_ORIGINS=&quot;*&quot; ollama serve
              </pre>
            </li>
            <li>
              Open any demo bot, click the gear icon, choose{" "}
              <em>OpenClaw mode (BYO LLM)</em>, paste{" "}
              <code className="font-mono text-sm">
                http://localhost:11434/v1
              </code>
              , and hit <em>Test connection</em>.
            </li>
            <li>Flip the toggle on. The header badge turns violet.</li>
          </ol>
        </section>
      </article>

      <ContactCTASection tone="muted" />
    </>
  );
}

function Tier({
  icon,
  eyebrow,
  title,
  tone,
  children,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  tone: "ok" | "next" | "future";
  children: React.ReactNode;
}) {
  const ringColor =
    tone === "ok"
      ? "border-violet-500/40 bg-violet-500/[0.04]"
      : tone === "next"
        ? "border-emerald-500/30 bg-emerald-500/[0.03]"
        : "border-white/10 bg-white/[0.02]";
  const iconColor =
    tone === "ok"
      ? "text-violet-300 bg-violet-500/15 border-violet-500/30"
      : tone === "next"
        ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/30"
        : "text-foreground/70 bg-white/5 border-white/15";
  return (
    <div className={`rounded-lg border ${ringColor} p-6`}>
      <div className="flex items-start gap-4">
        <div
          className={`shrink-0 w-8 h-8 rounded-full border flex items-center justify-center ${iconColor}`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="chb-mono-eyebrow text-muted-foreground mb-1">
            {eyebrow}
          </p>
          <h3 className="text-xl sm:text-2xl font-semibold tracking-tight mb-3">
            {title}
          </h3>
          <div className="text-[15px] text-foreground/85 leading-relaxed space-y-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
