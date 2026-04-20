ALTER TABLE "feedback" ALTER COLUMN "rating" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback" ALTER COLUMN "bot_reply" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback" ALTER COLUMN "response_source" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "kind" text DEFAULT 'feedback' NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "context" text;--> statement-breakpoint
CREATE INDEX "feedback_kind_idx" ON "feedback" USING btree ("kind");