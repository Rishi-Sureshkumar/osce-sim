import { bigserial, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { Action, GradingRun, PenDraft, SessionSettings, Usage } from "@/domain/schemas";

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull(),
  studentLabel: text("student_label").notNull(),
  status: text("status").notNull(),
  mode: text("mode").notNull().default("exam"),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true, mode: "string" }),
  patientTurns: integer("patient_turns").notNull().default(0),
  gradingRuns: integer("grading_runs").notNull().default(0),
  usage: jsonb("usage").$type<Usage>().notNull(),
  penDraft: jsonb("pen_draft").$type<PenDraft>(),
  settings: jsonb("settings").$type<SessionSettings>(),
});

/** Append-only. `seq` gives a stable total order within a session. */
export const actions = pgTable(
  "actions",
  {
    seq: bigserial("seq", { mode: "number" }).primaryKey(),
    id: text("id").notNull().unique(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    t: integer("t").notNull(),
    type: text("type").notNull(),
    data: jsonb("data").$type<Action>().notNull(),
  },
  (tbl) => [index("actions_session_idx").on(tbl.sessionId, tbl.seq)],
);

export const gradingRuns = pgTable("grading_runs", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  data: jsonb("data").$type<GradingRun>().notNull(),
});

export const overrides = pgTable("overrides", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  gradingRunId: text("grading_run_id").notNull(),
  markSheetId: text("mark_sheet_id").notNull(),
  itemId: text("item_id").notNull(),
  coach: text("coach").notNull(),
  originalPoints: jsonb("original_points").$type<number>().notNull(),
  newPoints: jsonb("new_points").$type<number>().notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const feedback = pgTable("feedback", {
  id: text("id").primaryKey(),
  sessionId: text("session_id"),
  role: text("role").notNull(),
  rating: integer("rating"),
  fairness: text("fairness"),
  text: text("text").notNull(),
  page: text("page").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});
