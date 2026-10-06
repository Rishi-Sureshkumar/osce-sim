import type { Action } from "@/domain/schemas";
import { COURTESY_LABELS, POSITION_LABELS, mmss } from "@/components/common/format";
import type { ContentIndex } from "@/content/types";
import { orderLog } from "@/engine/order";

/**
 * Plain-text transcript for the grader. Every line carries its action id so the grader can cite
 * evidence; only STUDENT and SUBMISSION lines are quotable (verified server-side).
 */
export function renderTranscript(log: Action[], content: Pick<ContentIndex, "maneuverById" | "regionById">): string {
  const lines: string[] = [];
  for (const a of orderLog(log)) {
    const head = `[${a.id}] ${mmss(a.t)}`;
    switch (a.type) {
      case "say":
        lines.push(`${head} STUDENT: ${a.payload.text}`);
        break;
      case "patient_say":
        lines.push(`${head} PATIENT: ${a.payload.text}`);
        break;
      case "examine": {
        const m = content.maneuverById.get(a.payload.maneuverId)?.label ?? a.payload.maneuverId;
        const r = content.regionById.get(a.payload.regionId)?.label ?? a.payload.regionId;
        lines.push(`${head} EXAM (not quotable): ${m} — ${r} → ${a.result?.findingText ?? ""}`);
        break;
      }
      case "courtesy":
        lines.push(
          `${head} ACTION (not quotable): ${a.payload.kind === "position" && a.payload.position ? `Positioned patient: ${POSITION_LABELS[a.payload.position]}` : COURTESY_LABELS[a.payload.kind]}`,
        );
        break;
      case "note":
        lines.push(`${head} STUDENT NOTE: ${a.payload.text}`);
        break;
      case "submit_ddx":
        lines.push(
          `${head} SUBMISSION:\n${a.payload.summary}\n${a.payload.differential.map((d, i) => `${i + 1}. ${d}`).join("\n")}\n${a.payload.plan}`,
        );
        break;
      default:
        break;
    }
  }
  return lines.join("\n");
}
