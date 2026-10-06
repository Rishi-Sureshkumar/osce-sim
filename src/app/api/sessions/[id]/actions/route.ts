import { appendStudentAction } from "@/server/session";
import { errorResponse } from "@/server/errors";
import { rateLimit } from "@/server/guards";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req);
    const { id } = await params;
    const action = await appendStudentAction(id, await req.json().catch(() => null));
    return Response.json({ action });
  } catch (e) {
    return errorResponse(e);
  }
}
