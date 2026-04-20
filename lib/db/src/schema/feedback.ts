import { pgTable, text, serial, timestamp, integer, real, index } from "drizzle-orm/pg-core";

export const feedbackTable = pgTable(
  "feedback",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    personaSlug: text("persona_slug").notNull(),
    rating: integer("rating").notNull(),
    userMessage: text("user_message").notNull(),
    botReply: text("bot_reply").notNull(),
    comment: text("comment"),
    responseSource: text("response_source").notNull(),
    biasId: text("bias_id"),
    biasLabel: text("bias_label"),
    latencyMs: integer("latency_ms"),
    cosineScore: real("cosine_score"),
    // No user-agent or IP captured. The session id sent by the client
    // is the only stable identifier we want — anything else is a
    // passive fingerprinting signal that breaks the no-PII commitment.
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    personaIdx: index("feedback_persona_idx").on(table.personaSlug),
    ratingIdx: index("feedback_rating_idx").on(table.rating),
    createdAtIdx: index("feedback_created_at_idx").on(table.createdAt),
  }),
);

export type Feedback = typeof feedbackTable.$inferSelect;
export type InsertFeedback = typeof feedbackTable.$inferInsert;
