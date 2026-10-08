import { z } from "zod";
import { getContent } from "@/content/load";
import { errorResponse, HttpError } from "@/server/errors";
import { bankFor, understand } from "@/lang/server";
import { THRESHOLDS } from "@/lang/thresholds";

const Body = z.object({ caseId: z.string().min(1), text: z.string().min(1).max(2000) });

/**
 * Dev chat tester (coach role via middleware; development or QA_HOOKS only): how the deterministic
 * patient understands a line — normalised text, clauses, top matches with scores, the reply.
 */
export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV === "production" && process.env.QA_HOOKS !== "true") throw new HttpError(404, "Not found");
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "caseId and text are required");
    const kase = getContent().caseById.get(body.data.caseId);
    if (!kase) throw new HttpError(404, "Unknown case");
    const u = await understand(kase, [], body.data.text);
    return Response.json({
      normalized: bankFor(kase).normalize(body.data.text),
      clauses: u.clauses.map((c) => ({ text: c.text, target: c.target?.id ?? null, score: c.score, via: c.via, top: c.top })),
      reply: u.reply.text,
      embedding: u.embedding,
      thresholds: { accept: THRESHOLDS.accept, margin: THRESHOLDS.margin },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
