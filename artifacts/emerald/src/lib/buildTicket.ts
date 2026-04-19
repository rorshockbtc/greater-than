/**
 * Compose a Zendesk-shaped ticket payload from a redacted transcript
 * and a locally-generated summary. This is purely illustrative — the
 * ticket-preview screen never POSTs anywhere. The shape mirrors the
 * Zendesk Tickets API (https://developer.zendesk.com/api-reference/
 * ticketing/tickets/tickets/) so a curious visitor can copy it into
 * their own helpdesk.
 */

import type { RedactedTranscript } from "./redactPii";

export interface TicketSummary {
  /** What the visitor was trying to accomplish, one short sentence. */
  intent: string;
  /** What Greater answered, one short sentence. */
  answered: string;
  /** What Greater couldn't resolve, one short sentence. */
  unresolved: string;
  /** Recommended next action for the human agent, one short sentence. */
  recommendedAction: string;
}

export interface BuildTicketInput {
  redacted: RedactedTranscript;
  summary: TicketSummary;
  persona: {
    slug: string;
    brand: string;
  };
  biasId?: string;
  biasLabel?: string;
  /** Stable id of the chat widget session — becomes the requester
   * external_id and the conversation_id custom field. */
  sessionId: string;
  /** When the transcript was captured. Defaults to "now". */
  capturedAt?: Date;
}

/**
 * Zendesk-compatible ticket payload. Only the fields Greater can
 * reasonably populate without a real Zendesk integration are
 * present; everything else (assignee_id, group_id, organization_id,
 * etc.) is the receiving helpdesk's job.
 */
export interface ZendeskTicketPayload {
  ticket: {
    /** Synthetic requester so the demo doesn't ask the visitor for
     * their email. A real integration would use the authenticated
     * user's email or a Zendesk user_id. */
    requester: { name: string; email: string };
    subject: string;
    /** Plain-text body. Markdown intentionally avoided — Zendesk
     * agents see the body in a plain-text panel by default. */
    comment: { body: string; public: false };
    /** Tags include the persona, the active bias, and a marker so
     * helpdesks can filter Greater-originated tickets. */
    tags: string[];
    priority: "low" | "normal" | "high" | "urgent";
    type: "question" | "incident" | "problem" | "task";
    /** Custom fields used by the demo to convey provenance. Real
     * integrations would map these to actual custom_field ids. */
    custom_fields: { id: string; value: string }[];
    /** External id ties the ticket back to the chat session. */
    external_id: string;
  };
}

function turnToLine(t: { role: "user" | "bot"; content: string; timestamp: string }) {
  const speaker = t.role === "user" ? "Visitor" : "Greater";
  // Keep timestamps short — Zendesk panels are narrow.
  const time = t.timestamp.substring(11, 16);
  return `[${time}] ${speaker}: ${t.content}`;
}

function deriveSubject(
  summary: TicketSummary,
  brand: string,
): string {
  // Cap at ~80 chars so the Zendesk subject column stays readable.
  const intent = summary.intent.replace(/[\n\r]+/g, " ").trim();
  const trimmed = intent.length > 60 ? `${intent.slice(0, 57)}…` : intent;
  return `[Greater · ${brand}] ${trimmed || "Visitor request"}`;
}

function derivePriority(summary: TicketSummary): "normal" | "high" | "urgent" {
  // Heuristic: keywords that obviously matter. Conservative — most
  // tickets default to normal. The demo is illustrating shape, not
  // building a triage engine.
  const hay = `${summary.intent} ${summary.unresolved}`.toLowerCase();
  if (/(urgent|compromis|stolen|hack|emergency|fraud)/.test(hay)) return "urgent";
  if (/(error|broken|locked|cannot|can't|won't|refund)/.test(hay)) return "high";
  return "normal";
}

/**
 * Build the Zendesk-shaped payload. Pure — given the same inputs,
 * always returns the same JSON. The ticket id is *not* generated
 * here; the preview UI mints a synthetic id at render time so the
 * caller controls determinism for snapshots.
 */
export function buildTicketPayload(
  input: BuildTicketInput,
  syntheticTicketId: string,
): ZendeskTicketPayload {
  const { redacted, summary, persona, biasId, biasLabel, sessionId } = input;
  const capturedAt = (input.capturedAt ?? new Date()).toISOString();

  const transcriptBlock = redacted.turns.map(turnToLine).join("\n");
  const body = [
    `# Visitor request (auto-summarized by Greater)`,
    ``,
    `Intent: ${summary.intent}`,
    `Greater answered: ${summary.answered}`,
    `Could not resolve: ${summary.unresolved}`,
    `Recommended next action: ${summary.recommendedAction}`,
    ``,
    `# Redacted transcript`,
    ``,
    transcriptBlock,
    ``,
    `# Provenance`,
    `- session_id: ${sessionId}`,
    `- ticket_id: ${syntheticTicketId}`,
    `- persona: ${persona.slug} (${persona.brand})`,
    biasLabel ? `- bias: ${biasLabel}${biasId ? ` (${biasId})` : ""}` : `- bias: none`,
    `- captured_at: ${capturedAt}`,
    `- redactions_applied: ${redacted.redactions.length}`,
  ].join("\n");

  const tags = [
    "greater",
    `persona:${persona.slug}`,
    `brand:${persona.brand.toLowerCase().replace(/\s+/g, "-")}`,
  ];
  if (biasId) tags.push(`bias:${biasId}`);

  const customFields = [
    { id: "greater_session_id", value: sessionId },
    { id: "greater_persona", value: persona.slug },
  ];
  if (biasLabel) {
    customFields.push({ id: "greater_bias_label", value: biasLabel });
  }

  return {
    ticket: {
      requester: { name: "Visitor (anonymous)", email: "support@example.com" },
      subject: deriveSubject(summary, persona.brand),
      comment: { body, public: false },
      tags,
      priority: derivePriority(summary),
      type: "question",
      custom_fields: customFields,
      external_id: sessionId,
    },
  };
}

/** Deterministic-ish synthetic id of the form GTR-XXXXXX. The
 * preview UI calls this once per render so the displayed id is
 * stable as long as the transcript doesn't change. */
export function synthesizeTicketId(sessionId: string): string {
  // Take the first 6 alphanumeric chars of the sessionId, uppercased.
  const slug = sessionId.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase();
  return `GTR-${slug || "000000"}`;
}
