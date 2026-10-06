/**
 * TEAM CONTRACT — every workstream depends on these types.
 *
 * Changing this file affects all 9 workstreams. Before editing:
 *   1. post a heads-up in the team channel,
 *   2. keep changes additive where possible (new optional fields, new enum members),
 *   3. run `npm run validate && npm run typecheck && npm test`.
 *
 * All content in /content is validated against these schemas at build time and in tests.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

const slug = z.string().regex(/^[a-z0-9][a-z0-9_.-]*$/, "lowercase id: a-z, 0-9, _ . -");

export const RegionId = slug;
export const ManeuverId = slug;
export const CaseId = slug;
export const MarkSheetId = slug;

export const System = z.enum([
  "general",
  "vitals",
  "heent",
  "lymph",
  "neck",
  "cardiovascular",
  "pulmonary",
  "abdominal",
  "neuro",
  "msk",
  "skin",
]);
export type System = z.infer<typeof System>;

/** Which diagram a region is drawn on. Sub-diagrams are reached by zooming from the body views. */
export const View = z.enum(["anterior", "posterior", "head_neck", "precordium", "neuro", "whole"]);
export type View = z.infer<typeof View>;

export const Position = z.enum([
  "seated",
  "seated_leaning_forward",
  "supine",
  "reclined_30",
  "left_lateral_decubitus",
  "prone",
  "standing",
]);
export type Position = z.infer<typeof Position>;

export const Technique = z.enum(["inspect", "palpate", "percuss", "auscultate", "special"]);
export type Technique = z.infer<typeof Technique>;

// ---------------------------------------------------------------------------
// Regions (canonical, stable — 2D, 3D and VR all map to these ids)
// ---------------------------------------------------------------------------

export const Region = z.object({
  id: RegionId,
  label: z.string().min(1),
  system: System,
  view: View,
  /** id of the SVG element that renders this region (see src/components/body/views). */
  svgPathId: z.string().min(1),
  /** Optional: clicking this region on a body view zooms into another view. */
  zoomTo: View.optional(),
});
export type Region = z.infer<typeof Region>;

export const RegionsFile = z.object({ regions: z.array(Region).min(1) });

// ---------------------------------------------------------------------------
// Exam catalog
// ---------------------------------------------------------------------------

/**
 * Normal findings. `default` is required; per-region overrides are optional.
 * Text may contain vitals placeholders such as {vitals.hr} — see engine/resolveFinding.ts.
 */
export const NormalFinding = z.object({ default: z.string().min(1) }).catchall(z.string().min(1));
export type NormalFinding = z.infer<typeof NormalFinding>;

export const ExamManeuver = z.object({
  id: ManeuverId,
  /** FCM-1 framework item number. null when the maneuver has no framework number (never invent one). */
  fcmId: z.number().int().min(1).max(120).nullable(),
  /** Short label in our own words (framework text is not yet copyright-cleared). */
  label: z.string().min(1),
  system: System,
  technique: Technique,
  allowedRegions: z.array(RegionId).min(1),
  /** Positions in which this maneuver is correctly performed (scored by mark-sheet rules, never enforced in UI). */
  requiresPositioning: z.array(Position).optional(),
  normalFinding: NormalFinding,
  demo: z.object({
    steps: z.array(z.string().min(1)).min(1),
    mediaUrl: z.string().optional(),
  }),
  /** Verbatim framework text — leave "" until copyright is cleared. */
  sourceText: z.literal("").or(z.string()).default(""),
});
export type ExamManeuver = z.infer<typeof ExamManeuver>;

export const ManeuversFile = z.object({
  system: System,
  maneuvers: z.array(ExamManeuver),
});

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

export const Vitals = z.object({
  hr: z.number(),
  rr: z.number(),
  bpSystolic: z.number(),
  bpDiastolic: z.number(),
  tempC: z.number(),
  spo2: z.number(),
  spo2Context: z.string().default("on room air"),
});
export type Vitals = z.infer<typeof Vitals>;

export const HistoryFact = z.object({
  id: slug,
  topic: z.string().min(1),
  answer: z.string().min(1),
  /** true: only disclose when the student asks about this topic. false: patient may volunteer it. */
  revealOnlyIfAsked: z.boolean(),
  /** Optional keywords used by the mock patient (AI_MOCK=true) to match questions. */
  keywords: z.array(z.string()).optional(),
});
export type HistoryFact = z.infer<typeof HistoryFact>;

export const PertinentNegative = z.object({
  topic: z.string().min(1),
  answer: z.string().min(1),
  keywords: z.array(z.string()).optional(),
});

export const UnknownPolicy = z.object({
  /** Reply when asked about something listed as negative (e.g. review-of-systems items). */
  negativeReply: z.string().min(1),
  /** Reply when asked about anything not covered by the case. */
  unknownReply: z.string().min(1),
});

/** maneuverId -> (regionId | "default") -> finding text */
export const AbnormalFindings = z.record(ManeuverId, z.record(z.string(), z.string().min(1)));
export type AbnormalFindings = z.infer<typeof AbnormalFindings>;

export const DifferentialItem = z.object({
  rank: z.number().int().min(1),
  diagnosis: z.string().min(1),
  rationale: z.string().min(1),
});

export const Case = z.object({
  id: CaseId,
  title: z.string().min(1),
  /** "screening" = full head-to-toe exam on a normal standardized patient. */
  mode: z.enum(["encounter", "screening"]),
  patient: z.object({
    name: z.string().min(1),
    age: z.number().int().min(0),
    sex: z.enum(["female", "male", "intersex"]),
    pronouns: z.string().default("they/them"),
    chiefComplaint: z.string().min(1),
    setting: z.string().min(1),
    /** Non-clinical colour the AI patient may use (mood, worries, small talk). Never clinical facts. */
    persona: z.object({
      affect: z.string(),
      speakingStyle: z.string(),
      worries: z.string(),
      background: z.string(),
    }),
  }),
  doorSign: z.object({
    task: z.string().min(1),
    timeLimitMinutes: z.number().int().min(1),
  }),
  vitals: Vitals,
  history: z.object({
    openingStatement: z.string().min(1),
    facts: z.array(HistoryFact),
    pertinentNegatives: z.array(PertinentNegative),
    unknownPolicy: UnknownPolicy,
  }),
  abnormalFindings: AbnormalFindings,
  expectedDifferential: z.array(DifferentialItem),
  markSheetIds: z.array(MarkSheetId).min(1),
  /**
   * Optional: restrict a mark sheet to some of its sections for this case
   * (e.g. a focused CV/resp encounter only scores those sections of exam-fcm1).
   */
  markSheetSections: z.record(MarkSheetId, z.array(z.string().min(1)).min(1)).optional(),
  synthetic: z.literal(true),
  sourceNote: z.string().min(1),
});
export type Case = z.infer<typeof Case>;

/** What the browser is allowed to see about a case (no history facts, findings or differential). */
export type PublicCase = Pick<Case, "id" | "title" | "mode" | "doorSign" | "markSheetIds"> & {
  patient: Pick<Case["patient"], "name" | "age" | "sex" | "pronouns" | "chiefComplaint" | "setting">;
};

// ---------------------------------------------------------------------------
// Actions — every input (click, text, toolbar, voice, VR) becomes one of these.
// The session log is append-only; scoring and the coach timeline read only from it.
// ---------------------------------------------------------------------------

export const ActionSource = z.enum(["click", "text", "voice", "vr", "toolbar", "system"]);
export type ActionSource = z.infer<typeof ActionSource>;

export const CourtesyKind = z.enum([
  "hand_hygiene",
  "introduce",
  "consent",
  "drape",
  "position",
  "close_encounter",
]);
export type CourtesyKind = z.infer<typeof CourtesyKind>;

export const FindingResolution = z.enum(["case_region", "case_default", "catalog_region", "catalog_default"]);

export const ExamResult = z.object({
  /** Deterministic finding text resolved in code (never by the model). */
  findingText: z.string(),
  resolvedFrom: FindingResolution,
  /** Natural wording from the AI. Absent/identical when the wording call failed or was skipped. */
  wording: z.string().optional(),
});
export type ExamResult = z.infer<typeof ExamResult>;

export const Usage = z.object({
  inputTokens: z.number().int().default(0),
  outputTokens: z.number().int().default(0),
  cacheReadTokens: z.number().int().default(0),
  cacheWriteTokens: z.number().int().default(0),
});
export type Usage = z.infer<typeof Usage>;

/** The part of an action a client/adapter supplies. The server adds id, sessionId, t and result. */
export const ActionInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("say"), source: ActionSource, payload: z.object({ text: z.string().min(1).max(2000) }) }),
  z.object({
    type: z.literal("examine"),
    source: ActionSource,
    payload: z.object({ regionId: RegionId, maneuverId: ManeuverId }),
  }),
  z.object({
    type: z.literal("courtesy"),
    source: ActionSource,
    payload: z.object({ kind: CourtesyKind, position: Position.optional() }),
  }),
  z.object({ type: z.literal("note"), source: ActionSource, payload: z.object({ text: z.string().min(1).max(4000) }) }),
  z.object({
    type: z.literal("submit_ddx"),
    source: ActionSource,
    payload: z.object({
      summary: z.string().max(4000),
      differential: z.array(z.string().min(1).max(300)).min(1).max(10),
      plan: z.string().max(4000),
    }),
  }),
]);
export type ActionInput = z.infer<typeof ActionInput>;

/** Server-generated actions (never accepted from the client). */
export const SystemActionInput = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("patient_say"),
    source: z.literal("system"),
    payload: z.object({ text: z.string(), mocked: z.boolean().optional() }),
  }),
  z.object({ type: z.literal("session_start"), source: z.literal("system"), payload: z.object({ caseId: CaseId }) }),
  z.object({ type: z.literal("session_end"), source: z.literal("system"), payload: z.object({ reason: z.string() }) }),
]);

const actionMeta = {
  id: z.string(),
  sessionId: z.string(),
  /** ms since session start (monotonic per session; floored to seconds for display) */
  t: z.number().int().min(0),
  /** storage append order; breaks ties on t. Assigned by the repo. */
  seq: z.number().int().optional(),
};

export const Action = z.discriminatedUnion("type", [
  z.object({ ...actionMeta, type: z.literal("say"), source: ActionSource, payload: z.object({ text: z.string() }) }),
  z.object({
    ...actionMeta,
    type: z.literal("examine"),
    source: ActionSource,
    payload: z.object({ regionId: RegionId, maneuverId: ManeuverId }),
    result: ExamResult.optional(),
  }),
  z.object({
    ...actionMeta,
    type: z.literal("courtesy"),
    source: ActionSource,
    payload: z.object({ kind: CourtesyKind, position: Position.optional() }),
  }),
  z.object({ ...actionMeta, type: z.literal("note"), source: ActionSource, payload: z.object({ text: z.string() }) }),
  z.object({
    ...actionMeta,
    type: z.literal("submit_ddx"),
    source: ActionSource,
    payload: z.object({ summary: z.string(), differential: z.array(z.string()), plan: z.string() }),
  }),
  z.object({
    ...actionMeta,
    type: z.literal("patient_say"),
    source: z.literal("system"),
    payload: z.object({ text: z.string(), mocked: z.boolean().optional() }),
  }),
  z.object({ ...actionMeta, type: z.literal("session_start"), source: z.literal("system"), payload: z.object({ caseId: z.string() }) }),
  z.object({ ...actionMeta, type: z.literal("session_end"), source: z.literal("system"), payload: z.object({ reason: z.string() }) }),
]);
export type Action = z.infer<typeof Action>;
export type ActionType = Action["type"];

// ---------------------------------------------------------------------------
// Mark sheets
// ---------------------------------------------------------------------------

/**
 * Event references used by `before` rules. Resolved to the time of the FIRST matching action
 * (prefix "last:" for the last one):
 *   "hand_hygiene" | "introduce" | ...           a courtesy kind
 *   "position:<Position>"                         a position courtesy with that value
 *   "maneuver:<maneuverId>"                       an examine action with that maneuver
 *   "first:examine" | "first:say" | "first:submit_ddx" | "first:courtesy"   first action of a type
 *   "last:examine" | "last:say"                   last action of a type
 */
export const EventRef = z.string().min(1);

export type Rule =
  | { performed: string | string[]; regions?: string[]; minRegions?: number; partial?: boolean }
  | { courtesy: CourtesyKind; position?: Position }
  | { before: [string, string] }
  | { performedIn: { maneuver: string | string[]; position: Position | Position[] } }
  | { submitted: "submit_ddx" }
  | { all: Rule[] }
  | { any: Rule[] }
  | { not: Rule };

export const Rule: z.ZodType<Rule> = z.lazy(() =>
  z.union([
    z.object({
      /** maneuver id, or list (any of them counts) */
      performed: z.union([ManeuverId, z.array(ManeuverId).min(1)]),
      /** every listed region must be examined with the maneuver(s) */
      regions: z.array(RegionId).optional(),
      /** alternatively: at least N distinct regions */
      minRegions: z.number().int().min(1).optional(),
      /** award fractional credit for region coverage instead of all-or-nothing */
      partial: z.boolean().optional(),
    }).strict(),
    z.object({ courtesy: CourtesyKind, position: Position.optional() }).strict(),
    z.object({ before: z.tuple([EventRef, EventRef]) }).strict(),
    z.object({
      performedIn: z.object({
        maneuver: z.union([ManeuverId, z.array(ManeuverId).min(1)]),
        position: z.union([Position, z.array(Position).min(1)]),
      }),
    }).strict(),
    z.object({ submitted: z.literal("submit_ddx") }).strict(),
    z.object({ all: z.array(Rule).min(1) }).strict(),
    z.object({ any: z.array(Rule).min(1) }).strict(),
    z.object({ not: Rule }).strict(),
  ]),
);

export const MarkSheetItem = z
  .object({
    id: slug,
    fcmId: z.number().int().min(1).max(120).optional(),
    section: z.string().min(1),
    label: z.string().min(1),
    weight: z.number().min(0),
    scoring: z.enum(["auto", "ai", "not_assessable"]),
    rule: Rule.optional(),
    /** For `ai` items: what the grader should look for, in our own words. */
    guidance: z.string().optional(),
    /** For `ai` items under AI_MOCK: phrases that count as evidence. */
    mockKeywords: z.array(z.string()).optional(),
    /** For `not_assessable` items: why we can't score it from this interface. */
    notAssessableReason: z.string().optional(),
    sourceText: z.string().default(""),
  })
  .superRefine((item, ctx) => {
    if (item.scoring === "auto" && !item.rule) ctx.addIssue({ code: "custom", message: `auto item ${item.id} needs a rule` });
    if (item.scoring === "ai" && !item.guidance) ctx.addIssue({ code: "custom", message: `ai item ${item.id} needs guidance` });
  });
export type MarkSheetItem = z.infer<typeof MarkSheetItem>;

export const MarkSheet = z.object({
  id: MarkSheetId,
  title: z.string().min(1),
  kind: z.enum(["exam", "history"]),
  sourceNote: z.string(),
  items: z.array(MarkSheetItem).min(1),
});
export type MarkSheet = z.infer<typeof MarkSheet>;

// ---------------------------------------------------------------------------
// Sessions, scores, overrides, feedback (persisted)
// ---------------------------------------------------------------------------

export const SessionStatus = z.enum(["active", "submitted", "graded"]);

export const Session = z.object({
  id: z.string(),
  caseId: CaseId,
  studentLabel: z.string(),
  status: SessionStatus,
  startedAt: z.string(), // ISO
  endedAt: z.string().nullable(),
  patientTurns: z.number().int(),
  gradingRuns: z.number().int(),
  usage: Usage,
});
export type Session = z.infer<typeof Session>;

export const Evidence = z.object({
  actionId: z.string(),
  quote: z.string(),
  /** set by server-side verification: the quote appears verbatim in the referenced action */
  verified: z.boolean(),
});
export type Evidence = z.infer<typeof Evidence>;

export const ScoreStatus = z.enum(["scored", "needs_review", "not_assessable"]);

export const ItemScore = z.object({
  markSheetId: MarkSheetId,
  itemId: z.string(),
  scoring: z.enum(["auto", "ai", "not_assessable"]),
  status: ScoreStatus,
  /** 0..1 fraction of the item achieved */
  value: z.number().min(0).max(1),
  points: z.number(),
  maxPoints: z.number(),
  rationale: z.string(),
  evidence: z.array(Evidence),
});
export type ItemScore = z.infer<typeof ItemScore>;

export const GradingRun = z.object({
  id: z.string(),
  sessionId: z.string(),
  createdAt: z.string(),
  trigger: z.enum(["student_submit", "coach_rerun"]),
  summary: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  scores: z.array(ItemScore),
  usage: Usage,
  mocked: z.boolean(),
});
export type GradingRun = z.infer<typeof GradingRun>;

export const Override = z.object({
  id: z.string(),
  sessionId: z.string(),
  gradingRunId: z.string(),
  markSheetId: MarkSheetId,
  itemId: z.string(),
  coach: z.string().min(1),
  originalPoints: z.number(),
  newPoints: z.number(),
  reason: z.string().min(1),
  createdAt: z.string(),
});
export type Override = z.infer<typeof Override>;

export const Feedback = z.object({
  id: z.string(),
  sessionId: z.string().nullable(),
  role: z.enum(["student", "coach"]),
  rating: z.number().int().min(1).max(5).nullable(),
  fairness: z.enum(["fair", "too_harsh", "too_lenient", "unsure"]).nullable(),
  text: z.string().max(5000),
  page: z.string(),
  createdAt: z.string(),
});
export type Feedback = z.infer<typeof Feedback>;
