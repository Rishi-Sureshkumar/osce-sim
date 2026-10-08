import { runGrading } from "@/server/grading";
import { errorResponse } from "@/server/errors";
import { rateLimit } from "@/server/guards";

/** Coach-only re-run of grading. Earlier runs and their overrides are kept. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req, "grade");
    const { id } = await params;
    const run = await runGrading(id, "coach_rerun");
    return Response.json({ runId: run.id });
  } catch (e) {
    return errorResponse(e);
  }
}
