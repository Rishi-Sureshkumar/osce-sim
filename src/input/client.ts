"use client";
import type { Action, ActionInput } from "@/domain/schemas";

/** Browser helper: send any adapter-produced ActionInput to the server's single write path. */
export async function postAction(sessionId: string, input: ActionInput): Promise<Action> {
  const res = await fetch(`/api/sessions/${sessionId}/actions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body.action as Action;
}
