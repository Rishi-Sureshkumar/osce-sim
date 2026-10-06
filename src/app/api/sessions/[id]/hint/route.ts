import { giveHint } from "@/server/practice";
import { errorResponse } from "@/server/errors";
import { rateLimit } from "@/server/guards";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req);
    const { id } = await params;
    return Response.json({ action: await giveHint(id) });
  } catch (e) {
    return errorResponse(e);
  }
}
