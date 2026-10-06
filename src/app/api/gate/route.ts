import { z } from "zod";
import { AUTH_COOKIE, AUTH_TTL_MS, authConfig, signToken, timingSafeEqual, type Role } from "@/server/authToken";
import { errorResponse, HttpError } from "@/server/errors";
import { rateLimit } from "@/server/guards";

const Body = z.object({ code: z.string().min(1).max(200) });

export async function POST(req: Request) {
  try {
    rateLimit(req, "gate");
    const cfg = authConfig();
    if (cfg.misconfigured || !cfg.secret) throw new HttpError(503, "Access codes are not configured on this deployment.");
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "Enter an access code.");
    const code = body.data.code.trim();
    const role: Role | null = timingSafeEqual(code, cfg.coachCode!) ? "coach" : timingSafeEqual(code, cfg.studentCode!) ? "student" : null;
    if (!role) throw new HttpError(401, "That code isn't right.");
    const token = await signToken(role, cfg.secret);
    const res = Response.json({ role });
    res.headers.append(
      "set-cookie",
      `${AUTH_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${AUTH_TTL_MS / 1000}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE() {
  const res = Response.json({ ok: true });
  res.headers.append("set-cookie", `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
}
