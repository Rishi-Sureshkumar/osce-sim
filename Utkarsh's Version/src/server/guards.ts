import "server-only";
import type { Session } from "@/domain/schemas";
import { HttpError } from "./errors";

/** Integer env var with a default (invalid or missing → default). */
export function intEnv(name: string, fallback: number): number {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Abuse guards (there is no paid model to protect any more; Phase 4 M1 removed the token caps). */
export function limits() {
  return {
    rateLimitPerMinute: intEnv("RATE_LIMIT_PER_MINUTE", 60),
  };
}

export function assertCanChat(s: Session) {
  if (s.status !== "active") throw new HttpError(409, "This session has ended.");
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
