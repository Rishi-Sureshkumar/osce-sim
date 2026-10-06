import "server-only";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { Action, Case, MarkSheet, Usage } from "@/domain/schemas";
import type { ContentIndex } from "@/content/types";
import type { AiItemJudgement } from "@/engine/scoring";
import { limits } from "../guards";
import { getAnthropic, isMockMode, toUsage } from "./client";
import { mockJudgements } from "./mock";
import { FALLBACK_BETA, MODELS } from "./models";
import { renderTranscript } from "./transcript";

const GraderOutput = z.object({
  items: z.array(
    z.object({
      itemId: z.string(),
      score: z.number(),
      rationale: z.string(),
      evidence: z.array(z.object({ actionId: z.string(), quote: z.string() })),
    }),
  ),
  summary: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
});

export interface GraderResult {
  judgements: AiItemJudgement[];
  summary: string;
  strengths: string[];
  improvements: string[];
  usage: Usage;
  mocked: boolean;
}

const SYSTEM = `You are an experienced OSCE examiner grading a medical student's station from a timestamped transcript.

Scoring rules:
- Score every listed item with 0 (not done), 0.5 (partly done) or 1 (done well), following that item's guidance.
- Credit only what the transcript shows. Do not assume anything happened that is not in it.
- Evidence must be exact quotes: copy a short, contiguous span of the student's words character-for-character from ONE line, and give that line's id in actionId. Only lines marked STUDENT, STUDENT NOTE or SUBMISSION may be quoted. Quotes are checked by machine; any paraphrase will be rejected.
- Any score above 0 needs at least one quote. A score of 0 may have no evidence.
- Keep each rationale to one sentence.

Then write feedback for the student:
- summary: 3–5 sentences on overall performance, grounded in what they actually did (mention specific moments).
- strengths: 2–4 specific things done well.
- improvements: 2–4 specific, actionable improvements. For clinical reasoning, explain why a missed question or finding matters for this patient.`;

export async function gradeAiItems(args: {
  kase: Case;
  sheets: MarkSheet[];
  log: Action[];
  content: Pick<ContentIndex, "maneuverById" | "regionById">;
  deterministicSummary: string;
}): Promise<GraderResult> {
  const aiItems = args.sheets.flatMap((s) => s.items.filter((i) => i.scoring === "ai"));

  if (isMockMode()) {
    const judgements = args.sheets.flatMap((s) => mockJudgements(s, args.log));
    const got = judgements.filter((j) => j.score > 0).length;
    return {
      judgements,
      summary: `[Mock feedback] ${got} of ${judgements.length} transcript-graded items had matching evidence. ${args.deterministicSummary.split(". Not done")[0]}.`,
      strengths: ["[Mock] Deterministic exam scoring is shown item by item below."],
      improvements: ["[Mock] Turn off AI_MOCK and set ANTHROPIC_API_KEY for real narrative feedback."],
      usage: toUsage(null),
      mocked: true,
    };
  }

  const c = args.kase;
  const caseBlock = [
    `CASE: ${c.title}`,
    `Patient: ${c.patient.name}, ${c.patient.age}, ${c.patient.sex}. Chief complaint: ${c.patient.chiefComplaint}.`,
    `Task given to the student: ${c.doorSign.task}`,
    c.expectedDifferential.length
      ? `Expected differential (for grading reasoning items):\n${c.expectedDifferential.map((d) => `${d.rank}. ${d.diagnosis} — ${d.rationale}`).join("\n")}`
      : "No differential is expected for this station.",
  ].join("\n");
  const itemsBlock = aiItems.map((i) => `- ${i.id} | ${i.section} | ${i.label} | guidance: ${i.guidance}`).join("\n");

  const msg = await getAnthropic().beta.messages.parse({
    model: MODELS.grader,
    max_tokens: limits().graderMaxOutputTokens,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(GraderOutput) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `${caseBlock}\n\nDETERMINISTIC EXAM SCORING ALREADY DONE (context for feedback only):\n${args.deterministicSummary}\n\nTRANSCRIPT:\n${renderTranscript(args.log, args.content)}\n\nITEMS TO GRADE (${aiItems.length}):\n${itemsBlock}`,
      },
    ],
  });
  const out = msg.parsed_output;
  if (msg.stop_reason === "refusal" || !out) throw new Error(`Grader returned no structured output (stop_reason=${msg.stop_reason})`);
  const known = new Set(aiItems.map((i) => i.id));
  return {
    judgements: out.items.filter((j) => known.has(j.itemId)),
    summary: out.summary,
    strengths: out.strengths,
    improvements: out.improvements,
    usage: toUsage(msg.usage),
    mocked: false,
  };
}
