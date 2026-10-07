import "server-only";
import type { Action } from "@/domain/schemas";
import { understand, type ClientClauseVector } from "@/lang/server";
import { courtesyFallbackTags } from "@/lang/tags";
import { regexTags } from "./tags";
import { getRepo } from "./db";
import { HttpError } from "./errors";
import { assertCanChat } from "./guards";
import { appendStudentAction, appendSystemAction, getCaseOr404, getSessionOr404, redactForStudent } from "./session";

/** NDJSON events streamed to the browser for one chat turn. */
export type ChatEvent =
  | { type: "student"; action: Action }
  /** actions the utterance implied, e.g. a spoken "could you sit up" → state_change */
  | { type: "implied"; action: Action }
  | { type: "delta"; text: string }
  | { type: "patient"; action: Action }
  | { type: "error"; message: string };

/** What the browser may add to a chat turn: its own clause embeddings (optional, never trusted for grading). */
export interface ClientEmbedding {
  model: string;
  clauses: ClientClauseVector[];
}

/** The student's name, from the evidence of their latest "introduced_name" tag ("my name is Sam Patel" → "Sam"). */
function studentNameFrom(log: readonly Action[]): string | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const a = log[i]!;
    if (a.type !== "say") continue;
    const ev = a.payload.tags?.find((t) => t.tag === "introduced_name")?.evidence;
    const m = ev?.match(/([A-Z][a-z'-]+)(?:\s+[A-Z][a-z'-]+)?\s*$/);
    if (m) return m[1]!;
  }
  return null;
}

/**
 * One chat turn: append the student's `say`, stream the patient's reply, append `patient_say`.
 * The reply is always fixed text from the case or the conversation bank (src/lang); no model writes
 * it. Validation errors are thrown before streaming starts so the route can return a status code.
 */
export async function startChatTurn(sessionId: string, text: string, source: "text" | "voice" = "text", client?: ClientEmbedding): Promise<ReadableStream<Uint8Array>> {
  const clean = text.trim();
  if (!clean) throw new HttpError(400, "Message is empty");
  const session = await getSessionOr404(sessionId);
  assertCanChat(session);
  const kase = getCaseOr404(session.caseId);
  // Courtesy tags: regex first, then similarity to example phrasings (evidence = the student's own sentence).
  let tags = regexTags(clean);
  if (!tags.length) tags = await courtesyFallbackTags(clean);
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
        const prior = log.filter((a) => a.id !== studentAction.id && !implied.some((x) => x.id === a.id));
        const u = await understand(kase, prior, clean, { clientVectors: client?.clauses, clientModel: client?.model, studentName: studentNameFrom(log) });
        // speak it word by word, so the chat bubble and the patient's mouth move as before
        for (const word of u.reply.text.split(/(?<= )/)) {
          send({ type: "delta", text: word });
          await new Promise((r) => setTimeout(r, 12));
        }
        const patientAction = await appendSystemAction(sessionId, { type: "patient_say", source: "system", payload: { text: u.reply.text, match: u.reply.match } });
        send({ type: "patient", action: redactForStudent(patientAction, kase, session) });
      } catch (e) {
        console.error("[chat] patient turn failed", e);
        send({ type: "error", message: "The patient didn't respond — please try again." });
      } finally {
        if (!clientGone) controller.close();
      }
    },
  });
}
