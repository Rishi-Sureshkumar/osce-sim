/**
 * Advisory second opinion for coaches on needs-review items (Phase 4 M1, optional WebLLM, runs in
 * the coach's browser). It never changes a score: it returns "likely credit" / "likely no credit"
 * with the sentence it relied on, which must be one of the candidate sentences verbatim.
 */
import type { ChatEngine } from "./engine";

export interface SecondOpinion {
  verdict: "likely_credit" | "likely_no_credit" | "unsure";
  quote: string | null;
  note: string;
}

const SYSTEM = `You help an OSCE examiner. Given an ITEM (what earns credit) and numbered STUDENT LINES, answer on one line:
CREDIT <line number> | NO CREDIT | UNSURE
then a short reason. Only use the lines given.`;

export async function secondOpinion(engine: ChatEngine | null, item: { label: string; guidance?: string }, lines: string[], timeoutMs = 8000): Promise<SecondOpinion> {
  if (!engine || !lines.length) return { verdict: "unsure", quote: null, note: "No second opinion available." };
  const user = `ITEM: ${item.label}${item.guidance ? ` — ${item.guidance}` : ""}\nSTUDENT LINES:\n${lines.map((l, i) => `${i + 1}. ${l}`).join("\n")}`;
  let handle: ReturnType<typeof setTimeout> | undefined;
  const ctrl = new AbortController();
  try {
    const out = await Promise.race([
      engine.complete(SYSTEM, user, { maxTokens: 80, signal: ctrl.signal }),
      new Promise<never>((_, r) => {
        handle = setTimeout(() => {
          ctrl.abort();
          r(new Error("timeout"));
        }, timeoutMs);
      }),
    ]);
    const m = out.match(/^\s*(CREDIT\s+(\d+)|NO CREDIT|UNSURE)\b\s*[|:-]?\s*(.*)$/im);
    if (!m) return { verdict: "unsure", quote: null, note: "The model's answer couldn't be read." };
    if (m[2]) {
      const quote = lines[Number(m[2]) - 1] ?? null;
      return quote ? { verdict: "likely_credit", quote, note: m[3]?.trim() || "" } : { verdict: "unsure", quote: null, note: "The model cited a line that doesn't exist." };
    }
    return { verdict: /NO CREDIT/i.test(m[1]!) ? "likely_no_credit" : "unsure", quote: null, note: m[3]?.trim() || "" };
  } catch (e) {
    return { verdict: "unsure", quote: null, note: `No second opinion (${(e as Error).message}).` };
  } finally {
    clearTimeout(handle);
  }
}
