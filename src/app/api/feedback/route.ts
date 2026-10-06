import { z } from "zod";
import { cookies } from "next/headers";
import { getRepo } from "@/server/db";
import { errorResponse, HttpError } from "@/server/errors";
import { rateLimit } from "@/server/guards";
import { newId } from "@/server/ids";
import { AUTH_COOKIE, authConfig, verifyToken } from "@/server/authToken";

const Body = z.object({
  sessionId: z.string().max(100).nullable().default(null),
  rating: z.number().int().min(1).max(5).nullable().default(null),
  fairness: z.enum(["fair", "too_harsh", "too_lenient", "unsure"]).nullable().default(null),
  text: z.string().max(5000).default(""),
  page: z.string().max(200),
});

export async function POST(req: Request) {
  try {
    rateLimit(req, "feedback");
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "Invalid feedback");
    if (!body.data.text.trim() && body.data.rating === null && body.data.fairness === null) throw new HttpError(400, "Please add a rating or a comment.");
    const cfg = authConfig();
    const role = cfg.open ? "student" : ((await verifyToken((await cookies()).get(AUTH_COOKIE)?.value, cfg.secret ?? "")) ?? "student");
    await (await getRepo()).addFeedback({ id: newId("fb"), ...body.data, role, createdAt: new Date().toISOString() });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
