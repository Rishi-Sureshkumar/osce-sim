import "server-only";
import type { Session } from "@/domain/schemas";
import { intEnv } from "./ai/client";
import { HttpError } from "./errors";

/** Cost guards. All overridable via env (see .env.example). */
export function limits() {
  return {
    maxPatientTurns: intEnv("MAX_PATIENT_TURNS", 40),
    patientMaxOutputTokens: intEnv("PATIENT_MAX_OUTPUT_TOKENS", 350),
    wordingMaxOutputTokens: intEnv("WORDING_MAX_OUTPUT_TOKENS", 200),
    graderMaxOutputTokens: intEnv("GRADER_MAX_OUTPUT_TOKENS", 12000),
    maxSessionTokens: intEnv("MAX_SESSION_TOKENS", 400_000),
    rateLimitPerMinute: intEnv("RATE_LIMIT_PER_MINUTE", 60),
  };
}

export function sessionTokens(s: Session): number {
  const u = s.usage;
  return u.inputTokens + u.outputTokens + u.cacheReadTokens + u.cacheWriteTokens;
}

export function assertCanChat(s: Session) {
  const l = limits();
  if (s.status !== "active") throw new HttpError(409, "This session has ended.");
  if (s.patientTurns >= l.maxPatientTurns) throw new HttpError(429, `Patient turn limit reached (${l.maxPatientTurns}). Please finish the station.`);
  if (sessionTokens(s) >= l.maxSessionTokens) throw new HttpError(429, "This session has reached its AI usage limit.");
}

/** True when the session still has AI budget for optional calls (e.g. finding wording). */
export function hasAiBudget(s: Session): boolean {
  return sessionTokens(s) < limits().maxSessionTokens;
}

// --- per-IP rate limit (in-memory, per server instance; good enough for a demo) ---
const hits = new Map<string, number[]>();

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export function rateLimit(req: Request, bucket = "api") {
  const key = `${bucket}:${clientIp(req)}`;
  const now = Date.now();
  const windowStart = now - 60_000;
  const list = (hits.get(key) ?? []).filter((t) => t > windowStart);
  if (list.length >= limits().rateLimitPerMinute) throw new HttpError(429, "Too many requests — slow down a little.");
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if ((v.at(-1) ?? 0) < windowStart) hits.delete(k);
}
