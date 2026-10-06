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

// ---- Sound and visual descriptors (Phase 2). Chosen by data, never by the AI. ----

export const MurmurSpec = z.object({
  phase: z.enum(["systolic", "diastolic"]),
  shape: z.enum(["holosystolic", "crescendo_decrescendo", "decrescendo", "plateau"]),
  /** Levine grade 1–6; sets loudness. */
  grade: z.number().int().min(1).max(6),
  pitch: z.enum(["low", "medium", "high"]).default("medium"),
});

export const AudioSpec = z.union([
  z.object({
    generator: z.literal("heart"),
    params: z
      .object({
        /** 0–1 loudness of each extra sound; omitted = absent. */
        s3: z.number().min(0).max(1).optional(),
        s4: z.number().min(0).max(1).optional(),
        murmur: MurmurSpec.optional(),
        /** overall loudness 0–1 (e.g. distant heart sounds) */
        intensity: z.number().min(0).max(1).default(0.8),
        /** ms between A2 and P2; 0 = single S2 */
        s2SplitMs: z.number().min(0).max(80).default(0),
      })
      .strict(),
  }),
  z.object({
    generator: z.literal("breath"),
    params: z
      .object({
        type: z.enum(["vesicular", "bronchial", "reduced", "absent"]).default("vesicular"),
        crackles: z.enum(["fine", "coarse"]).optional(),
        /** 0–1 crackle density */
        cracklesDensity: z.number().min(0).max(1).default(0.5),
        wheeze: z.boolean().default(false),
        intensity: z.number().min(0).max(1).default(0.7),
      })
      .strict(),
  }),
  z.object({
    generator: z.literal("tone"),
    params: z
      .object({
        /** tuning fork frequency (Hz) */
        freq: z.number().default(512),
        /** stereo position: -1 = patient's/student's left ear, 1 = right */
        pan: z.number().min(-1).max(1).default(0),
        decaySec: z.number().min(0.5).max(30).default(8),
        /** Rinne: air-conduction duration ÷ bone-conduction duration (normal ≈ 2) */
        airBoneRatio: z.number().min(0).max(4).default(2),
      })
      .strict(),
  }),
  z.object({ clipId: z.string().min(1) }).strict(),
]);
export type AudioSpec = z.infer<typeof AudioSpec>;

/** Animation drivers for tools (reflex jerk 0–4+, pupil constriction 0–1, …). */
export const VisualSpec = z.record(z.string(), z.number());

const FindingObject = z
  .object({
    text: z.string().min(1),
    audio: AudioSpec.optional(),
    visual: VisualSpec.optional(),
    /** Position-specific variant (e.g. an S3 louder in left lateral decubitus). Keys are Position values. */
    byPosition: z
      .record(z.string(), z.object({ text: z.string().min(1).optional(), audio: AudioSpec.optional(), visual: VisualSpec.optional() }).strict())
      .optional(),
  })
  .strict();

/** A finding is plain text (phase 1) or text plus optional audio/visual descriptors. */
export const FindingValue = z.union([z.string().min(1), FindingObject]);
export type FindingValue = z.infer<typeof FindingValue>;

/**
 * Normal findings. `default` is required; per-region overrides are optional.
 * Text may contain vitals placeholders such as {vitals.hr} — see engine/resolveFinding.ts.
 */
export const NormalFinding = z.object({ default: FindingValue }).catchall(FindingValue);
export type NormalFinding = z.infer<typeof NormalFinding>;

export const Tool = z.enum(["stethoscope", "tuning_fork", "reflex_hammer", "penlight", "bp_cuff", "hands"]);
export type Tool = z.infer<typeof Tool>;
export const ToolMode = z.enum(["diaphragm", "bell", "128", "512"]);
export type ToolMode = z.infer<typeof ToolMode>;
export const Interaction = z.enum(["click", "place", "sequence", "drag_path"]);
export type Interaction = z.infer<typeof Interaction>;

export const SequenceStep = z
  .object({
    id: slug,
    label: z.string().min(1),
    /** "place": put the tool on a landmark; "signal": wait for the patient's signal (e.g. sound gone). */
    kind: z.enum(["place", "signal"]).default("place"),
    /** Named 3D landmark (see src/exam3d/regionAnchors.ts), resolved per side from the region, e.g. "mastoid". */
    landmark: z.string().optional(),
  })
  .strict();
export type SequenceStep = z.infer<typeof SequenceStep>;

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
  /** How the student performs it in 3D. Omitted = "click" (phase-1 menu behaviour). */
  interaction: Interaction.optional(),
  /** Tool required in the 3D tool tray. Omitted = no tool (hands-free / menu). */
  tool: Tool.optional(),
  /** Tool setting this maneuver needs (bell vs diaphragm, 128 vs 512 Hz fork). */
  toolMode: ToolMode.optional(),
  /** Ordered steps for `sequence` interactions (e.g. Rinne: mastoid → signal → ear canal). */
  steps: z.array(SequenceStep).optional(),
  /** Physical contact? Omitted = true unless technique is "inspect". Drives hand-hygiene rules. */
  touch: z.boolean().optional(),
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

/** maneuverId -> (regionId | "default") -> finding (text, or text + audio/visual) */
export const AbnormalFindings = z.record(ManeuverId, z.record(z.string(), FindingValue));
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
  /**
   * Signs drawn on the 3D model. Must agree with abnormalFindings (validated where checkable).
   * Nothing is drawn that is not listed here.
   */
  visibleSigns: z
    .object({
      /** JVP column height above the sternal angle at 30°, cm. Drawn only when > 3. */
      jvpCm: z.number().min(0).max(20).optional(),
      edema: z.array(z.object({ regionId: RegionId, grade: z.number().int().min(1).max(4) })).optional(),
      breathing: z.enum(["normal", "laboured"]).optional(),
    })
    .optional(),
  /** When finding text appears in the Findings panel. Default "immediate" (OSCE norm). */
  findingsVisibility: z.enum(["immediate", "end"]).optional(),
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
export type PublicCase = Pick<Case, "id" | "title" | "mode" | "doorSign" | "markSheetIds" | "findingsVisibility"> & {
  patient: Pick<Case["patient"], "name" | "age" | "sex" | "pronouns" | "chiefComplaint" | "setting">;
  /**
   * What anyone in the room can see without examining: drawn signs and the rates that drive
   * breathing / venous pulsation animations. (Sounds stay server-side until a finding is elicited.)
   */
  presentation: { visibleSigns: NonNullable<Case["visibleSigns"]>; hr: number; rr: number };
  /** Exam-mode countdown length (doorSign.timeLimitMinutes, or the TIME_LIMIT_SECONDS_OVERRIDE env for tests). */
  timeLimitSeconds: number;
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
  "expose",
  "cover",
]);
export type CourtesyKind = z.infer<typeof CourtesyKind>;

export const FindingResolution = z.enum(["case_region", "case_default", "catalog_region", "catalog_default"]);

export const ExamResult = z.object({
  /** Deterministic finding text resolved in code (never by the model). */
  findingText: z.string(),
  resolvedFrom: FindingResolution,
  /** Natural wording from the AI. Absent/identical when the wording call failed or was skipped. */
  wording: z.string().optional(),
  /** Sound for this finding, from case/catalog data (never chosen by the AI). */
  audio: AudioSpec.optional(),
  /** Animation drivers for this finding. */
  visual: VisualSpec.optional(),
  /** Set in responses to the student when the case reveals findings only at the end (text removed). */
  hidden: z.boolean().optional(),
});
export type ExamResult = z.infer<typeof ExamResult>;

export const Usage = z.object({
  inputTokens: z.number().int().default(0),
  outputTokens: z.number().int().default(0),
  cacheReadTokens: z.number().int().default(0),
  cacheWriteTokens: z.number().int().default(0),
});
export type Usage = z.infer<typeof Usage>;

/** Labels a classifier puts on a student utterance (regex first, model fallback). */
export const CourtesyTag = z.enum([
  "introduced_name",
  "stated_role",
  "confirmed_patient_identity",
  "asked_consent_exam",
  "explained_procedure",
  "asked_comfort",
  "offered_questions",
  "closing",
  "requested_position",
]);
export type CourtesyTag = z.infer<typeof CourtesyTag>;

export const TagHit = z.object({
  tag: CourtesyTag,
  /** Verbatim span of the utterance that triggered the tag. */
  evidence: z.string(),
  via: z.enum(["regex", "model"]),
  /** For requested_position: the position asked for. */
  position: Position.optional(),
});
export type TagHit = z.infer<typeof TagHit>;

/** Technique details a tool interaction adds to an examine action (all optional; click-only exams omit them). */
const ExamTechnique = {
  tool: Tool.optional(),
  toolMode: ToolMode.optional(),
  /** Distance from the target anchor in anchor radii (0 = dead on, >1 = outside the target). */
  placementError: z.number().min(0).max(100).optional(),
  /** How long the tool was held in place (ms). */
  durationMs: z.number().int().min(0).max(600_000).optional(),
  /** Sequence step id (e.g. Rinne "bone" / "signal" / "air"). */
  step: z.string().max(40).optional(),
};

const ExaminePayload = z.object({ regionId: RegionId, maneuverId: ManeuverId, ...ExamTechnique });

const CourtesyPayload = z.object({ kind: CourtesyKind, position: Position.optional(), regionId: RegionId.optional() });

export const DrapeZone = z.enum(["chest", "abdomen", "legs"]);
export type DrapeZone = z.infer<typeof DrapeZone>;

const StateChangePayload = z
  .object({
    position: Position.optional(),
    drape: z.object({ zone: DrapeZone, covered: z.boolean() }).optional(),
    /** how the change was made */
    via: z.enum(["direct", "verbal", "menu"]),
  })
  .refine((p) => p.position || p.drape, "state_change needs a position or drape change");

const HintPayload = z.object({
  kind: z.enum(["hint", "nudge", "show_me", "section_check"]),
  text: z.string().max(500),
  itemId: z.string().optional(),
  maneuverId: ManeuverId.optional(),
});

const TimerPayload = z.object({ event: z.enum(["pause", "resume", "warning", "auto_end"]) });
const RoomPayload = z.object({ event: z.enum(["knock", "enter", "exit"]) });

const SubmitPayload = z.object({
  summary: z.string().max(4000),
  differential: z.array(z.string().min(1).max(300)).min(1).max(10),
  plan: z.string().max(4000),
});

/** The part of an action a client/adapter supplies. The server adds id, sessionId, t, seq and result. */
export const ActionInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("say"), source: ActionSource, payload: z.object({ text: z.string().min(1).max(2000) }) }),
  z.object({ type: z.literal("examine"), source: ActionSource, payload: ExaminePayload }),
  z.object({ type: z.literal("courtesy"), source: ActionSource, payload: CourtesyPayload }),
  z.object({ type: z.literal("note"), source: ActionSource, payload: z.object({ text: z.string().min(1).max(4000) }) }),
  z.object({ type: z.literal("submit_ddx"), source: ActionSource, payload: SubmitPayload }),
  z.object({ type: z.literal("state_change"), source: ActionSource, payload: StateChangePayload }),
  z.object({ type: z.literal("hint"), source: ActionSource, payload: HintPayload }),
  z.object({ type: z.literal("timer"), source: ActionSource, payload: TimerPayload }),
  z.object({ type: z.literal("room"), source: ActionSource, payload: RoomPayload }),
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
  z.object({
    ...actionMeta,
    type: z.literal("say"),
    source: ActionSource,
    /** tags are added server-side by the courtesy classifier */
    payload: z.object({ text: z.string(), tags: z.array(TagHit).optional() }),
  }),
  z.object({
    ...actionMeta,
    type: z.literal("examine"),
    source: ActionSource,
    /** `touch` is set server-side from the catalog (physical contact?) */
    payload: ExaminePayload.extend({ touch: z.boolean().optional() }),
    result: ExamResult.optional(),
  }),
  z.object({ ...actionMeta, type: z.literal("courtesy"), source: ActionSource, payload: CourtesyPayload }),
  z.object({ ...actionMeta, type: z.literal("note"), source: ActionSource, payload: z.object({ text: z.string() }) }),
  z.object({
    ...actionMeta,
    type: z.literal("submit_ddx"),
    source: ActionSource,
    payload: z.object({ summary: z.string(), differential: z.array(z.string()), plan: z.string() }),
  }),
  z.object({ ...actionMeta, type: z.literal("state_change"), source: ActionSource, payload: StateChangePayload }),
  z.object({ ...actionMeta, type: z.literal("hint"), source: ActionSource, payload: HintPayload }),
  z.object({ ...actionMeta, type: z.literal("timer"), source: ActionSource, payload: TimerPayload }),
  z.object({ ...actionMeta, type: z.literal("room"), source: ActionSource, payload: RoomPayload }),
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
 *   "first:touch"                                 first examine involving physical contact
 *   "tag:<CourtesyTag>"                           a `say` the classifier tagged (e.g. "tag:asked_consent_exam")
 *   "room:<knock|enter|exit>"                     a room event
 *   "timer:<pause|resume|warning|auto_end>"       a timer event
 *   "last:examine" | "last:say"                   last action of a type
 */
export const EventRef = z.string().min(1);

export interface TechniqueRule {
  maneuver: string | string[];
  /** every listed region must be done with good technique (fractional credit when partial) */
  regions?: string[];
  tool?: Tool;
  toolMode?: ToolMode;
  /** max placement error in anchor radii (1 = edge of the target) */
  maxPlacementError?: number;
  minDurationMs?: number;
  position?: Position | Position[];
  partial?: boolean;
}

export type Rule =
  | { performed: string | string[]; regions?: string[]; minRegions?: number; partial?: boolean }
  | { said: CourtesyTag | CourtesyTag[] }
  | { technique: TechniqueRule }
  | { hygieneBeforeTouch: true }
  | { happened: string }
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
    z.object({ said: z.union([CourtesyTag, z.array(CourtesyTag).min(1)]) }).strict(),
    z
      .object({
        technique: z
          .object({
            maneuver: z.union([ManeuverId, z.array(ManeuverId).min(1)]),
            regions: z.array(RegionId).optional(),
            tool: Tool.optional(),
            toolMode: ToolMode.optional(),
            maxPlacementError: z.number().min(0).optional(),
            minDurationMs: z.number().int().min(0).optional(),
            position: z.union([Position, z.array(Position).min(1)]).optional(),
            partial: z.boolean().optional(),
          })
          .strict(),
      })
      .strict(),
    z.object({ hygieneBeforeTouch: z.literal(true) }).strict(),
    /** 1 if the event ref occurred at all (e.g. { not: { happened: "timer:auto_end" } }) */
    z.object({ happened: EventRef }).strict(),
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
    /** Only scored in these session modes (e.g. time-dependent items: ["exam"]). Omitted = all modes. */
    modes: z.array(z.enum(["practice", "exam"])).optional(),
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
export const SessionMode = z.enum(["practice", "exam"]);
export type SessionMode = z.infer<typeof SessionMode>;

export const Session = z.object({
  id: z.string(),
  caseId: CaseId,
  studentLabel: z.string(),
  status: SessionStatus,
  /** Phase 2. Missing on phase-1 rows = "exam" (use sessionMode()). */
  mode: SessionMode.optional(),
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
  mode: SessionMode.optional(),
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

export const sessionMode = (s: Pick<Session, "mode">): SessionMode => s.mode ?? "exam";
