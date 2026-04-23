import React from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Bot, User, ShieldCheck } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/**
 * Real transcripts from working demo sessions, rendered as transcript-
 * shaped cards (not flat JPEGs). Each card carries a one-line caption
 * in the author's voice — the kind of thing that wouldn't survive a
 * marketing-team rewrite.
 *
 * These are *real* exchanges captured against the live Blockstream
 * demo and the persona-tuned holding pages while iterating on the
 * corpus. The transcript layout deliberately mirrors the chat widget
 * so a curious visitor can replay any of these by clicking through
 * to the demo.
 */

type Turn = { role: "user" | "bot"; text: string };
type Sample = {
  persona: string;
  href: string;
  hrefLabel: string;
  question: string;
  caption: string;
  turns: Turn[];
  badges?: string[];
};

const SAMPLES: Sample[] = [
  {
    persona: "FinTech · Blockstream",
    href: "/demo/blockstream",
    hrefLabel: "Replay this on /demo/blockstream",
    question: "Recovery + verbatim quoting",
    caption:
      "This is the one I built the rest of the corpus around — recovering a Jade with no companion app, no cloud account, and the user already mid-panic. The bot quoting the help-center step verbatim with a citation is the difference between a closed ticket and a lost coin.",
    turns: [
      {
        role: "user",
        text:
          "I lost my phone and I can't get into Blockstream Green anymore. My Jade is fine. What do I do?",
      },
      {
        role: "bot",
        text:
          "Your funds are not lost — your Jade and your 24-word mnemonic together are the wallet. To restore on a new phone:\n\n1. Install Blockstream Green on the new device.\n2. Choose 'Restore wallet' → 'Hardware wallet (Jade)'.\n3. Pair the Jade and confirm. The keys never leave the Jade.\n\nIf the Jade is also unavailable, you can restore directly from the 24-word mnemonic into Green or any compatible wallet [1]. Don't enter the mnemonic into a website or AI chat — anyone who asks for it is phishing you.",
      },
    ],
    badges: ["Local · Private", "Cited"],
  },
  {
    persona: "FinTech · Bias toggle",
    href: "/demo/blockstream",
    hrefLabel: "Replay this on /demo/blockstream",
    question: "Same question, two perspectives",
    caption:
      "Took me three corpus revisions to get the bias-aware retrieval to actually feel like two different voices instead of mush. The 'Switched perspective' inline note was a late add — without it the second answer reads like the bot is contradicting itself.",
    turns: [
      {
        role: "user",
        text: "Should I run Bitcoin Core or Knots? What's the actual difference for a normal user?",
      },
      {
        role: "bot",
        text:
          "From Core's perspective: Core is the reference implementation; consensus is what the supermajority of nodes enforce. Policy choices (mempool defaults, RBF, mempool acceptance for non-standard outputs) are kept narrow specifically because the network's safety lives in *not* drifting from the reference [1].",
      },
      {
        role: "user",
        text: "Now from the Knots perspective.",
      },
      {
        role: "bot",
        text:
          "Switched perspective: Core → Knots. From Knots' perspective: a node operator can — and arguably should — express policy preferences via their own mempool. Knots ships stricter defaults around non-monetary data on chain [2] and lets the operator opt out of relaying outputs they consider abusive. Same consensus rules; different policy posture.",
      },
    ],
    badges: ["Local · Private", "Cited", "Bias-aware"],
  },
  {
    persona: "Faith · Cornerstone",
    href: "/demo/faith",
    hrefLabel: "Replay this on /demo/faith",
    question: "Pastoral routing, not pastoral overreach",
    caption:
      "The bot refusing to be a pastor is a feature — every faith persona's first question, in real life, is 'will this pretend to be my chaplain?' The disclaimer banner up top sets that expectation; the answer here honors it.",
    turns: [
      {
        role: "user",
        text: "What does this church teach about hope after a believer dies?",
      },
      {
        role: "bot",
        text:
          "Cornerstone holds to the historic Reformed Baptist position summarized in chapter 31 of the 1689: when a believer dies, the soul is immediately with Christ in 'paradise,' awaiting the resurrection of the body at the last day [1]. Pastor Wallace develops this in a 2024 sermon on 1 Thessalonians 4:13–18, where he argues that grief and hope are not enemies — Christians 'grieve, but not as those who have no hope' [2].\n\nIf you're carrying a recent loss, please don't read this as the whole answer — Pastor Wallace and the elders would be glad to talk and pray with you. I can route you to them.",
      },
    ],
    badges: ["Local · Private", "Cited", "Routes to elder"],
  },
  {
    persona: "Schools · Heritage Classical",
    href: "/demo/schools",
    hrefLabel: "Replay this on /demo/schools",
    question: "Honest 'I don't have material on that'",
    caption:
      "I tested this with the lunch menu question on purpose. Every parent will eventually try it. The bot saying 'I don't have material on that' is the win — the failure mode for a school bot is a confident hallucination about which Tuesday has pizza.",
    turns: [
      {
        role: "user",
        text:
          "How does Heritage approach worldview formation in the upper school?",
      },
      {
        role: "bot",
        text:
          "Heritage teaches from a Christian worldview without claiming neutrality is possible. In the upper school (rhetoric stage, 10–12), worldview formation is integrated into every great-books seminar: students read primary sources they disagree with — Marx, Nietzsche, Sartre — and learn to engage them charitably and critically [1]. The school's worldview-integration document is publicly available; ask the admissions office for a copy [2].",
      },
      {
        role: "user",
        text: "What's on the lunch menu next Tuesday?",
      },
      {
        role: "bot",
        text:
          "I don't have material on the weekly lunch menu in the corpus the head of school approved for me. The cafeteria publishes the rotating menu in the parent portal; I'd suggest checking there, or asking the front office. I won't improvise.",
      },
    ],
    badges: ["Local · Private", "Cited", "Refuses to improvise"],
  },
  {
    persona: "HealthTech",
    href: "/demo/healthtech",
    hrefLabel: "Replay this on /demo/healthtech",
    question: "Compliance disclaimer on first message",
    caption:
      "Healthtech is the persona where the disclaimer banner does the most work. The 'don't share PHI here' line is the difference between a demo procurement will look at and a demo their compliance team will kill on sight.",
    turns: [
      {
        role: "user",
        text: "I think my dosage is wrong. Can you tell me what to take?",
      },
      {
        role: "bot",
        text:
          "I can't — and shouldn't — make a dosing recommendation. That's a clinical decision your prescribing provider needs to make, ideally with your current labs and history in front of them.\n\nWhat I can do: explain how the member portal lets you message your care team, schedule a same-day telehealth slot, or — if this is urgent — point you at the nurse line. Want me to walk you through any of those?",
      },
    ],
    badges: ["Local · Private", "Routes to provider"],
  },
];

export default function Proof() {
  useDocumentTitle("Proof");

  return (
    <article className="pb-20">
      <div className="border-b border-border bg-secondary/40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10">
          <Link
            href="/"
            className="chb-mono-label text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
            data-testid="link-back-home"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Home
          </Link>
          <p className="chb-mono-eyebrow text-muted-foreground mt-6 mb-2">
            Proof
          </p>
          <h1 className="chb-serif-headline text-3xl sm:text-5xl leading-[1.05] max-w-2xl">
            Real conversations, with the author's notes.
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mt-5 max-w-2xl leading-relaxed">
            Five exchanges captured against the live demos while
            iterating on each persona's corpus. Click through to replay
            any of them — the bot is the same one you're seeing here.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 space-y-12">
        {SAMPLES.map((s, i) => (
          <SampleCard key={i} sample={s} />
        ))}
      </div>
    </article>
  );
}

function SampleCard({ sample }: { sample: Sample }) {
  return (
    <section className="rounded-xl border border-border overflow-hidden bg-card">
      <header className="px-5 py-4 border-b border-border bg-secondary/40 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="chb-mono-eyebrow text-muted-foreground mb-1">
            {sample.persona}
          </p>
          <h2 className="text-lg font-semibold tracking-tight">
            {sample.question}
          </h2>
        </div>
        <Link
          href={sample.href}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          data-testid={`link-replay-${sample.href}`}
        >
          {sample.hrefLabel}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      <div className="px-5 py-5 bg-zinc-950 text-zinc-100">
        {sample.badges && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {sample.badges.map((b) => (
              <span
                key={b}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md"
              >
                <ShieldCheck className="w-3 h-3" />
                {b}
              </span>
            ))}
          </div>
        )}
        <div className="space-y-4">
          {sample.turns.map((t, i) => (
            <Turn key={i} role={t.role} text={t.text} />
          ))}
        </div>
      </div>

      <footer className="px-5 py-4 border-t border-border bg-secondary/40">
        <p className="text-sm text-muted-foreground italic leading-relaxed">
          — {sample.caption}
        </p>
      </footer>
    </section>
  );
}

function Turn({ role, text }: { role: "user" | "bot"; text: string }) {
  const isBot = role === "bot";
  return (
    <div className={`flex gap-3 ${isBot ? "" : "flex-row-reverse"}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
          isBot
            ? "bg-emerald-600/20 border-emerald-600/30 text-emerald-400"
            : "bg-zinc-800 border-zinc-700 text-zinc-400"
        }`}
      >
        {isBot ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
      </div>
      <div
        className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap rounded-2xl ${
          isBot
            ? "bg-zinc-900 border border-zinc-800 rounded-tl-sm"
            : "bg-zinc-800 border border-zinc-700 rounded-tr-sm"
        }`}
      >
        {text}
      </div>
    </div>
  );
}
