CREATE TABLE "actions" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"id" text NOT NULL,
	"session_id" text NOT NULL,
	"t" integer NOT NULL,
	"type" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "actions_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text,
	"role" text NOT NULL,
	"rating" integer,
	"fairness" text,
	"text" text NOT NULL,
	"page" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grading_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"grading_run_id" text NOT NULL,
	"mark_sheet_id" text NOT NULL,
	"item_id" text NOT NULL,
	"coach" text NOT NULL,
	"original_points" jsonb NOT NULL,
	"new_points" jsonb NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"student_label" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"patient_turns" integer DEFAULT 0 NOT NULL,
	"grading_runs" integer DEFAULT 0 NOT NULL,
	"usage" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grading_runs" ADD CONSTRAINT "grading_runs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overrides" ADD CONSTRAINT "overrides_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "actions_session_idx" ON "actions" USING btree ("session_id","seq");