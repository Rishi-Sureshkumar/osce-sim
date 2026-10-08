import type { Action, ActionInput } from "@/domain/schemas";

/** Builds an action log from inputs, one second apart. */
export function makeLog(inputs: (ActionInput | Omit<Extract<Action, { type: "patient_say" }>, "id" | "sessionId" | "t">)[]): Action[] {
  return inputs.map((a, i) => ({ ...a, id: `a${i + 1}`, sessionId: "s1", t: i * 1000 }) as Action);
}

export const examine = (maneuverId: string, regionId: string): ActionInput => ({
  type: "examine",
  source: "click",
  payload: { maneuverId, regionId },
});
export const courtesy = (kind: "hand_hygiene" | "introduce" | "consent" | "drape" | "position" | "close_encounter", position?: string): ActionInput =>
  ({ type: "courtesy", source: "toolbar", payload: { kind, ...(position ? { position } : {}) } }) as ActionInput;
export const say = (text: string): ActionInput => ({ type: "say", source: "text", payload: { text } });
