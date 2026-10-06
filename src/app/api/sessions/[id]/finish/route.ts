import { z } from "zod";
import { finishSession } from "@/server/finish";
import { errorResponse, HttpError } from "@/server/errors";
import { rateLimit } from "@/server/guards";

const Body = z.object({
  submission: z
    .object({
      payload: z.object({
        summary: z.string().max(4000),
        differential: z.array(z.string()).min(1).max(10),
        plan: z.string().max(4000),
      }),
    })
    .nullable()
    .default(null),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req);
    const { id } = await params;
    const body = Body.safeParse(await req.json().catch(() => ({})));
    if (!body.success) throw new HttpError(400, "Invalid submission");
    const actions = await finishSession(id, body.data.submission);
    return Response.json({ actions, resultsUrl: `/results/${id}` });
  } catch (e) {
    return errorResponse(e);
  }
}
