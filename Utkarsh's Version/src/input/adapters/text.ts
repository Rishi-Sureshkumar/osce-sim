import type { ActionInput } from "@/domain/schemas";

/** Typed chat to the patient. Sent via POST /api/sessions/[id]/chat, which streams the reply. */
export function sayFromText(text: string): Extract<ActionInput, { type: "say" }> {
  return { type: "say", source: "text", payload: { text: text.trim() } };
}

export function submitFromForm(summary: string, differential: string[], plan: string): ActionInput {
  return {
    type: "submit_ddx",
    source: "text",
    payload: { summary: summary.trim(), differential: differential.map((d) => d.trim()).filter(Boolean), plan: plan.trim() },
  };
}
