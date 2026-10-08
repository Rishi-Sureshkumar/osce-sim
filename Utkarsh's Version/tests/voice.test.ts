import { describe, expect, it } from "vitest";
import { ActionInput } from "@/domain/schemas";
import { PushToTalk, sayFromVoice, type SttHandlers, type SttProvider } from "@/input/adapters/voice";

class FakeProvider implements SttProvider {
  supported = true;
  h: SttHandlers | null = null;
  start(h: SttHandlers) {
    this.h = h;
  }
  stop() {
    queueMicrotask(() => this.h?.onEnd());
  }
}

describe("voice adapter", () => {
  it("emits the same say Action as typing, tagged as voice", () => {
    const a = sayFromVoice("  Hello Mr. Bennett  ");
    expect(ActionInput.parse(a)).toEqual({ type: "say", source: "voice", payload: { text: "Hello Mr. Bennett" } });
  });

  it("push-to-talk: live interim text, final transcript on release", async () => {
    const p = new FakeProvider();
    const states: string[] = [];
    let transcript = "";
    const ptt = new PushToTalk(p, (s) => states.push(`${s.listening}:${s.interim}`), (t) => (transcript = t));
    ptt.press();
    p.h!.onInterim("hello mis");
    p.h!.onFinal("Hello Mr. Bennett,");
    p.h!.onInterim("my name is");
    expect(ptt.state).toMatchObject({ listening: true, interim: "my name is" });
    ptt.release();
    await new Promise((r) => setTimeout(r, 0));
    expect(transcript).toBe("Hello Mr. Bennett, my name is");
    expect(ptt.state.listening).toBe(false);
    expect(states).toContain("true:hello mis");
  });

  it("does nothing when nothing was said, and reports provider errors", async () => {
    const p = new FakeProvider();
    let transcript: string | null = null;
    const ptt = new PushToTalk(p, () => undefined, (t) => (transcript = t));
    ptt.press();
    p.h!.onError("Microphone access was blocked.");
    ptt.release();
    await new Promise((r) => setTimeout(r, 0));
    expect(transcript).toBeNull();
    expect(ptt.state.error).toBe("Microphone access was blocked.");
  });

  it("ignores double press and release while stopping", async () => {
    const p = new FakeProvider();
    let calls = 0;
    const ptt = new PushToTalk(p, () => undefined, () => calls++);
    ptt.press();
    ptt.press();
    p.h!.onFinal("Any chest pain?");
    ptt.release();
    ptt.release();
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toBe(1);
  });
});
