import { z } from "zod";
import { backgroundAudio, previewAudio } from "@/server/session";
import { errorResponse, HttpError } from "@/server/errors";
import { rateLimit } from "@/server/guards";

const Body = z.union([z.object({ maneuverId: z.string().min(1), regionId: z.string().min(1) }), z.object({ background: z.enum(["heart", "breath"]) })]);

/** Audio for a held tool (no text, nothing logged; the placement is logged on release). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req, "listen");
    const { id } = await params;
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "maneuverId and regionId (or background) are required");
    if ("background" in body.data) return Response.json(await backgroundAudio(id, body.data.background));
    return Response.json(await previewAudio(id, body.data.maneuverId, body.data.regionId));
  } catch (e) {
    return errorResponse(e);
  }
}
