import { z } from "zod";
import { startChatTurn } from "@/server/chat";
import { errorResponse, HttpError } from "@/server/errors";
import { rateLimit } from "@/server/guards";

const Body = z.object({ text: z.string().min(1).max(2000), source: z.enum(["text", "voice"]).default("text") });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req, "chat");
    const { id } = await params;
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "Message must be 1–2000 characters");
    const stream = await startChatTurn(id, body.data.text, body.data.source);
    return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
