import { tickFlow } from "@/server/session";
import { errorResponse } from "@/server/errors";
import { rateLimit } from "@/server/guards";

/** Called by the client at a deadline: the server applies it (encounter end, note lock) and returns the log. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req);
    const { id } = await params;
    const view = await tickFlow(id);
    return Response.json({ status: view.session.status, actions: view.actions });
  } catch (e) {
    return errorResponse(e);
  }
}
