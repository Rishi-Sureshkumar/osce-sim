import { savePenDraft } from "@/server/session";
import { errorResponse } from "@/server/errors";
import { rateLimit } from "@/server/guards";

/** Autosave of the post-encounter note draft (the server submits it if time runs out). */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req);
    const { id } = await params;
    return Response.json(await savePenDraft(id, await req.json().catch(() => null)));
  } catch (e) {
    return errorResponse(e);
  }
}
