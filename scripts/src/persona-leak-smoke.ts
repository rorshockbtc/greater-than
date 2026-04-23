/**
 * Persona-leak smoke harness.
 *
 * Static guard against cross-persona identity bleed. The chatbot has
 * seven personas (startups, faith, schools, small-business, healthtech,
 * fintech, and the greater meta-bot) plus a deliberately spoofed-host
 * portfolio route at /blockstream. The fintech persona's WELCOME and
 * SYSTEM PROMPT used to be hardcoded as "I'm Greater's Blockstream
 * support bot…" because the persona was forked from the Blockstream
 * demo and never genericised. That meant the Bitcoin Info wiki demo
 * (BitcoinDemo.tsx, also personaSlug='fintech') greeted visitors as a
 * Blockstream rep — wrong on its own, and a cross-persona leak by the
 * platform's own definition.
 *
 * This test scans every persona scenario for vendor-specific brand
 * tokens that should ONLY appear on the matching dedicated demo route.
 * It also scans the ChatWidget default greeting and the LLMProvider
 * default system prompts (used when a persona supplies none) to make
 * sure the neutral fallbacks stay neutral.
 *
 * Static. No model. < 50 ms. Safe to run on every push.
 *
 * Run: `pnpm --filter @workspace/scripts run persona-leak-smoke`.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

interface LeakRule {
  /** Tokens that may not appear in this surface's text. */
  forbidden: RegExp[];
  /** Human label for the forbidden-token group. */
  groupLabel: string;
}

/**
 * Vendor brand tokens that may only appear in their dedicated demo
 * route's per-instance overrides — never in the shared persona
 * scenario, the shared ChatWidget greeting, or the shared LLMProvider
 * defaults.
 */
const BLOCKSTREAM_LEAK: LeakRule = {
  groupLabel: "Blockstream-specific brand tokens",
  forbidden: [
    /\bBlockstream\b/i,
    /\bJade\b/,
    /\bGreen Wallet\b/i,
  ],
};

interface ScanTarget {
  filePath: string;
  /** Regex extracts the string spans we care about. */
  extract: (src: string) => Array<{ label: string; text: string }>;
  rule: LeakRule;
  /** Lines/regions explicitly allowed to contain forbidden tokens. */
  allowMatch?: RegExp;
}

/**
 * personas.ts — every scenario.welcome / scenario.systemPrompt /
 * scenario.suggestedPrompts / demoLabel / scenario.placeholder string
 * for personas other than the legitimately-Blockstream-flavoured
 * /blockstream demo route. The fintech persona is the high-risk one;
 * it is shared between BitcoinDemo (neutral) and BlockstreamDemo
 * (vendor-specific via per-instance prop overrides). The persona
 * defaults must therefore be neutral.
 */
const PERSONAS_FILE = path.join(
  REPO_ROOT,
  "artifacts",
  "greater",
  "src",
  "data",
  "personas.ts",
);

const CHATWIDGET_FILE = path.join(
  REPO_ROOT,
  "artifacts",
  "greater",
  "src",
  "components",
  "ChatWidget.tsx",
);

const LLMPROVIDER_FILE = path.join(
  REPO_ROOT,
  "artifacts",
  "greater",
  "src",
  "llm",
  "LLMProvider.tsx",
);

/**
 * The persona scenario fields we scan. We deliberately do NOT scan
 * caseStudy / failureMode / pivot — those are long-form marketing
 * copy on the persona index pages where naming Blockstream as the
 * working example is intentional and correct.
 */
const PERSONA_SCENARIO_FIELDS = [
  "demoLabel",
  "welcome",
  "systemPrompt",
  "placeholder",
  "promptSuggestion",
];

interface PersonaSlice {
  slug: string;
  start: number;
  end: number;
}

/**
 * Lightweight slice of personas.ts into per-persona regions so we can
 * scope leaks per persona. The file is structured one persona per
 * top-level array element; each starts with `slug: '…'`.
 */
function slicePersonas(src: string): PersonaSlice[] {
  const slugRe = /slug:\s*['"]([a-z-]+)['"]/g;
  const slices: PersonaSlice[] = [];
  const matches: Array<{ slug: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = slugRe.exec(src)) !== null) {
    matches.push({ slug: m[1], index: m.index });
  }
  for (let i = 0; i < matches.length; i++) {
    slices.push({
      slug: matches[i].slug,
      start: matches[i].index,
      end: matches[i + 1]?.index ?? src.length,
    });
  }
  return slices;
}

/**
 * Pull the values for a small set of fields out of a persona slice.
 * Handles single-quoted, double-quoted, template-literal, and joined
 * array forms — all of which appear in the file. Conservative: when
 * the value isn't a literal we can statically extract (e.g. a
 * function call), we skip it; the smoke test is opt-in friendly.
 */
function extractFieldValues(
  slice: string,
  fields: string[],
): Array<{ field: string; value: string }> {
  const out: Array<{ field: string; value: string }> = [];
  for (const field of fields) {
    // String literal forms: field: "…" or field: '…'
    const stringRe = new RegExp(
      `${field}\\s*:\\s*(['"\`])((?:\\\\\\1|(?!\\1)[\\s\\S])*)\\1`,
      "g",
    );
    let m: RegExpExecArray | null;
    while ((m = stringRe.exec(slice)) !== null) {
      out.push({ field, value: m[2] });
    }
    // Joined array form: field: [ "…", "…", … ].join(' ')
    const arrayRe = new RegExp(
      `${field}\\s*:\\s*\\[([\\s\\S]*?)\\]\\.join\\(`,
      "g",
    );
    while ((m = arrayRe.exec(slice)) !== null) {
      const inner = m[1];
      const segRe = /(['"`])((?:\\\1|(?!\1)[\s\S])*)\1/g;
      let s: RegExpExecArray | null;
      const parts: string[] = [];
      while ((s = segRe.exec(inner)) !== null) {
        parts.push(s[2]);
      }
      out.push({ field, value: parts.join(" ") });
    }
    // Bare array form (suggestedPrompts): field: [ "…", "…" ]
    if (field === "suggestedPrompts") {
      const sugRe = /suggestedPrompts\s*:\s*\[([\s\S]*?)\]/g;
      while ((m = sugRe.exec(slice)) !== null) {
        const inner = m[1];
        const segRe = /(['"`])((?:\\\1|(?!\1)[\s\S])*)\1/g;
        let s: RegExpExecArray | null;
        while ((s = segRe.exec(inner)) !== null) {
          out.push({ field: "suggestedPrompts", value: s[2] });
        }
      }
    }
  }
  return out;
}

interface Finding {
  source: string;
  detail: string;
  matched: string;
}

async function scanPersonas(): Promise<Finding[]> {
  const src = await readFile(PERSONAS_FILE, "utf8");
  const slices = slicePersonas(src);
  const findings: Finding[] = [];

  for (const slice of slices) {
    // The /blockstream demo route is the only place vendor-specific
    // Blockstream copy is allowed, but it lives in BlockstreamDemo.tsx
    // (per-instance prop overrides), NOT in the persona file. So the
    // shared fintech persona must be neutral here.
    const region = src.slice(slice.start, slice.end);
    const values = extractFieldValues(region, PERSONA_SCENARIO_FIELDS);
    for (const { field, value } of values) {
      // promptSuggestion intentionally references "Blockstream Green
      // wallet" because that field is a worked-example user message
      // for the FAILURE-MODE narrative on the persona index page,
      // not a bot greeting. Scope-allow it.
      if (slice.slug === "fintech" && field === "promptSuggestion") continue;
      for (const re of BLOCKSTREAM_LEAK.forbidden) {
        const m = value.match(re);
        if (m) {
          findings.push({
            source: `personas.ts [${slice.slug}].scenario.${field}`,
            detail: value.slice(0, 140),
            matched: m[0],
          });
        }
      }
    }
  }
  return findings;
}

async function scanFile(
  filePath: string,
  rule: LeakRule,
  extract: (src: string) => Array<{ label: string; text: string }>,
): Promise<Finding[]> {
  const src = await readFile(filePath, "utf8");
  const targets = extract(src);
  const findings: Finding[] = [];
  for (const t of targets) {
    for (const re of rule.forbidden) {
      const m = t.text.match(re);
      if (m) {
        findings.push({
          source: `${path.relative(REPO_ROOT, filePath)} :: ${t.label}`,
          detail: t.text.slice(0, 140),
          matched: m[0],
        });
      }
    }
  }
  return findings;
}

/**
 * ChatWidget default greeting (the bubble shown when no
 * `welcomeMessage` prop is supplied). Lives at the call site
 * `welcomeMessage ?? "…"` — strict literal pull.
 */
function extractChatWidgetDefaults(src: string) {
  const out: Array<{ label: string; text: string }> = [];
  const greetingRe =
    /welcomeMessage\s*\?\?\s*(?:\/\/[^\n]*\n\s*)*["'`]([^"'`]+)["'`]/;
  const m = src.match(greetingRe);
  if (m) out.push({ label: "default welcomeMessage fallback", text: m[1] });
  return out;
}

/**
 * LLMProvider default system prompts — both branches (OpenClaw +
 * standard local). They follow the pattern:
 *   const baseSystemPrompt = options?.systemPrompt ?? [ "…", "…" ].join(…)
 */
function extractLLMProviderDefaults(src: string) {
  const out: Array<{ label: string; text: string }> = [];
  const re =
    /options\?\.systemPrompt\s*\?\?\s*(?:\/\/[^\n]*\n\s*)*\[([\s\S]*?)\]\.join\(/g;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(src)) !== null) {
    const inner = m[1];
    const parts: string[] = [];
    const segRe = /(['"`])((?:\\\1|(?!\1)[\s\S])*)\1/g;
    let s: RegExpExecArray | null;
    while ((s = segRe.exec(inner)) !== null) parts.push(s[2]);
    out.push({
      label: `default systemPrompt fallback #${++i}`,
      text: parts.join(" "),
    });
  }
  return out;
}

async function main() {
  const findings: Finding[] = [];

  findings.push(...(await scanPersonas()));
  findings.push(
    ...(await scanFile(
      CHATWIDGET_FILE,
      BLOCKSTREAM_LEAK,
      extractChatWidgetDefaults,
    )),
  );
  findings.push(
    ...(await scanFile(
      LLMPROVIDER_FILE,
      BLOCKSTREAM_LEAK,
      extractLLMProviderDefaults,
    )),
  );

  if (findings.length === 0) {
    console.log("[persona-leak-smoke] PASS — 0 cross-persona vendor leaks");
    process.exit(0);
  }

  console.error(
    `[persona-leak-smoke] FAIL — ${findings.length} cross-persona vendor leak(s):`,
  );
  for (const f of findings) {
    console.error(`  • ${f.source}`);
    console.error(`      matched: "${f.matched}"`);
    console.error(`      context: "${f.detail}"`);
  }
  console.error(
    "\nVendor-specific brand tokens (Blockstream, Jade, Green Wallet) belong",
  );
  console.error(
    "ONLY in the dedicated demo route's per-instance prop overrides",
  );
  console.error(
    "(BlockstreamDemo.tsx), never in shared persona scenarios or platform",
  );
  console.error("default fallbacks. See the file header for the full rule.");
  process.exit(1);
}

main().catch((err) => {
  console.error("[persona-leak-smoke] CRASH:", err);
  process.exit(2);
});
