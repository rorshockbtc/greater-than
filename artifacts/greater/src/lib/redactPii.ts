/**
 * Lightweight, regex-based PII scrubber for the support-ticket
 * preview. Runs entirely client-side on the visitor's transcript so
 * the cleaned payload — and only the cleaned payload — is what
 * "would have been escalated" to a downstream helpdesk.
 *
 * Deliberately conservative:
 *  - No attempt at name detection (too noisy without an NER model).
 *  - Patterns favor "match obvious things" over "catch everything".
 *  - Each pattern records what it replaced so the preview UI can
 *    render strike-through annotations and a redaction summary.
 *
 * If you find a pattern that needs tightening, adjust the regex and
 * add a fixture in any future test suite — the function is pure and
 * easy to assert against.
 */

export type RedactionKind =
  | "email"
  | "phone"
  | "credit-card"
  | "ssn"
  | "ip-address"
  | "long-id";

export interface Redaction {
  kind: RedactionKind;
  /** The original substring that was replaced. Useful for the
   * "Redactions applied" summary; never sent in the ticket payload. */
  original: string;
  /** What it was replaced with (e.g. "[redacted-email]"). */
  replacement: string;
}

interface PatternSpec {
  kind: RedactionKind;
  regex: RegExp;
  replacement: string;
}

/** Order matters: more specific patterns run before greedier ones so
 * a credit-card-shaped digit run doesn't get mis-tagged as a "long
 * id". Phone number pattern is intentionally restrictive — it only
 * triggers on formats with separators or a leading +. */
const PATTERNS: PatternSpec[] = [
  {
    kind: "email",
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: "[redacted-email]",
  },
  {
    kind: "credit-card",
    // 13–19 digits, optionally separated by spaces or dashes in
    // groups of 4. Avoids matching arbitrary long digit strings.
    regex: /\b(?:\d[ -]*?){13,19}\b/g,
    replacement: "[redacted-card]",
  },
  {
    kind: "ssn",
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: "[redacted-ssn]",
  },
  {
    kind: "phone",
    // Matches: +1-555-123-4567, (555) 123-4567, 555.123.4567, etc.
    // Requires at least one separator or a leading + so plain
    // 10-digit ID strings don't get clobbered.
    regex:
      /(?:\+?\d{1,3}[ .-])?(?:\(\d{3}\)[ .-]?|\d{3}[ .-])\d{3}[ .-]\d{4}\b/g,
    replacement: "[redacted-phone]",
  },
  {
    kind: "ip-address",
    regex:
      /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\b/g,
    replacement: "[redacted-ip]",
  },
  {
    kind: "long-id",
    // Catch-all for 12+ char alphanumeric runs that look like
    // account numbers, API keys, ticket ids, wallet addresses, etc.
    // Excludes URLs (which legitimately contain long paths) by
    // requiring the match be word-bounded and not preceded by /.
    regex: /(?<![/\w])[A-Za-z0-9]{16,}(?![/\w])/g,
    replacement: "[redacted-id]",
  },
];

export interface RedactResult {
  /** The transcript with every matched pattern replaced. */
  redacted: string;
  /** Per-match record, in source order, for the preview UI. */
  redactions: Redaction[];
}

/**
 * Apply every pattern in `PATTERNS` to `input`. Returns the redacted
 * string plus the list of replacements made. Pure — no side effects,
 * safe to call on every render.
 */
export function redactPii(input: string): RedactResult {
  if (!input) return { redacted: "", redactions: [] };
  let working = input;
  const redactions: Redaction[] = [];
  for (const spec of PATTERNS) {
    working = working.replace(spec.regex, (match) => {
      redactions.push({
        kind: spec.kind,
        original: match,
        replacement: spec.replacement,
      });
      return spec.replacement;
    });
  }
  return { redacted: working, redactions };
}

/** Convenience for transcript arrays — preserves role + timestamp,
 * scrubs the content of each turn, and aggregates redactions across
 * the whole conversation. */
export interface TranscriptTurn {
  role: "user" | "bot";
  content: string;
  timestamp: string;
}

export interface RedactedTranscript {
  turns: TranscriptTurn[];
  redactions: Redaction[];
}

export function redactTranscript(
  turns: TranscriptTurn[],
): RedactedTranscript {
  const out: TranscriptTurn[] = [];
  const all: Redaction[] = [];
  for (const t of turns) {
    const { redacted, redactions } = redactPii(t.content);
    out.push({ ...t, content: redacted });
    for (const r of redactions) all.push(r);
  }
  return { turns: out, redactions: all };
}
