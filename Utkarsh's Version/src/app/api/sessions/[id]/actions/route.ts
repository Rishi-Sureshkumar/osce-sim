import { appendStudentActions } from "@/server/session";
import { errorResponse } from "@/server/errors";
import { rateLimit } from "@/server/guards";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req);
    const { id } = await params;
    const { action, appended } = await appendStudentActions(id, await req.json().catch(() => null));
    return Response.json({ action, actions: appended });
  } catch (e) {
    return errorResponse(e);
  }
}
