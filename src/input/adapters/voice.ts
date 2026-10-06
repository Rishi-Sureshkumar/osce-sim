import type { ActionInput } from "@/domain/schemas";
import { NotImplemented } from "./notImplemented";

/**
 * Stretch goal. A voice adapter turns a speech transcript into ActionInputs:
 *  - plain speech → { type: "say", source: "voice" } (sent to /chat like typed text)
 *  - spoken exam intent ("I'm going to listen to the heart at the apex") → examine actions,
 *    resolved by the server like clicks. Intent parsing belongs in src/server/ai/.
 */
export function actionsFromTranscript(_transcript: string): ActionInput[] {
  throw new NotImplemented("Voice input");
}
