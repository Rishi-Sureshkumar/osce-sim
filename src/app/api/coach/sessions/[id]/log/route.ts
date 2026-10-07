import { getRepo } from "@/server/db";
import { errorResponse, HttpError } from "@/server/errors";

/**
 * QA only (QA_HOOKS=true; coach role via middleware): the full, unredacted action log, so the
 * catalog/visual harnesses can assert what was logged without reading the UI.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (process.env.QA_HOOKS !== "true") throw new HttpError(404, "Not found");
    const { id } = await params;
    const repo = await getRepo();
    if (!(await repo.getSession(id))) throw new HttpError(404, "Session not found");
    return Response.json({ actions: await repo.listActions(id) });
  } catch (e) {
    return errorResponse(e);
  }
}
