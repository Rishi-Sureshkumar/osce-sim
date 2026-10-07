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

/**
 * Phase 3: where a region lives in the 3D room. Drives the region-focus camera shot, the
 * "Examine…" menu grouping and the panel buttons (whole patient, neuro domains).
 */
export const RegionGroup = z.enum(["head_neck", "chest_front", "chest_back", "abdomen", "arms", "hands", "legs", "feet", "whole", "neuro"]);
export type RegionGroup = z.infer<typeof RegionGroup>;

export const Position = z.enum([
  "seated",
  "seated_leaning_forward",
  "supine",
  "reclined_30",
  "reclined_45",
  "left_lateral_decubitus",
  "prone",
  "standing",
  /** Phase 4: sitting on the edge of the table, knees flexed, lower legs hanging free (patellar/Achilles reflexes). */
  "sitting_dangling",
]);
export type Position = z.infer<typeof Position>;

/**
 * Phase 4: sectioned drapes. Each section is a separate cloth piece that can be folded back on its own.
 * `pelvis` is never exposed. `back` is the back opening of the gown.
 */
export const DrapeSection = z.enum(["chest_left", "chest_right", "abdomen", "pelvis", "leg_left", "leg_right", "back"]);
export type DrapeSection = z.infer<typeof DrapeSection>;

/** Phase 4: emotional cue on a fact; drives how the patient acknowledges empathy. */
export const Emotion = z.enum(["neutral", "worried", "anxious", "sad", "frustrated", "embarrassed", "in_pain", "tired", "relieved"]);
export type Emotion = z.infer<typeof Emotion>;

export const Severity = z.enum(["info", "minor", "major", "critical"]);
export type Severity = z.infer<typeof Severity>;

/** Phase 4: "show" = interpreted finding text; "hide" = raw stimulus only, the student interprets it. */
export const FindingsDisplay = z.enum(["show", "hide"]);
export type FindingsDisplay = z.infer<typeof FindingsDisplay>;

export const Technique = z.enum(["inspect", "palpate", "percuss", "auscultate", "special"]);
export type Technique = z.infer<typeof Technique>;

// ---------------------------------------------------------------------------
// Regions (canonical, stable — the 3D room and any future VR renderer map to these ids)
// ---------------------------------------------------------------------------

export const Region = z.object({
  id: RegionId,
  label: z.string().min(1),
  system: System,
  /** Phase 3 grouping for the 3D room (see RegionGroup). */
  group: RegionGroup,
  /** Examined verbally only (standardized patients stay masked: mouth, nose). */
  verbal: z.boolean().optional(),
  /** Kept for id stability but never offered for examination (old 2D zoom aliases). */
  hidden: z.boolean().optional(),
  /** Phase 4: drape sections that cover this region (exam through cover is a mistake). */
  drapeSections: z.array(DrapeSection).optional(),
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
        /** Phase 4: S2 loudness relative to S1 (1 = normal); < 0.4 = soft S2 (e.g. aortic stenosis) */
        s2Intensity: z.number().min(0).max(1).optional(),
        /** Phase 4: early systolic ejection click loudness 0–1 */
        ejectionClick: z.number().min(0).max(1).optional(),
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
  /** Phase 4: Korotkoff sounds during cuff deflation. Pressures default to the case vitals at resolve time. */
  z.object({
    generator: z.literal("korotkoff"),
    params: z
      .object({
        systolic: z.number().int().min(40).max(300).optional(),
        diastolic: z.number().int().min(20).max(200).optional(),
        /** phase IV (muffling) starts this many mmHg above diastolic */
        muffleMmHg: z.number().min(0).max(20).default(6),
        auscultatoryGap: z.tuple([z.number(), z.number()]).optional(),
        intensity: z.number().min(0).max(1).default(0.7),
      })
      .strict(),
  }),
  /** Phase 4: percussion note under the finger. */
  z.object({
    generator: z.literal("percussion"),
    params: z
      .object({
        note: z.enum(["resonant", "hyperresonant", "dull", "stony_dull", "tympanic", "flat"]),
        intensity: z.number().min(0).max(1).default(0.8),
      })
      .strict(),
  }),
  /** Phase 4: transmitted voice through the stethoscope (vocal resonance, egophony, whispered pectoriloquy). */
  z.object({
    generator: z.literal("voice"),
    params: z
      .object({
        phrase: z.enum(["ee", "ninety_nine", "whisper_123"]),
        transmission: z.enum(["normal", "increased", "decreased", "absent"]).default("normal"),
        /** "ee" heard as "ay" */
        egophony: z.boolean().default(false),
      })
      .strict(),
  }),
  z.object({ clipId: z.string().min(1) }).strict(),
]);
export type AudioSpec = z.infer<typeof AudioSpec>;

/**
 * Animation drivers for tools. Known keys: reflex (0–4 grade), clonusBeats (0–10),
 * pupilConstriction (0–1, direct), pupilConsensual (0–1), pittingDepthMm.
 */
export const VisualSpec = z.record(z.string(), z.number());

/** Phase 4: the patient's own reaction to a maneuver (a stimulus in hide-findings mode). Case text only. */
export const PatientResponse = z
  .object({
    /** what the patient says, e.g. "It feels duller on that side." */
    say: z.string().min(1).optional(),
    /** brief pain grimace */
    wince: z.boolean().optional(),
  })
  .strict();
export type PatientResponse = z.infer<typeof PatientResponse>;

const FindingObject = z
  .object({
    text: z.string().min(1),
    audio: AudioSpec.optional(),
    visual: VisualSpec.optional(),
    /** Phase 4: patient reaction (spoken words / wince). */
    response: PatientResponse.optional(),
    /** Phase 4: words a correct interpretation would use (hide-findings recognition). */
    terms: z.array(z.string().min(1)).optional(),
    /** Position-specific variant (e.g. an S3 louder in left lateral decubitus). Keys are Position values. */
    byPosition: z
      .record(
        z.string(),
        z.object({ text: z.string().min(1).optional(), audio: AudioSpec.optional(), visual: VisualSpec.optional(), response: PatientResponse.optional() }).strict(),
      )
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

export const Tool = z.enum(["stethoscope", "tuning_fork", "reflex_hammer", "penlight", "bp_cuff", "hands", "cotton_swab", "pin"]);
export type Tool = z.infer<typeof Tool>;
export const ToolMode = z.enum(["diaphragm", "bell", "128", "512"]);
export type ToolMode = z.infer<typeof ToolMode>;
export const Interaction = z.enum(["click", "place", "sequence", "drag_path"]);
export type Interaction = z.infer<typeof Interaction>;

export const SequenceStep = z
  .object({
    id: slug,
    label: z.string().min(1),
    /**
     * "place": put the tool on a landmark; "signal": wait for the patient's signal (e.g. sound gone);
     * "control": operate an on-screen control (BP gauge, support the arm).
     */
    kind: z.enum(["place", "signal", "control"]).default("place"),
    /** Named 3D landmark (see src/exam3d/regionAnchors.ts), resolved per side from the region, e.g. "mastoid". */
    landmark: z.string().optional(),
    /** Phase 4: tool for this step when it differs from the maneuver's (BP: cuff → hands → stethoscope). */
    tool: Tool.optional(),
    toolMode: ToolMode.optional(),
    /** Phase 4: how close to the landmark counts (cm). */
    toleranceCm: z.number().min(0.3).max(10).optional(),
    minDurationMs: z.number().int().min(0).max(30_000).optional(),
    /** Phase 4: also record this maneuver when the step is done (e.g. "wrap" records bp_cuff_placement). */
    logsManeuver: ManeuverId.optional(),
    control: z.enum(["bp_gauge", "support_arm"]).optional(),
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
  /**
   * Words a post-encounter note uses for this maneuver's findings (e.g. "S3", "gallop" for the bell).
   * Used to flag notes that report findings from maneuvers that were never performed.
   */
  penTerms: z.array(z.string().min(1)).optional(),
  /** Phase 4: tool tolerance for this maneuver (cm), overriding the anchor's (penlight = iris). */
  toleranceCm: z.number().min(0.2).max(20).optional(),
  /** Phase 4: must the region be uncovered? Default: true for touch maneuvers on draped regions. */
  requiresExposure: z.boolean().optional(),
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

/**
 * Phase 4: how a student might ask for something. Matched deterministically (src/lang):
 * exact paraphrase → keyword / pattern → embedding similarity to canonical + paraphrases.
 */
export const Intent = z
  .object({
    canonical: z.string().min(3),
    paraphrases: z.array(z.string().min(3)).max(30).default([]),
    /** word-boundary phrases matched after normalisation */
    keywords: z.array(z.string().min(1)).default([]),
    /** regular-expression sources (case-insensitive) */
    patterns: z.array(z.string().min(1)).default([]),
    /** history-coverage topics this question covers (content/lang/topics.json), e.g. "pmh.conditions" */
    topics: z.array(slug).default([]),
  })
  .strict();
export type Intent = z.infer<typeof Intent>;

export const FollowUp = z
  .object({ id: slug, intents: Intent, answer: z.string().min(1), emotion: Emotion.optional() })
  .strict();

export const HistoryFact = z.object({
  id: slug,
  topic: z.string().min(1),
  answer: z.string().min(1),
  /** true: only disclose when the student asks about this topic. false: patient may volunteer it. */
  revealOnlyIfAsked: z.boolean(),
  /** Legacy keywords (merged into intents.keywords by the matcher). */
  keywords: z.array(z.string()).optional(),
  /** Phase 4: how students ask for this fact (required for encounter cases by `npm run validate`). */
  intents: Intent.optional(),
  /** Phase 4: narrower questions about the same fact ("how many pillows?"). */
  followUps: z.array(FollowUp).default([]),
  emotion: Emotion.optional(),
});
export type HistoryFact = z.infer<typeof HistoryFact>;

export const PertinentNegative = z.object({
  /** Phase 4: stable id (the matcher derives "neg-<topic slug>" when missing). */
  id: slug.optional(),
  topic: z.string().min(1),
  answer: z.string().min(1),
  keywords: z.array(z.string()).optional(),
  intents: Intent.optional(),
  emotion: Emotion.optional(),
});

/** Phase 4: conversational turns that are not history facts (greeting, consent, empathy, …). */
export const ConversationKind = z.enum([
  "opening",
  "greeting",
  "introduction",
  "how_are_you",
  "consent",
  "explain_exam",
  "position_request",
  "anything_else",
  "empathy",
  "thanks",
  "closing",
  "small_talk",
  "repeat",
  "clarify",
  "name_check",
]);
export type ConversationKind = z.infer<typeof ConversationKind>;
export const ConversationReply = z
  .object({
    kind: ConversationKind,
    intents: Intent.optional(),
    /** case text; may use {patient.name} {patient.firstName} {patient.lastName} {student.name} */
    replies: z.array(z.string().min(1)).min(1),
    emotion: Emotion.optional(),
  })
  .strict();
export type ConversationReply = z.infer<typeof ConversationReply>;

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

/** What the student reads on the door before the encounter (1B: vitals, task, exams not to perform). */
export const DoorInstructions = z.object({
  reasonForVisit: z.string().min(1),
  task: z.string().min(1),
  /** Exams that must not be done in this encounter; clicking these regions logs a prohibited_attempt. */
  prohibitedExams: z.array(z.object({ label: z.string().min(1), regionIds: z.array(RegionId).min(1) })).default([]),
});
export type DoorInstructions = z.infer<typeof DoorInstructions>;

export const TimeLimits = z.object({
  encounterMin: z.number().int().min(1),
  /** Post-encounter note (PEN). */
  penMin: z.number().int().min(1),
});
export type TimeLimits = z.infer<typeof TimeLimits>;

/** Faculty answer key for the post-encounter note (graded by the AI, quotes verified). */
export const PenKey = z.object({
  history: z.array(
    z.object({
      id: slug,
      text: z.string().min(1),
      kind: z.enum(["positive", "negative"]),
      keywords: z.array(z.string()).default([]),
      /** Phase 4: accepted terms and synonyms (word-boundary match) */
      terms: z.array(z.string()).default([]),
      /** Phase 4: example note sentences (embedding similarity) */
      exemplars: z.array(z.string()).default([]),
    }),
  ),
  exam: z.array(
    z.object({
      id: slug,
      text: z.string().min(1),
      maneuverIds: z.array(ManeuverId).default([]),
      keywords: z.array(z.string()).default([]),
      terms: z.array(z.string()).default([]),
      exemplars: z.array(z.string()).default([]),
    }),
  ),
  differential: z.array(
    z.object({ id: slug, diagnosis: z.string().min(1), aliases: z.array(z.string()).default([]), rank: z.number().int().min(1), rationale: z.string().min(1) }),
  ),
});
export type PenKey = z.infer<typeof PenKey>;

/** Phase 4: diagnoses accepted in the post-encounter note (with synonyms); `satisfies` earns penKey.differential items. */
export const AcceptableDiagnosis = z
  .object({ id: slug, diagnosis: z.string().min(1), synonyms: z.array(z.string()).default([]), satisfies: z.array(slug).default([]) })
  .strict();
export type AcceptableDiagnosis = z.infer<typeof AcceptableDiagnosis>;

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
    /** Phase 4: case-specific conversational replies (override content/lang/conversation.json). */
    conversation: z.array(ConversationReply).default([]),
    /** Phase 4: how the patient acknowledges empathy for each emotion. */
    emotionCues: z.array(z.object({ emotion: Emotion, acknowledgement: z.string().min(1) })).default([]),
    /** Phase 4: history topics that don't apply to this patient (e.g. "sh.sexual" for a child); credited with reason. */
    notRelevantTopics: z.array(slug).default([]),
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
  /** Phase 3 (1B OSCE). */
  doorInstructions: DoorInstructions.optional(),
  timeLimits: TimeLimits.optional(),
  /** Case-specific SP physical-exam checklist (auto rules). Joins the patient-encounter domain. */
  peChecklist: z.array(z.lazy((): z.ZodType<MarkSheetItem> => MarkSheetItem as unknown as z.ZodType<MarkSheetItem>)).optional(),
  penKey: PenKey.optional(),
  /** Phase 4 */
  acceptableDiagnoses: z.array(AcceptableDiagnosis).default([]),
  mistakes: z.array(z.lazy((): z.ZodType<MistakeRule> => MistakeRuleSchema as unknown as z.ZodType<MistakeRule>)).default([]),
  itemsNotApplicable: z.array(z.object({ itemId: z.string().min(1), reason: z.string().min(1) })).default([]),
  /** Phase 4: default findings display when a session starts (the student can change it in the case picker). */
  defaultFindingsDisplay: FindingsDisplay.optional(),
  synthetic: z.literal(true),
  sourceNote: z.string().min(1),
});
export type Case = z.infer<typeof Case>;

/** What the browser is allowed to see about a case (no history facts, findings or differential). */
export type PublicCase = Pick<Case, "id" | "title" | "mode" | "doorSign" | "markSheetIds" | "findingsVisibility" | "doorInstructions" | "timeLimits" | "vitals"> & {
  patient: Pick<Case["patient"], "name" | "age" | "sex" | "pronouns" | "chiefComplaint" | "setting">;
  /**
   * What anyone in the room can see without examining: drawn signs and the rates that drive
   * breathing / venous pulsation animations. (Sounds stay server-side until a finding is elicited.)
   */
  presentation: { visibleSigns: NonNullable<Case["visibleSigns"]>; hr: number; rr: number };
  /** Exam-mode countdown length (doorSign.timeLimitMinutes, or the TIME_LIMIT_SECONDS_OVERRIDE env for tests). */
  timeLimitSeconds: number;
  /**
   * The 1B flow (door → "You may begin" → encounter → PEN), for encounter cases with timeLimits.
   * Seconds, after ENCOUNTER_SECONDS_OVERRIDE / PEN_SECONDS_OVERRIDE (tests).
   */
  flow?: { encounterSeconds: number; penSeconds: number };
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
  /** Phase 4: what was done, without the finding ("Auscultated mitral area, bell, left lateral decubitus"). */
  doneText: z.string().optional(),
  /** Phase 4: a text-only finding with no sensory stimulus, shown even in hide-findings mode. */
  reported: z.boolean().optional(),
  /** Phase 4: the patient's reaction. */
  response: PatientResponse.optional(),
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
  /** Phase 4: shared an impression / assessment with the patient */
  "shared_impression",
]);
export type CourtesyTag = z.infer<typeof CourtesyTag>;

/** Phase 4: how the deterministic matcher understood one utterance (server-set, coach/dev only). */
export const UtteranceMatch = z.object({
  clauses: z
    .array(
      z.object({
        text: z.string(),
        target: z.string(),
        kind: z.enum(["fact", "negative", "follow_up", "conversation", "bank", "unknown"]),
        score: z.number(),
        via: z.enum(["exact", "keyword", "pattern", "embedding", "none"]),
      }),
    )
    .max(6),
  topics: z.array(slug).default([]),
  embedding: z.enum(["client", "server", "none"]),
});
export type UtteranceMatch = z.infer<typeof UtteranceMatch>;

export const TagHit = z.object({
  tag: CourtesyTag,
  /** Verbatim span of the utterance that triggered the tag. */
  evidence: z.string(),
  /** regex · similarity (Phase 4: embedding similarity to example phrasings) · model (legacy logs) */
  via: z.enum(["regex", "similarity", "model"]),
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
  /** Phase 3: distance from the hidden anchor (cm) and that anchor's tolerance. */
  distanceCm: z.number().min(0).max(500).optional(),
  toleranceCm: z.number().min(0).max(50).optional(),
};

const ExaminePayload = z.object({ regionId: RegionId, maneuverId: ManeuverId, ...ExamTechnique });

const CourtesyPayload = z.object({ kind: CourtesyKind, position: Position.optional(), regionId: RegionId.optional() });

export const DrapeZone = z.enum(["chest", "abdomen", "legs"]);
export type DrapeZone = z.infer<typeof DrapeZone>;

const DrapeChange = z
  .object({
    /** legacy (Phase 2–3) zone: chest | abdomen | legs */
    zone: DrapeZone.optional(),
    /** Phase 4 section */
    section: DrapeSection.optional(),
    covered: z.boolean(),
  })
  .refine((d) => !!d.zone !== !!d.section, "a drape change names exactly one of zone / section");

const StateChangePayload = z
  .object({
    position: Position.optional(),
    drape: DrapeChange.optional(),
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

const TimerPayload = z.object({
  event: z.enum(["pause", "resume", "warning", "auto_end", "begin", "encounter_warning", "encounter_end", "pen_warning", "pen_lock"]),
});
const RoomPayload = z.object({ event: z.enum(["knock", "enter", "exit"]) });

const DescribeExamPayload = z.object({ regionId: RegionId, text: z.string().min(1).max(2000) });
const ProhibitedPayload = z.object({ regionId: RegionId });

export const ContactOutcome = z.enum(["finding", "near", "background", "nothing"]);
export type ContactOutcome = z.infer<typeof ContactOutcome>;
/** One tool placement on the body. Logged for every contact; never shown to the student during the encounter. */
const ToolContactPayload = z.object({
  tool: Tool,
  toolMode: ToolMode.optional(),
  maneuverId: ManeuverId.optional(),
  nearestRegionId: RegionId.nullable(),
  distanceCm: z.number().min(0).max(500),
  toleranceCm: z.number().min(0).max(50),
  durationMs: z.number().int().min(0).max(600_000),
  outcome: ContactOutcome,
});

/** Phase 4: the student's interpretation of a stimulus in hide-findings mode. */
const InterpretationPayload = z.object({
  examActionId: z.string().min(1),
  regionId: RegionId,
  maneuverId: ManeuverId,
  text: z.string().min(1).max(500),
});

/** Phase 4: session settings. findingsDisplay is fixed at session start. */
export const SessionSettings = z
  .object({
    findingsDisplay: FindingsDisplay.default("show"),
    /** "default" = on in practice, off in exam */
    alerts: z.enum(["default", "on", "off"]).default("default"),
    /** optional in-browser LLM that rewords the chosen patient reply (display only) */
    enhancedPatient: z.boolean().default(false),
  })
  .strict();
export type SessionSettings = z.infer<typeof SessionSettings>;
const SettingsChangePayload = z.object({ alerts: z.enum(["default", "on", "off"]).optional(), enhancedPatient: z.boolean().optional() }).strict();

/** Phase 4: a mistake rule fired (server-generated). */
const MistakePayload = z.object({
  ruleId: slug,
  severity: Severity,
  message: z.string().max(200),
  causeActionId: z.string().optional(),
  /** shown to the student as an alert at the time (depends on mode and settings) */
  alerted: z.boolean(),
});

/** 1B post-encounter note: history, physical exam, up to 3 diagnoses (no workup). */
export const PenPayload = z.object({
  history: z.string().max(6000),
  exam: z.string().max(6000),
  diagnoses: z
    // at least one unless the note was locked at time-up (the finish route checks)
    .array(z.object({ diagnosis: z.string().min(1).max(300), support: z.string().max(2000).optional() }))
    .max(3),
  /** set by the server when the note was locked at time-up (submitted at the deadline or from the autosaved draft) */
  locked: z.boolean().optional(),
});
export type PenPayload = z.infer<typeof PenPayload>;

/** The PEN as typed so far: autosaved by the server so time-up can submit it if the browser misses the deadline. */
export const PenDraft = z.object({
  history: z.string().max(6000),
  exam: z.string().max(6000),
  diagnoses: z.array(z.object({ diagnosis: z.string().max(300), support: z.string().max(2000).optional() })).max(3),
});
export type PenDraft = z.infer<typeof PenDraft>;

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
  z.object({ type: z.literal("sit_down"), source: ActionSource, payload: z.object({}).default({}) }),
  z.object({ type: z.literal("describe_exam"), source: ActionSource, payload: DescribeExamPayload }),
  z.object({ type: z.literal("prohibited_attempt"), source: ActionSource, payload: ProhibitedPayload }),
  z.object({ type: z.literal("tool_contact"), source: ActionSource, payload: ToolContactPayload }),
  z.object({ type: z.literal("submit_pen"), source: ActionSource, payload: PenPayload }),
  z.object({ type: z.literal("interpretation"), source: ActionSource, payload: InterpretationPayload }),
  z.object({ type: z.literal("settings"), source: ActionSource, payload: SettingsChangePayload }),
]);
export type ActionInput = z.infer<typeof ActionInput>;

/** Server-generated actions (never accepted from the client). */
export const SystemActionInput = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("patient_say"),
    source: z.literal("system"),
    payload: z.object({ text: z.string(), mocked: z.boolean().optional(), match: UtteranceMatch.optional() }),
  }),
  z.object({
    type: z.literal("session_start"),
    source: z.literal("system"),
    payload: z.object({ caseId: CaseId, settings: SessionSettings.optional() }),
  }),
  z.object({ type: z.literal("session_end"), source: z.literal("system"), payload: z.object({ reason: z.string() }) }),
  z.object({ type: z.literal("mistake"), source: z.literal("system"), payload: MistakePayload }),
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
    /** tags (and the Phase 4 match) are added server-side */
    payload: z.object({ text: z.string(), tags: z.array(TagHit).optional(), match: UtteranceMatch.optional() }),
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
  z.object({ ...actionMeta, type: z.literal("sit_down"), source: ActionSource, payload: z.object({}).default({}) }),
  z.object({ ...actionMeta, type: z.literal("describe_exam"), source: ActionSource, payload: DescribeExamPayload }),
  z.object({ ...actionMeta, type: z.literal("prohibited_attempt"), source: ActionSource, payload: ProhibitedPayload }),
  z.object({ ...actionMeta, type: z.literal("tool_contact"), source: ActionSource, payload: ToolContactPayload }),
  z.object({ ...actionMeta, type: z.literal("submit_pen"), source: ActionSource, payload: PenPayload }),
  z.object({ ...actionMeta, type: z.literal("interpretation"), source: ActionSource, payload: InterpretationPayload }),
  z.object({ ...actionMeta, type: z.literal("settings"), source: ActionSource, payload: SettingsChangePayload }),
  z.object({
    ...actionMeta,
    type: z.literal("patient_say"),
    source: z.literal("system"),
    payload: z.object({ text: z.string(), mocked: z.boolean().optional(), match: UtteranceMatch.optional() }),
  }),
  z.object({
    ...actionMeta,
    type: z.literal("session_start"),
    source: z.literal("system"),
    payload: z.object({ caseId: z.string(), settings: SessionSettings.optional() }),
  }),
  z.object({ ...actionMeta, type: z.literal("session_end"), source: z.literal("system"), payload: z.object({ reason: z.string() }) }),
  z.object({ ...actionMeta, type: z.literal("mistake"), source: z.literal("system"), payload: MistakePayload }),
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
 *   "drape_change"                                draping, exposing or covering (courtesy or direct manipulation)
 *   "drape:cover" | "drape:expose"                a zone covered (incl. re-draping) / uncovered
 *   "sit_down"                                    the student sat down (removes a barrier)
 *   "describe:<regionId>"                         a verbal exam description for that region
 *   "prohibited:<regionId>" | "prohibited_attempt"  an attempt at an exam the door instructions exclude
 *   "last:examine" | "last:say"                   last action of a type
 * Phase 4:
 *   "mistake:<ruleId>"                            a mistake rule fired
 *   "interpretation" | "settings"                 a hide-mode interpretation / settings change
 *   "drape:expose:<section>" | "drape:cover:<section>"  a specific drape section uncovered / covered
 *   "region:<regionId>"                           an examine of that region (any maneuver)
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

/**
 * Phase 4: the patient/room state at the time of the event being checked (or now, when there is none).
 * Used by mistake triggers (`when` / `unless`) and comfort items.
 */
export interface StateCondition {
  handsClean?: boolean;
  position?: Position | Position[];
  /** every listed section is uncovered */
  exposedAll?: DrapeSection[];
  /** at least one listed section is uncovered */
  exposedAny?: DrapeSection[];
  /** at least N sections uncovered at once */
  exposedCountAtLeast?: number;
  /** the region of the triggering examine/contact was under a covered drape section */
  eventRegionCovered?: boolean;
  /** some section has been uncovered for at least this long without an exam of a region it covers */
  exposedIdleMsAtLeast?: number;
  inRoom?: boolean;
}

export type Rule =
  | { performed: string | string[]; regions?: string[]; minRegions?: number; partial?: boolean }
  | { said: CourtesyTag | CourtesyTag[] }
  | { technique: TechniqueRule }
  | { hygieneBeforeTouch: true }
  | { placedWithin: { maneuver: string | string[]; regions?: string[]; position?: Position | Position[]; partial?: boolean } }
  | { happened: string }
  | { courtesy: CourtesyKind; position?: Position }
  | { before: [string, string] }
  | { performedIn: { maneuver: string | string[]; position: Position | Position[] } }
  | { submitted: "submit_ddx" | "submit_pen" }
  | { state: StateCondition }
  | { drapeDiscipline: { recoverWithinMs?: number; partial?: boolean } }
  | { penUnperformed: { atLeast?: number } }
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
    z.object({ submitted: z.enum(["submit_ddx", "submit_pen"]) }).strict(),
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
    /**
     * 1 if the maneuver produced a recorded finding: a tool placement inside the anchor tolerance
     * (tool_contact outcome "finding") or, for click maneuvers, an examine. Optional region/position filter.
     */
    z
      .object({
        placedWithin: z
          .object({
            maneuver: z.union([ManeuverId, z.array(ManeuverId).min(1)]),
            regions: z.array(RegionId).min(1).optional(),
            position: z.union([Position, z.array(Position).min(1)]).optional(),
            partial: z.boolean().optional(),
          })
          .strict(),
      })
      .strict(),
    /** 1 if the event ref occurred at all (e.g. { not: { happened: "timer:auto_end" } }) */
    z.object({ happened: EventRef }).strict(),
    /** Phase 4: state at the event (mistake triggers) or now */
    z
      .object({
        state: z
          .object({
            handsClean: z.boolean().optional(),
            position: z.union([Position, z.array(Position).min(1)]).optional(),
            exposedAll: z.array(DrapeSection).min(1).optional(),
            exposedAny: z.array(DrapeSection).min(1).optional(),
            exposedCountAtLeast: z.number().int().min(1).optional(),
            eventRegionCovered: z.boolean().optional(),
            exposedIdleMsAtLeast: z.number().int().min(0).optional(),
            inRoom: z.boolean().optional(),
          })
          .strict(),
      })
      .strict(),
    /** Phase 4: every exposed section re-covered after its exam (within recoverWithinMs, if given) */
    z
      .object({ drapeDiscipline: z.object({ recoverWithinMs: z.number().int().min(0).optional(), partial: z.boolean().optional() }).strict() })
      .strict(),
    /** Phase 4: the PEN reports at least N findings from maneuvers never performed (penCheck) */
    z.object({ penUnperformed: z.object({ atLeast: z.number().int().min(1).optional() }).strict() }).strict(),
    z.object({ all: z.array(Rule).min(1) }).strict(),
    z.object({ any: z.array(Rule).min(1) }).strict(),
    z.object({ not: Rule }).strict(),
  ]),
);

/** Phase 4: where a `match` item looks for evidence. */
export const MatchSource = z.enum(["say", "describe_exam", "pen_history", "pen_exam", "pen_diagnoses", "interpretation"]);
export type MatchSource = z.infer<typeof MatchSource>;

/**
 * Phase 4: deterministic language matching for an item (src/lang/grade/match.ts):
 * keyword / pattern hit, or embedding similarity to exemplars, over sentence-split student text.
 * The matched sentence is the verbatim evidence quote.
 */
export const MatchSpec = z
  .object({
    sources: z.array(MatchSource).min(1).default(["say"]),
    /** word-boundary phrases; may use {patient.name} {patient.firstName} {patient.lastName} */
    keywords: z.array(z.string().min(1)).default([]),
    patterns: z.array(z.string().min(1)).default([]),
    exemplars: z.array(z.string().min(1)).default([]),
    /** if one of these is closer than the best exemplar, no credit */
    counterExemplars: z.array(z.string().min(1)).default([]),
    /** credit when a student question covers one of these history topics */
    topics: z.array(slug).default([]),
    form: z.enum(["any", "open", "closed"]).default("any"),
    polarity: z.enum(["any", "affirmed", "negated"]).default("any"),
    minMatches: z.number().int().min(1).default(1),
    window: z.enum(["any", "before_first_touch", "after_last_touch", "first_third", "last_third"]).default("any"),
    /** deductions when the matched text also hits these (e.g. jargon, deferring to the attending) */
    penalties: z
      .array(
        z
          .object({
            id: slug,
            keywords: z.array(z.string()).default([]),
            patterns: z.array(z.string()).default([]),
            exemplars: z.array(z.string()).default([]),
            value: z.number().min(0).max(1),
            reason: z.string().min(1),
          })
          .strict(),
      )
      .default([]),
    /** override the default credit / review similarity thresholds */
    thresholds: z.object({ credit: z.number().min(0).max(1), review: z.number().min(0).max(1) }).optional(),
  })
  .strict();
export type MatchSpec = z.infer<typeof MatchSpec>;

export const MarkSheetItem = z
  .object({
    id: slug,
    fcmId: z.number().int().min(1).max(120).optional(),
    section: z.string().min(1),
    label: z.string().min(1),
    weight: z.number().min(0),
    /** Phase 4: "match" (deterministic language matching) replaces "ai"; legacy "ai" content is read as "match". */
    scoring: z.preprocess((v) => (v === "ai" ? "match" : v), z.enum(["auto", "match", "not_assessable"])),
    rule: Rule.optional(),
    /** What a coach should look for, in our own words (shown in the coach view). */
    guidance: z.string().optional(),
    /** Phase 4: how a `match` item is scored. */
    match: MatchSpec.optional(),
    /** Example student phrases (shorthand for match.exemplars). */
    exemplars: z.array(z.string().min(1)).optional(),
    /** Legacy (Phase 1–3 mock grader) phrases; read as match.keywords. */
    mockKeywords: z.array(z.string()).optional(),
    /** Only scored in these session modes (e.g. time-dependent items: ["exam"]). Omitted = all modes. */
    modes: z.array(z.enum(["practice", "exam"])).optional(),
    /** For `not_assessable` items: why we can't score it from this interface. */
    notAssessableReason: z.string().optional(),
    sourceText: z.string().default(""),
  })
  .superRefine((item, ctx) => {
    if (item.scoring === "auto" && !item.rule) ctx.addIssue({ code: "custom", message: `auto item ${item.id} needs a rule` });
    if (item.scoring === "match" && !item.guidance) ctx.addIssue({ code: "custom", message: `match item ${item.id} needs guidance` });
  });
export type MarkSheetItem = z.infer<typeof MarkSheetItem>;

/** 1B OSCE scoring domains: a station passes only when every domain it scores passes. */
export const Domain = z.enum(["patient_encounter", "communication"]);
export type Domain = z.infer<typeof Domain>;

export const MarkSheet = z.object({
  id: MarkSheetId,
  title: z.string().min(1),
  kind: z.enum(["exam", "history"]),
  /** Phase 3: which pass/fail domain this sheet counts toward. */
  domain: Domain.optional(),
  /** Fraction of domain points needed to pass (data, e.g. 0.7). */
  passThreshold: z.number().min(0).max(1).optional(),
  /** Credit line kept with the sheet (e.g. the communication checklist's author). */
  attribution: z.string().optional(),
  sourceNote: z.string(),
  items: z.array(MarkSheetItem).min(1),
});
export type MarkSheet = z.infer<typeof MarkSheet>;

// ---------------------------------------------------------------------------
// Mistake rules (Phase 4): data, in the same rule language as mark sheets.
// content/mistakes.json holds the shared set; a case can add its own (Case.mistakes).
// ---------------------------------------------------------------------------

export const SessionModeEnum = z.enum(["practice", "exam"]);

export const MistakeTrigger = z
  .object({
    /** the action that can fire the rule (checked when it is appended) */
    on: z
      .object({
        /** an action type, or "touch" (an examine/contact involving physical contact) */
        type: z.string().min(1).optional(),
        /** or an event ref (same syntax as rules, e.g. "room:exit", "drape:expose") */
        ref: EventRef.optional(),
        maneuver: z.union([ManeuverId, z.array(ManeuverId).min(1)]).optional(),
        region: z.union([RegionId, z.array(RegionId).min(1)]).optional(),
        tool: Tool.optional(),
        toolMode: ToolMode.optional(),
        /** the patient position at that moment */
        position: z.union([Position, z.array(Position).min(1)]).optional(),
      })
      .strict(),
    /** fire only if this rule is satisfied at that moment */
    when: Rule.optional(),
    /** never fire if this rule is satisfied at that moment */
    unless: Rule.optional(),
  })
  .strict();
export type MistakeTrigger = z.infer<typeof MistakeTrigger>;

export interface MistakeRule {
  id: string;
  label: string;
  message: string;
  severity: Severity;
  modes: ("practice" | "exam")[];
  appliesTo?: { sex?: ("female" | "male" | "intersex")[]; caseModes?: ("encounter" | "screening")[] };
  trigger: MistakeTrigger;
  once: boolean;
  anchor: "exam_view" | "chat" | "door" | "tool" | "drape" | "note";
}
export const MistakeRuleSchema = z
  .object({
    id: slug,
    label: z.string().min(1),
    /** one line shown in the alert */
    message: z.string().min(1).max(140),
    severity: Severity,
    /** session modes in which the rule is checked (it is always logged when it fires; alerts depend on settings) */
    modes: z.array(SessionModeEnum).default(["practice", "exam"]),
    appliesTo: z
      .object({
        sex: z.array(z.enum(["female", "male", "intersex"])).optional(),
        caseModes: z.array(z.enum(["encounter", "screening"])).optional(),
      })
      .strict()
      .optional(),
    trigger: MistakeTrigger,
    /** fire at most once per session */
    once: z.boolean().default(true),
    /** where the red "!" appears */
    anchor: z.enum(["exam_view", "chat", "door", "tool", "drape", "note"]).default("exam_view"),
  })
  .strict();
export const MistakesFile = z.object({ mistakes: z.array(MistakeRuleSchema) });

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
  /** Legacy (Phase 1–3 model token usage). Not recorded from Phase 4. */
  usage: Usage.optional(),
  /** Phase 3: last autosaved post-encounter note (never sent to scoring; submit_pen is). */
  penDraft: PenDraft.nullable().optional(),
  /** Phase 4: mirror of the session settings (the log's session_start / settings actions are authoritative). */
  settings: SessionSettings.nullable().optional(),
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
  /** "ai" = legacy grading runs (Phase 1–3 model grader) */
  scoring: z.enum(["auto", "match", "ai", "not_assessable"]),
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
  /** Legacy (Phase 1–3) */
  usage: Usage.optional(),
  mocked: z.boolean().optional(),
  /** Phase 4: "deterministic"; legacy runs were graded by a model */
  grader: z.enum(["deterministic", "ai_legacy"]).optional(),
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

// ---------------------------------------------------------------- Phase 4: language banks (content/lang)
/** content/lang/topics.json — history-coverage topics (intents and mark-sheet items refer to them). */
export const TopicsFile = z
  .object({ topics: z.array(z.object({ id: slug, label: z.string().min(1), group: z.string().min(1) }).strict()) })
  .strict();
/** content/lang/synonyms.json — normalisation: every `from` phrase is rewritten to `to` before matching. */
export const SynonymsFile = z
  .object({ entries: z.array(z.object({ to: z.string().min(1), from: z.array(z.string().min(1)).min(1) }).strict()) })
  .strict();
/** content/lang/conversation.json — the default conversational replies (a case's history.conversation overrides by kind). */
export const ConversationBankFile = z.object({ replies: z.array(ConversationReply) }).strict();
/**
 * content/lang/history-bank.json — generic history questions (review of systems, social history…).
 * When a case has no fact or negative for one, the patient gives the case's unknownPolicy reply:
 * `negative` → negativeReply ("No, nothing like that"), `unknown` → unknownReply. Never new facts.
 */
export const HistoryBankFile = z
  .object({ entries: z.array(z.object({ id: slug, topic: slug, intents: Intent, reply: z.enum(["negative", "unknown"]) }).strict()) })
  .strict();
/**
 * tests/fixtures/chat/<caseId>.json — what students ask and what the patient should answer from.
 * Targets: fact:<id> · neg:<id> · followup:<factId>/<id> · conv:<kind> · bank:<id> (bank:* = any generic
 * history-bank question, for blind authors) · unknown.
 * A bundled question lists every target. Written blind (without seeing the case's paraphrases).
 */
export const ChatFixtureFile = z
  .object({
    caseId: z.string().min(1),
    author: z.string().min(1),
    blind: z.boolean(),
    items: z.array(z.object({ q: z.string().min(1), expect: z.array(z.string().regex(/^(fact|neg|followup|conv|bank):[a-z0-9_.\/*-]+$|^unknown$/)).min(1), note: z.string().optional() }).strict()).min(1),
  })
  .strict();
