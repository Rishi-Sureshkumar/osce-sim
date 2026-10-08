/**
 * Signed access cookie, verifiable in middleware (Web Crypto only — no Node APIs).
 * Format: `<role>.<expiresAtMs>.<base64url HMAC-SHA256(role.expires)>`
 */
export type Role = "student" | "coach";
export const AUTH_COOKIE = "osce_access";
export const AUTH_TTL_MS = 12 * 60 * 60 * 1000;

const enc = new TextEncoder();

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  let bin = "";
  for (const b of sig) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function signToken(role: Role, secret: string, now = Date.now()): Promise<string> {
  const payload = `${role}.${now + AUTH_TTL_MS}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifyToken(token: string | undefined, secret: string, now = Date.now()): Promise<Role | null> {
  if (!token) return null;
  const [role, exp, sig] = token.split(".");
  if ((role !== "student" && role !== "coach") || !exp || !sig) return null;
  if (!(Number(exp) > now)) return null;
  const expected = await hmac(secret, `${role}.${exp}`);
  return timingSafeEqual(sig, expected) ? role : null;
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface AuthConfig {
  studentCode?: string;
  coachCode?: string;
  secret?: string;
  /** No codes configured outside production → open access (local dev convenience). */
  open: boolean;
  /** Production without codes/secret → fail closed. */
  misconfigured: boolean;
}

export function authConfig(env: Record<string, string | undefined> = process.env): AuthConfig {
  const studentCode = env.ACCESS_CODE || undefined;
  const coachCode = env.COACH_ACCESS_CODE || undefined;
  const secret = env.AUTH_SECRET || undefined;
  const configured = !!(studentCode && coachCode && secret);
  const prod = env.NODE_ENV === "production";
  return { studentCode, coachCode, secret, open: !configured && !prod, misconfigured: !configured && prod };
}
