"use client";
import type { Action } from "@/domain/schemas";
import { sayFromText } from "./adapters/text";
import { sayFromVoice } from "./adapters/voice";
import { embedClausesNow } from "@/lang/embed/browser";
import { clientNormalizer } from "@/lang/clientNormalizer";
import { splitClauses } from "@/lang/split";

type ChatEvent =
  | { type: "student"; action: Action }
  | { type: "implied"; action: Action }
  | { type: "delta"; text: string }
  | { type: "patient"; action: Action }
  | { type: "error"; message: string };

/** Sends a `say` through the chat endpoint and consumes the NDJSON stream. */
export async function sendChat(
  sessionId: string,
  text: string,
  handlers: { onStudent: (a: Action) => void; onDelta: (t: string) => void; onPatient: (a: Action) => void },
  source: "text" | "voice" = "text",
): Promise<void> {
  const input = source === "voice" ? sayFromVoice(text) : sayFromText(text);
  // the browser's own embeddings of each clause, if its model is already loaded (optional)
  const embedding = await embedClausesNow(splitClauses(input.payload.text, clientNormalizer()));
  const res = await fetch(`/api/sessions/${sessionId}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: input.payload.text, source: input.source, ...(embedding ? { embedding } : {}) }),
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Chat failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const e = JSON.parse(line) as ChatEvent;
      if (e.type === "student" || e.type === "implied") handlers.onStudent(e.action);
      else if (e.type === "delta") handlers.onDelta(e.text);
      else if (e.type === "patient") handlers.onPatient(e.action);
      else throw new Error(e.message);
    }
  }
}
