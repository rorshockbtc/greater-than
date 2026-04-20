CREATE TABLE "articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"body" text NOT NULL,
	"category" text NOT NULL,
	"source_url" text NOT NULL,
	"trust_score" real DEFAULT 0.94 NOT NULL,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"persona_slug" text NOT NULL,
	"rating" integer NOT NULL,
	"user_message" text NOT NULL,
	"bot_reply" text NOT NULL,
	"comment" text,
	"response_source" text NOT NULL,
	"bias_id" text,
	"bias_label" text,
	"latency_ms" integer,
	"cosine_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "feedback_persona_idx" ON "feedback" USING btree ("persona_slug");--> statement-breakpoint
CREATE INDEX "feedback_rating_idx" ON "feedback" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "feedback_created_at_idx" ON "feedback" USING btree ("created_at");