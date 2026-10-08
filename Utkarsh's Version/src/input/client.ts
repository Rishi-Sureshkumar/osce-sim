"use client";
import type { Action, ActionInput } from "@/domain/schemas";

let queue: Promise<unknown> = Promise.resolve();

/**
 * Browser helper: send any adapter-produced ActionInput to the server's single write path.
 * Requests from one tab are serialised so the log order matches the order of clicks.
 * Resolves to the main action plus every action the server appended for it (e.g. an automatic
 * drape `expose` before it, a practice nudge after it), in log order.
 */
export function postAction(sessionId: string, input: ActionInput): Promise<{ action: Action; appended: Action[] }> {
  const next = queue.then(() => send(sessionId, input));
  queue = next.catch(() => undefined);
  return next;
}

async function send(sessionId: string, input: ActionInput): Promise<{ action: Action; appended: Action[] }> {
  const res = await fetch(`/api/sessions/${sessionId}/actions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return { action: body.action as Action, appended: (body.actions as Action[] | undefined) ?? [body.action as Action] };
}
