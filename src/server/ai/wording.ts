import "server-only";
import { getRepo } from "../db";
import { hasAiBudget, limits } from "../guards";
import { getAnthropic, isMockMode, toUsage } from "./client";
import { MODELS } from "./models";
import { passesWordingGuard } from "./wordingGuard";

const SYSTEM = `You reword physical-examination findings for a medical-student simulator.
Rewrite the FINDING as one or two natural sentences describing what the examiner observes (second person is fine, e.g. "You feel…", "You hear…").
Do not add, remove or change any clinical detail: keep every number, grade, side, location and qualifier exactly. Do not interpret or diagnose.
Output only the reworded finding.`;

/**
 * Optional AI wording of a deterministic finding (job (b) of the AI). Returns null — and the UI
 * shows the raw finding — in mock mode, on any error/timeout, or if the output fails the guard.
 */
export async function wordFinding(
  sessionId: string,
  f: { maneuverLabel: string; regionLabel: string; findingText: string },
): Promise<string | null> {
  if (isMockMode()) return null;
  try {
    const repo = await getRepo();
    const session = await repo.getSession(sessionId);
    if (!session || !hasAiBudget(session)) return null;
    const msg = await getAnthropic().messages.create(
      {
        model: MODELS.wording,
        max_tokens: limits().wordingMaxOutputTokens,
        system: SYSTEM,
        messages: [{ role: "user", content: `EXAM: ${f.maneuverLabel} — ${f.regionLabel}\nFINDING: ${f.findingText}` }],
      },
      { timeout: 6000, maxRetries: 0 },
    );
    const { recordUsage } = await import("../session");
    await recordUsage(sessionId, toUsage(msg.usage));
    const text = msg.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("")
      .trim();
    return passesWordingGuard(f.findingText, text) ? text : null;
  } catch (e) {
    console.warn("[ai] wording failed, showing raw finding:", (e as Error).message);
    return null;
  }
}
