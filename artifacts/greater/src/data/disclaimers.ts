/**
 * Per-persona compliance disclaimer copy.
 *
 * Rendered as the first transcript entry in every chat widget by
 * `<DisclaimerBanner persona={slug} />`. Kept in its own module so
 * the (large) `personas.ts` registry doesn't have to grow another
 * field, and so legal/compliance copy lives in one auditable place.
 *
 * Honesty rules (see `COMPLIANCE.md`):
 *   - Never claim certifications the FOSS shell doesn't hold.
 *   - Never claim "your data never leaves your browser" without the
 *     "in the default flow" caveat — the cloud fallback exists.
 *   - State the *role* the bot plays and the *limit* of that role
 *     (no medical advice, no financial advice, no pastoral
 *     counseling, no legal opinion, etc.).
 *   - Always offer the visitor a deep link to the relevant
 *     `/compliance#…` anchor.
 */

export type DisclaimerCopy = {
  /** Visible body of the banner, in the persona's voice. */
  body: string;
  /** Optional second line, used by heavyweight personas (healthtech/fintech). */
  detail?: string;
  /** Anchor on `/compliance` the "Learn more" link should target. */
  learnMoreAnchor: string;
  /** Visible label for the "Learn more" link. */
  learnMoreLabel?: string;
};

const FALLBACK: DisclaimerCopy = {
  body:
    "I'm a Greater demo bot. Answers are generated locally in your browser from a curated knowledge base — I'm helpful, not authoritative.",
  learnMoreAnchor: "general",
};

export const DISCLAIMERS: Record<string, DisclaimerCopy> = {
  healthtech: {
    body:
      "I'm a member-portal assistant. I'm not a doctor and I won't give medical advice. For urgent or clinical questions I'll point you to a provider.",
    detail:
      "Don't share PHI here — this is a public demo. The FOSS shell runs in your browser and doesn't transmit your messages by default; a HIPAA-grade production deployment adds a BAA, audit logging, and encryption.",
    learnMoreAnchor: "healthtech",
    learnMoreLabel: "How this bot handles your data",
  },
  fintech: {
    body:
      "Not financial, tax, or legal advice. I won't ask for keys, seed phrases, or account credentials — anyone who does is phishing you.",
    detail:
      "For account-specific issues I'll route you to Blockstream support. The FOSS shell answers locally in your browser; a regulated production deployment adds the audit logging and KYC plumbing your jurisdiction requires.",
    learnMoreAnchor: "fintech",
    learnMoreLabel: "Compliance posture",
  },
  startups: {
    body:
      "I quote your docs and changelog verbatim and I tell you when I don't know. I'm not a sales rep — for contract-specific questions, I'll route to your AE.",
    learnMoreAnchor: "general",
  },
  faith: {
    body:
      "I represent the teaching of one specific congregation — I won't pretend to be your pastor, and I won't smooth over distinctives. For pastoral care I'll connect you with a real elder.",
    learnMoreAnchor: "general",
  },
  schools: {
    body:
      "I speak only from materials this school has approved. I won't improvise lunch menus, sports schedules, or anything outside the published handbook.",
    learnMoreAnchor: "general",
  },
  "small-business": {
    body:
      "I can pull listings, hours, and policy answers from this site's own pages. I can't write an offer or quote a price the office hasn't published.",
    learnMoreAnchor: "general",
  },
};

export function getDisclaimer(slug: string | undefined | null): DisclaimerCopy {
  if (!slug) return FALLBACK;
  return DISCLAIMERS[slug] ?? FALLBACK;
}
