import "server-only";
import type { Action } from "@/domain/schemas";
import { runPatientTurn } from "./ai/patient";
import { modelTags } from "./ai/tagger";
import { needsModelFallback, regexTags } from "./tags";
import { getRepo } from "./db";
import { HttpError } from "./errors";
import { assertCanChat } from "./guards";
import { appendStudentAction, appendSystemAction, getCaseOr404, getSessionOr404, recordUsage } from "./session";

/** NDJSON events streamed to the browser for one chat turn. */
export type ChatEvent =
  | { type: "student"; action: Action }
  /** actions the utterance implied, e.g. a spoken "could you sit up" → state_change */
  | { type: "implied"; action: Action }
  | { type: "delta"; text: string }
  | { type: "patient"; action: Action }
  | { type: "error"; message: string };

/**
 * One chat turn: append the student's `say`, stream the patient's reply, append `patient_say`.
 * Validation errors are thrown before streaming starts so the route can return a status code.
 */
export async function startChatTurn(sessionId: string, text: string, source: "text" | "voice" = "text"): Promise<ReadableStream<Uint8Array>> {
  const clean = text.trim();
  if (!clean) throw new HttpError(400, "Message is empty");
  const session = await getSessionOr404(sessionId);
  assertCanChat(session);
  const kase = getCaseOr404(session.caseId);
  // Courtesy tags: regex first, model fallback only when nothing matched and the words suggest courtesy.
  let tags = regexTags(clean);
  if (needsModelFallback(clean, tags)) {
    const m = await modelTags(clean);
    if (m.usage) await recordUsage(sessionId, m.usage);
    tags = m.tags;
  }
  const studentAction = await appendStudentAction(sessionId, { type: "say", source, payload: { text: clean } }, { tags });
  const implied: Action[] = [];
  const asked = tags.find((t) => t.tag === "requested_position" && t.position);
  if (asked?.position) {
    implied.push(await appendStudentAction(sessionId, { type: "state_change", source, payload: { position: asked.position, via: "verbal" } }));
  }
  const repo = await getRepo();
  await repo.updateSession(sessionId, { patientTurns: session.patientTurns + 1 });

  const enc = new TextEncoder();
  let clientGone = false;
  return new ReadableStream<Uint8Array>({
    cancel() {
      clientGone = true;
    },
    async start(controller) {
      // The turn always completes and is logged, even if the browser disconnects mid-stream.
      const send = (e: ChatEvent) => {
        if (clientGone) return;
        try {
          controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
        } catch {
          clientGone = true;
        }
      };
      send({ type: "student", action: studentAction });
      for (const a of implied) send({ type: "implied", action: a });
      try {
        const log = await repo.listActions(sessionId);
        const result = await runPatientTurn(kase, log, (delta) => send({ type: "delta", text: delta }));
        await recordUsage(sessionId, result.usage);
        const patientAction = await appendSystemAction(sessionId, {
          type: "patient_say",
          source: "system",
          payload: { text: result.text, ...(result.mocked ? { mocked: true } : {}) },
        });
        send({ type: "patient", action: patientAction });
      } catch (e) {
        console.error("[chat] patient turn failed", e);
        send({ type: "error", message: "The patient didn't respond — please try again." });
      } finally {
        if (!clientGone) controller.close();
      }
    },
  });
}
