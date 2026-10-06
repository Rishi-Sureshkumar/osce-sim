import { addOverride } from "@/server/coach";
import { errorResponse } from "@/server/errors";
import { rateLimit } from "@/server/guards";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req);
    const { id } = await params;
    const override = await addOverride(id, await req.json().catch(() => null));
    return Response.json({ override });
  } catch (e) {
    return errorResponse(e);
  }
}
