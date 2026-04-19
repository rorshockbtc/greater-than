import { Link } from "wouter";
import { ArrowLeft, Check, Cpu, Hourglass, Rocket } from "lucide-react";
import { ContactCTASection } from "@/components/ContactCTASection";

/**
 * OpenClaw vision page.
 *
 * The shipped product today is the BYO-LLM toggle in the chat
 * widget — any visitor can point Greater at their own
 * OpenAI-compatible endpoint and stop Greater's cloud calls cold.
 * The 1-2 week and 6-10 week tiers describe what we'd build next
 * with sponsorship: a hash-signed corpus catalog and a curator
 * incentive layer.
 */
export default function OpenClaw() {
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
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1]">
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
            means a public catalog of curated, hash-signed knowledge
            corpora &mdash; the deliberately-small alternative to
            &ldquo;ask the entire internet.&rdquo;
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
            title="Hash-signed corpus catalog"
            tone="next"
          >
            <p>
              A small public registry where curators publish signed
              manifests of knowledge corpora (a Bitcoin Core changelog
              digest, an FDA medical-device-recall feed, an
              SEC-filings index, &hellip;). Greater deployments fetch
              the manifest, verify the signature against the
              curator&rsquo;s published key, and load the corpus into
              the in-browser vector store. The shell already has the
              loader; what&rsquo;s missing is the catalog.
            </p>
            <ul className="mt-3 space-y-1 text-[15px] text-foreground/80">
              <li className="flex gap-2">
                <span className="text-emerald-400">&rsaquo;</span>
                Manifest schema (corpus URL, hash, curator key,
                version, license).
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400">&rsaquo;</span>
                Curator key directory + signing CLI.
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400">&rsaquo;</span>
                Hash verification at load time, surfaced in the
                widget&rsquo;s knowledge panel.
              </li>
            </ul>
          </Tier>

          <Tier
            icon={<Rocket className="w-4 h-4" />}
            eyebrow="6–10 weeks of work · with sponsorship"
            title="Curator incentive layer + dispute resolution"
            tone="future"
          >
            <p>
              The hard part is not the cryptography &mdash; it is the
              social layer. Who can publish? How do disputes about
              corpus accuracy get resolved? How do we avoid &ldquo;
              highest bidder wins&rdquo; while still rewarding the
              people doing the curation work? This tier is a
              spec-first effort: a published RFC, a reference
              implementation, and at least one launch curator per
              vertical (Bitcoin, healthcare, legal, insurance,
              fintech) wired up before public launch.
            </p>
          </Tier>
        </section>

        {/* ---------------- Why this matters ---------------- */}

        <section className="mt-16 space-y-4 text-base sm:text-lg text-foreground/85 leading-relaxed">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Why the indirection matters
          </h2>
          <p>
            The current AI ecosystem has two failure modes:
            vendor-mediated knowledge, where the corpus is hidden
            inside a black-box model, and ungoverned knowledge, where
            the corpus is &ldquo;the entire internet&rdquo; and the
            model averages it. Both are bad. OpenClaw proposes a third
            option: explicitly-curated, explicitly-attributed,
            explicitly-signed corpora that any application can pull
            from at runtime, and whose provenance is visible to the
            end user.
          </p>
          <p>
            The BYO-LLM toggle that ships today is the smallest
            possible version of the same principle: the user, not the
            vendor, decides what model is doing the inference.
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
