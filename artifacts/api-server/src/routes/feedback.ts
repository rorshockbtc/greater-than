import { Router, type IRouter, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";
import { desc, eq, and, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, feedbackTable } from "@workspace/db";

const router: IRouter = Router();

const writeLimiter = rateLimit({
  windowMs: 60_000,
  limit: 12,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many feedback submissions; try again in a minute." },
});

const FeedbackBody = z.object({
  sessionId: z.string().min(1).max(128),
  personaSlug: z.string().min(1).max(64),
  rating: z.union([z.literal(1), z.literal(-1)]),
  userMessage: z.string().min(1).max(4000),
  botReply: z.string().min(1).max(8000),
  comment: z.string().max(2000).optional(),
  responseSource: z.string().min(1).max(32),
  biasId: z.string().max(64).optional(),
  biasLabel: z.string().max(64).optional(),
  latencyMs: z.number().int().min(0).max(600_000).optional(),
  cosineScore: z.number().min(0).max(1).optional(),
});

router.post("/feedback", writeLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = FeedbackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Intentionally do NOT capture user-agent here. The session id sent
  // by the client is the only stable identifier we want; user-agent is
  // a passive fingerprinting signal that conflicts with our no-PII
  // commitment for visitor feedback.
  try {
    const inserted = await db
      .insert(feedbackTable)
      .values({ ...parsed.data, kind: "feedback" })
      .returning({ id: feedbackTable.id });
    res.status(201).json({ ok: true, id: inserted[0]?.id });
  } catch (err) {
    console.error("[feedback] insert failed:", err);
    res.status(500).json({ error: "Could not record feedback." });
  }
});

/**
 * Question-suggestion endpoint. Visitors who can't find what they
 * need in the curated Q&A bank can propose a question they'd like
 * the bot to answer. We share the `feedback` table so the admin
 * dashboard has a single triage surface — the `kind` column
 * discriminates the two shapes.
 *
 * Spam guard rationale: this endpoint is unauthenticated, so it
 * needs to defend itself rather than trust the client. We reject
 * anything that's only a URL, anything dominated by a single
 * repeated character, and anything matching an obvious banned-word
 * shortlist. Per-IP rate limiting is the same shape as `/feedback`.
 */
const suggestionLimiter = rateLimit({
  windowMs: 60_000,
  limit: 6,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many suggestions; try again in a minute." },
});

const SuggestionBody = z.object({
  sessionId: z.string().min(1).max(128),
  personaSlug: z.string().min(1).max(64),
  question: z.string().min(8).max(280),
  context: z.string().max(500).optional(),
});

const URL_ONLY_RE = /^\s*https?:\/\/\S+\s*$/i;
const REPEAT_RUN_RE = /(.)\1{12,}/;
const BANNED_TOKENS = [
  "viagra",
  "casino",
  "porn",
  "buy followers",
  "crypto giveaway",
  "free bitcoin",
];

function looksLikeSpam(text: string): string | null {
  const trimmed = text.trim();
  if (URL_ONLY_RE.test(trimmed)) {
    return "Please describe the question in words, not just a link.";
  }
  if (REPEAT_RUN_RE.test(trimmed)) {
    return "That looks like keyboard noise — try rephrasing.";
  }
  const lower = trimmed.toLowerCase();
  if (BANNED_TOKENS.some((t) => lower.includes(t))) {
    return "That submission was filtered as spam.";
  }
  // A bare URL surrounded by a few words is also a common spam
  // pattern (e.g. "check out https://… now"). Reject when the URL
  // is more than half the body.
  const urlMatch = trimmed.match(/https?:\/\/\S+/i);
  if (urlMatch && urlMatch[0].length > trimmed.length / 2) {
    return "Please describe the question in words, not just a link.";
  }
  return null;
}

router.post(
  "/suggestions",
  suggestionLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = SuggestionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const spam = looksLikeSpam(parsed.data.question);
    if (spam) {
      res.status(400).json({ error: spam });
      return;
    }
    if (parsed.data.context) {
      const ctxSpam = looksLikeSpam(parsed.data.context);
      if (ctxSpam) {
        res.status(400).json({ error: ctxSpam });
        return;
      }
    }
    try {
      const inserted = await db
        .insert(feedbackTable)
        .values({
          kind: "suggestion",
          sessionId: parsed.data.sessionId,
          personaSlug: parsed.data.personaSlug,
          userMessage: parsed.data.question,
          context: parsed.data.context,
        })
        .returning({ id: feedbackTable.id });
      res.status(201).json({ ok: true, id: inserted[0]?.id });
    } catch (err) {
      console.error("[feedback] suggestion insert failed:", err);
      res.status(500).json({ error: "Could not record suggestion." });
    }
  },
);

const ADMIN_KEY = process.env.ADMIN_FEEDBACK_KEY ?? "";

/**
 * Admin-feedback endpoint guard.
 *
 * Header-only (`x-admin-key`). The query-string fallback that used
 * to be accepted (`?key=`) was removed because query strings are
 * leak-prone — they appear in access logs, browser history, and
 * Referer headers when the page links out.
 *
 * The compare is constant-time via `crypto.timingSafeEqual` after
 * length-equalisation, and any mismatch returns 404 so the
 * existence of the route is not a positive signal to a probing
 * attacker.
 */
function adminGuard(req: Request, res: Response): boolean {
  if (!ADMIN_KEY) {
    res.status(404).json({ error: "Not found" });
    return false;
  }
  const provided = (req.headers["x-admin-key"] ?? "") as string;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(ADMIN_KEY, "utf8");
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) {
    res.status(404).json({ error: "Not found" });
    return false;
  }
  return true;
}

router.get("/admin/feedback", async (req: Request, res: Response): Promise<void> => {
  if (!adminGuard(req, res)) return;
  const persona = typeof req.query.persona === "string" ? req.query.persona : undefined;
  const source = typeof req.query.source === "string" ? req.query.source : undefined;
  // `kind` filter: undefined → both shapes; "feedback" or "suggestion" → that one only.
  const kindParam = typeof req.query.kind === "string" ? req.query.kind : undefined;
  const kind = kindParam === "feedback" || kindParam === "suggestion" ? kindParam : undefined;
  const sinceDays = Number.parseInt(String(req.query.sinceDays ?? "30"), 10);
  const since = new Date(Date.now() - (Number.isFinite(sinceDays) ? sinceDays : 30) * 86_400_000);

  try {
    const rows = await db
      .select()
      .from(feedbackTable)
      .where(
        and(
          gte(feedbackTable.createdAt, since),
          persona ? eq(feedbackTable.personaSlug, persona) : undefined,
          source ? eq(feedbackTable.responseSource, source) : undefined,
          kind ? eq(feedbackTable.kind, kind) : undefined,
        ),
      )
      .orderBy(desc(feedbackTable.createdAt))
      .limit(200);

    // Apply the same persona/source/kind filters to the summary so the
    // header aggregates and the row table never disagree about
    // what's on screen. The dashboard would otherwise read as
    // "showing rows for X but the totals span everything", which
    // is the kind of silent inconsistency that erodes trust in the
    // numbers we're trying to ship.
    const summary = await db
      .select({
        personaSlug: feedbackTable.personaSlug,
        rating: feedbackTable.rating,
        kind: feedbackTable.kind,
        n: sql<number>`count(*)::int`,
      })
      .from(feedbackTable)
      .where(
        and(
          gte(feedbackTable.createdAt, since),
          persona ? eq(feedbackTable.personaSlug, persona) : undefined,
          source ? eq(feedbackTable.responseSource, source) : undefined,
          kind ? eq(feedbackTable.kind, kind) : undefined,
        ),
      )
      .groupBy(feedbackTable.personaSlug, feedbackTable.rating, feedbackTable.kind);

    res.json({ rows, summary, sinceDays });
  } catch (err) {
    console.error("[feedback] admin query failed:", err);
    res.status(500).json({ error: "Query failed" });
  }
});

export default router;
