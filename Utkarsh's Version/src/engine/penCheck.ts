/**
 * Deterministic cross-check of the post-encounter note's physical-exam section against the log:
 * each claim (line, bullet or sentence) is matched to catalog maneuvers by their `penTerms` and by
 * the case's `penKey.exam` keywords, then linked to the exams that were actually performed.
 * A claim about a maneuver that was never performed is flagged. Pure; unit-tested.
 */
import type { Action, ExamManeuver, PenKey } from "@/domain/schemas";
import { orderLog } from "./order";

export interface PenClaim {
  text: string;
  /** maneuvers the claim is about (empty: no recognisable exam term) */
  maneuverIds: string[];
  /** supporting examine / on-target tool_contact actions */
  actionIds: string[];
  status: "linked" | "flagged" | "unmatched";
}

export interface PenCheckResult {
  claims: PenClaim[];
  flagged: number;
  linked: number;
}

export function splitClaims(text: string): string[] {
  return text
    .split(/\n+|(?<=[.;])\s+(?=[A-Z0-9])/)
    .map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter((s) => s.length > 1);
}

const norm = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'");
/** whole-word-ish match so "s3" doesn't match "s30" and "jvp" doesn't match inside another word */
function mentions(claim: string, term: string): boolean {
  const t = norm(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${t}([^a-z0-9]|$)`).test(claim);
}

export function penCheck(
  examText: string,
  maneuvers: readonly Pick<ExamManeuver, "id" | "penTerms">[],
  penKeyExam: PenKey["exam"],
  log: readonly Action[],
): PenCheckResult {
  const ordered = orderLog(log);
  const claims = splitClaims(examText).map((text): PenClaim => {
    const c = norm(text);
    const ids = new Set<string>();
    for (const m of maneuvers) if (m.penTerms?.some((t) => mentions(c, t))) ids.add(m.id);
    for (const k of penKeyExam) if (k.keywords.some((t) => mentions(c, t))) k.maneuverIds.forEach((id) => ids.add(id));
    const maneuverIds = [...ids];
    if (!maneuverIds.length) return { text, maneuverIds, actionIds: [], status: "unmatched" };
    const actionIds = ordered
      .filter(
        (a) =>
          (a.type === "examine" && maneuverIds.includes(a.payload.maneuverId)) ||
          (a.type === "tool_contact" && a.payload.outcome === "finding" && !!a.payload.maneuverId && maneuverIds.includes(a.payload.maneuverId)),
      )
      .map((a) => a.id);
    return { text, maneuverIds, actionIds, status: actionIds.length ? "linked" : "flagged" };
  });
  return { claims, flagged: claims.filter((c) => c.status === "flagged").length, linked: claims.filter((c) => c.status === "linked").length };
}
