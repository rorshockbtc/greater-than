/**
 * Lightweight regex-based intent classifier for the chat widget.
 *
 * The catalog walk is expensive AND noisy: every utterance gets
 * scored against every branch's `searchTerms`, and a one-word turn
 * like "hi" or "thanks" almost always lands on a real bitcoin leaf
 * by accident (a single token collision is enough). The user then
 * gets a wall of text about UTXOs in response to "how are you?".
 *
 * Solution: classify the utterance BEFORE the catalog walk. Anything
 * non-content (greeting, smalltalk, thanks, closing, meta-bot,
 * capability-probe) is handled by a short conversational reply and
 * never enters the catalog.
 *
 * The classifier is intentionally:
 *   - regex + keyword tables, no model dependency, < 5ms
 *   - returns MULTIPLE template skeletons per kind so the UI layer
 *     can pick (or have the model paraphrase) one — avoids the
 *     "talked to this bot before, I know exactly what it'll say" feel
 *   - confidence-scored so callers can fall back to the catalog
 *     when the signal is weak
 *
 * The "content" kind is the catch-all — anything that doesn't match a
 * conversational pattern is treated as a real question and routed
 * to the catalog/synthesis pipeline as before.
 */

export type IntentKind =
  | "greeting"
  | "smalltalk"
  | "thanks"
  | "closing"
  | "meta-bot"
  | "capability-probe"
  | "content";

export interface IntentResult {
  kind: IntentKind;
  /** 0..1 — how confident the classifier is in `kind`. */
  confidence: number;
  /**
   * Variation pool. For non-content kinds, the chat widget picks one
   * uniformly (or hands all of them to the small model with a
   * "rephrase one of these naturally" prompt) so the bot doesn't feel
   * like a switch statement.
   */
  templates: string[];
  /**
   * Optional one-line note — used by telemetry/debug views to show
   * why the classifier picked this bucket.
   */
  reason?: string;
}

/* ---------- Pattern tables ---------- */

const GREETING_RE =
  /^\s*(?:hi|hii+|hey+|heya|hello+|howdy|yo|sup|wassup|good\s+(?:morning|afternoon|evening)|hola|gm|gn)\b[\s.!,?]*$/i;

/**
 * Smalltalk — "how are you", "what's up", "are you a bot", and so on.
 * Distinct from greeting because the user is opening a conversational
 * thread, not just saying hi. Multiple patterns OR'd to keep this
 * one cheap and forgiving.
 */
const SMALLTALK_RES: RegExp[] = [
  /\bhow(?:'?s|\s+are)?\s+(?:you|things|it\s+going|life|your\s+day)\b/i,
  /\bhow(?:'?s|\s+is)\s+(?:everything|things)\s+going\b/i,
  /\bwhat'?s\s+up\b/i,
  /\bhow\s+do\s+you\s+do\b/i,
  /\bnice\s+to\s+(?:meet|see)\s+you\b/i,
];

const THANKS_RE =
  /^\s*(?:thanks(?:\s+(?:a\s+lot|so\s+much|much|man|dude))?|thank\s+you|ty|thx|appreciate(?:\s+it|\s+that)?|cheers|cool(?:\s+thanks)?|got\s+it|makes\s+sense|gotcha|that\s+helps?|nice|awesome|perfect|great)\b[\s.!,?]*$/i;

const CLOSING_RE =
  /^\s*(?:bye|goodbye|see\s+ya|see\s+you|cya|later|laters|peace|farewell|that'?s\s+all|i'?m\s+done|all\s+good\s+now|i'?m\s+good)\b[\s.!,?]*$/i;

/**
 * Meta-bot — "are you a bot", "are you AI", "what model is this",
 * "who built you". The user is asking about the bot itself, not
 * about its subject matter.
 */
const META_BOT_RES: RegExp[] = [
  /\bare\s+you\s+(?:a\s+)?(?:bot|robot|ai|human|real|person|chatbot|llm|model)\b/i,
  /\bwho\s+(?:made|built|created|trained|wrote|programmed)\s+you\b/i,
  /\bwhat\s+(?:model|llm|ai)\s+(?:are\s+you|is\s+this|do\s+you\s+use)\b/i,
  /\b(?:are\s+you\s+open[\s-]?source|is\s+this\s+open[\s-]?source)\b/i,
  /\b(?:what'?s\s+your\s+name|who\s+are\s+you)\b/i,
];

/**
 * Capability-probe — "what can you do", "what do you know about X",
 * "what topics do you cover". Distinct from a content question
 * because the user isn't asking the question yet, they're asking
 * what's askable. Best handled by surfacing the catalog's top-level
 * branches as chips, not by walking into one.
 */
const CAPABILITY_RES: RegExp[] = [
  /\bwhat\s+can\s+you\s+(?:do|help\s+(?:me\s+)?with|answer|tell\s+me\s+about)\b/i,
  /\bwhat\s+(?:do\s+you\s+know|topics?\s+do\s+you\s+cover|are\s+you\s+(?:good\s+at|able\s+to))\b/i,
  /\b(?:help|menu|topics|options|commands|categories|capabilities)\s*[?.!]*$/i,
  /\bwhat\s+(?:are|kinda|kind\s+of)\s+(?:your|the)\s+(?:topics?|subjects?|areas?)\b/i,
  /\bgive\s+me\s+(?:a\s+)?(?:list|menu|overview)\b/i,
];

/* ---------- Template pools ---------- */

const GREETING_TEMPLATES = [
  "Hey — what would you like to know about Bitcoin?",
  "Hi. Ask me anything about the protocol, the monetary case, mining, custody — what's on your mind?",
  "Hey there. What can I dig up for you?",
  "Hi — where would you like to start?",
];

const SMALLTALK_TEMPLATES = [
  "Doing fine. What's the question?",
  "All good on my end. What did you want to ask?",
  "Holding up. What can I help you with?",
  "Fine — fire away.",
];

const THANKS_TEMPLATES = [
  "Anytime. Anything else?",
  "Sure thing. Want to go deeper on anything?",
  "Glad it landed. Another question?",
  "Of course. Let me know if there's more.",
];

const CLOSING_TEMPLATES = [
  "Take care.",
  "Catch you later.",
  "Cheers — come back anytime.",
  "Sounds good. See you around.",
];

const META_BOT_TEMPLATES = [
  "I'm a small open-source chatbot that runs in your browser — no server inference, no data leaving your tab. The knowledge comes from a hand-curated catalog of bitcoin sources I draw on as needed.",
  "Local-first chatbot, runs on a tiny model in the browser via WebGPU. The substantive answers come from a curated catalog of bitcoin notes, not from the model's training data.",
  "Open-source, browser-only. The model is intentionally small (~90 MB) so it loads fast on mobile; depth comes from the catalog of sources behind it. There's an option to load a bigger model if you want sharper synthesis.",
];

const CAPABILITY_TEMPLATES = [
  "I cover Bitcoin from a few angles — pick one and I'll go deeper:",
  "Here's what I'm built to talk about. Tap one to dig in:",
  "These are the territories I know. Pick whichever's closest to your question:",
];

/* ---------- Classifier ---------- */

/**
 * Classify a single user utterance. Returns the highest-confidence
 * non-"content" match, or `{ kind: "content", confidence: 0 }` when
 * nothing matched (the catalog walk handles it from there).
 *
 * Order of checks matters slightly — greeting and thanks are
 * shortest and most distinctive, so they get first crack. Meta-bot
 * and capability probes can be longer and overlap with content
 * questions ("what do you know about UTXOs?" looks capability-y but
 * is really content), so they require explicit pattern matches that
 * don't fire on real content questions.
 */
export function classifyIntent(text: string): IntentResult {
  const t = text.trim();

  // Empty / one-character input — punt to content so the existing
  // empty-input handling stays in charge.
  if (t.length === 0) {
    return { kind: "content", confidence: 0, templates: [] };
  }

  // Capability probes that contain a topic noun ("what do you know
  // about lightning") are content, not capability. Detect by looking
  // for prepositional clauses after the probe verb.
  const looksLikeAboutQuestion = /\babout\s+\S/i.test(t);

  if (GREETING_RE.test(t)) {
    return {
      kind: "greeting",
      confidence: 0.95,
      templates: GREETING_TEMPLATES,
      reason: "matched greeting pattern",
    };
  }

  if (THANKS_RE.test(t)) {
    return {
      kind: "thanks",
      confidence: 0.95,
      templates: THANKS_TEMPLATES,
      reason: "matched thanks/acknowledgement pattern",
    };
  }

  if (CLOSING_RE.test(t)) {
    return {
      kind: "closing",
      confidence: 0.95,
      templates: CLOSING_TEMPLATES,
      reason: "matched closing pattern",
    };
  }

  for (const re of META_BOT_RES) {
    if (re.test(t)) {
      return {
        kind: "meta-bot",
        confidence: 0.9,
        templates: META_BOT_TEMPLATES,
        reason: `matched meta-bot pattern ${re}`,
      };
    }
  }

  if (!looksLikeAboutQuestion) {
    for (const re of CAPABILITY_RES) {
      if (re.test(t)) {
        return {
          kind: "capability-probe",
          confidence: 0.85,
          templates: CAPABILITY_TEMPLATES,
          reason: `matched capability pattern ${re}`,
        };
      }
    }
  }

  // Smalltalk last — its patterns are looser and we want the more
  // specific buckets above to win first.
  for (const re of SMALLTALK_RES) {
    if (re.test(t)) {
      return {
        kind: "smalltalk",
        confidence: 0.85,
        templates: SMALLTALK_TEMPLATES,
        reason: `matched smalltalk pattern ${re}`,
      };
    }
  }

  return { kind: "content", confidence: 0, templates: [] };
}

/**
 * Pick a template from the variation pool. Uses Math.random by
 * default; tests can pass a deterministic picker.
 */
export function pickTemplate(
  templates: string[],
  rng: () => number = Math.random,
): string {
  if (templates.length === 0) return "";
  const idx = Math.floor(rng() * templates.length);
  return templates[Math.min(idx, templates.length - 1)];
}
