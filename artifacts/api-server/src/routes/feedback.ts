import { Router, type IRouter, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { desc, eq, and, gte, sql } from "drizzle-orm";
import { z } from "zod/v4";
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
  const ua = (req.headers["user-agent"] ?? "").slice(0, 256);
  try {
    const inserted = await db
      .insert(feedbackTable)
      .values({ ...parsed.data, userAgent: ua })
      .returning({ id: feedbackTable.id });
    res.status(201).json({ ok: true, id: inserted[0]?.id });
  } catch (err) {
    console.error("[feedback] insert failed:", err);
    res.status(500).json({ error: "Could not record feedback." });
  }
});

const ADMIN_KEY = process.env.ADMIN_FEEDBACK_KEY ?? "";

function adminGuard(req: Request, res: Response): boolean {
  const key = (req.query.key ?? req.headers["x-admin-key"] ?? "") as string;
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    res.status(404).json({ error: "Not found" });
    return false;
  }
  return true;
}

router.get("/admin/feedback", async (req: Request, res: Response): Promise<void> => {
  if (!adminGuard(req, res)) return;
  const persona = typeof req.query.persona === "string" ? req.query.persona : undefined;
  const source = typeof req.query.source === "string" ? req.query.source : undefined;
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
        ),
      )
      .orderBy(feedbackTable.rating, desc(feedbackTable.createdAt))
      .limit(200);

    const summary = await db
      .select({
        personaSlug: feedbackTable.personaSlug,
        rating: feedbackTable.rating,
        n: sql<number>`count(*)::int`,
      })
      .from(feedbackTable)
      .where(gte(feedbackTable.createdAt, since))
      .groupBy(feedbackTable.personaSlug, feedbackTable.rating);

    res.json({ rows, summary, sinceDays });
  } catch (err) {
    console.error("[feedback] admin query failed:", err);
    res.status(500).json({ error: "Query failed" });
  }
});

export default router;
