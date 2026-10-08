import { z } from "zod";
import { createSession } from "@/server/session";
import { errorResponse, HttpError } from "@/server/errors";
import { rateLimit } from "@/server/guards";

const Body = z.object({
  caseId: z.string().min(1),
  studentLabel: z.string().max(80).default(""),
  mode: z.enum(["practice", "exam"]).default("exam"),
  /** "hide": exams with a sound or visual show only what was done; the student interprets */
  findingsDisplay: z.enum(["show", "hide"]).default("show"),
});

export async function POST(req: Request) {
  try {
    rateLimit(req, "create");
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "caseId is required");
    const session = await createSession(body.data.caseId, body.data.studentLabel, body.data.mode, { findingsDisplay: body.data.findingsDisplay });
    return Response.json({ sessionId: session.id });
  } catch (e) {
    return errorResponse(e);
  }
}
