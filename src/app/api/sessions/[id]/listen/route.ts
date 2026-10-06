import { z } from "zod";
import { previewAudio } from "@/server/session";
import { errorResponse, HttpError } from "@/server/errors";
import { rateLimit } from "@/server/guards";

const Body = z.object({ maneuverId: z.string().min(1), regionId: z.string().min(1) });

/** Audio for a held tool (no text, nothing logged; the placement is logged on release). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req, "listen");
    const { id } = await params;
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "maneuverId and regionId are required");
    return Response.json(await previewAudio(id, body.data.maneuverId, body.data.regionId));
  } catch (e) {
    return errorResponse(e);
  }
}
