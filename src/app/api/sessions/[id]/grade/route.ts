import { runGrading } from "@/server/grading";
import { errorResponse } from "@/server/errors";
import { rateLimit } from "@/server/guards";

/** Student-triggered grading: idempotent, one run per session (coaches re-run via /api/coach). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req, "grade");
    const { id } = await params;
    const run = await runGrading(id, "student_submit");
    return Response.json({ runId: run.id });
  } catch (e) {
    return errorResponse(e);
  }
}
