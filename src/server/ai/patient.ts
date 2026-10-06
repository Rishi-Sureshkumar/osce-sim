import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { Action, Case, Usage } from "@/domain/schemas";
import { limits } from "../guards";
import { getAnthropic, isMockMode, toUsage } from "./client";
import { mockPatientReply } from "./mock";
import { FALLBACK_BETA, MODELS } from "./models";
import { PATIENT_RULES, buildCaseBlock, buildMessages } from "./patientPrompt";

export interface PatientTurnResult {
  text: string;
  usage: Usage;
  mocked: boolean;
}

/**
 * Generates the patient's reply to the conversation in `log` (which already ends with the
 * student's latest `say`). Streams text deltas through `onText`.
 * The model only ever sees history facts, persona and unknownPolicy — never exam findings or the differential.
 */
export async function runPatientTurn(kase: Case, log: Action[], onText: (delta: string) => void): Promise<PatientTurnResult> {
  if (isMockMode()) {
    const turnIndex = log.filter((a) => a.type === "patient_say").length;
    const lastSay = [...log].reverse().find((a) => a.type === "say");
    const text = mockPatientReply(kase, lastSay?.type === "say" ? lastSay.payload.text : "", turnIndex);
    for (const word of text.split(/(?<= )/)) {
      onText(word);
      await new Promise((r) => setTimeout(r, 12));
    }
    return { text, usage: toUsage(null), mocked: true };
  }

  const messages = cacheLastTurn(buildMessages(log));
  const stream = getAnthropic().beta.messages.stream({
    model: MODELS.patient,
    max_tokens: limits().patientMaxOutputTokens,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    // Short spoken replies: thinking off between tools (there are none) keeps latency low.
    thinking: { type: "between_tools" },
    output_config: { effort: "low" },
    system: [
      { type: "text", text: PATIENT_RULES },
      { type: "text", text: buildCaseBlock(kase), cache_control: { type: "ephemeral" } },
    ],
    messages,
  });
  stream.on("text", (delta) => onText(delta));
  const final = await stream.finalMessage();
  let text = final.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("")
    .trim();
  if (final.stop_reason === "refusal" || !text) {
    text = kase.history.unknownPolicy.unknownReply;
    onText(text);
  }
  return { text, usage: toUsage(final.usage), mocked: false };
}

/** Cache the conversation prefix so each turn only pays full price for the new message. */
function cacheLastTurn(messages: Anthropic.Beta.BetaMessageParam[]): Anthropic.Beta.BetaMessageParam[] {
  const last = messages.at(-1);
  if (!last || typeof last.content !== "string") return messages;
  return [
    ...messages.slice(0, -1),
    { role: last.role, content: [{ type: "text", text: last.content, cache_control: { type: "ephemeral" } }] },
  ];
}
