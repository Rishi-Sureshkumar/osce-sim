import "server-only";
import type { Action } from "@/domain/schemas";
import { runPatientTurn } from "./ai/patient";
import { getRepo } from "./db";
import { HttpError } from "./errors";
import { assertCanChat } from "./guards";
import { appendStudentAction, appendSystemAction, getCaseOr404, getSessionOr404, recordUsage } from "./session";

/** NDJSON events streamed to the browser for one chat turn. */
export type ChatEvent =
  | { type: "student"; action: Action }
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
  const studentAction = await appendStudentAction(sessionId, { type: "say", source, payload: { text: clean } });
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
