import type { ActionInput } from "@/domain/schemas";

/**
 * Speech-to-text behind an interface, so a server-side provider can replace the browser's Web
 * Speech API later without touching the UI. No audio is stored anywhere: only the final
 * transcript becomes a `say` Action (source: "voice"), exactly like typed text.
 */
export interface SttHandlers {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}

export interface SttProvider {
  readonly supported: boolean;
  start(h: SttHandlers): void;
  stop(): void;
}

/** A transcript from the mic becomes the same `say` Action as typing, tagged as voice. */
export function sayFromVoice(text: string): Extract<ActionInput, { type: "say" }> {
  return { type: "say", source: "voice", payload: { text: text.trim() } };
}

// ---- Web Speech API (Chrome, Edge, Safari; not Firefox) -------------------

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export class WebSpeechProvider implements SttProvider {
  private rec: SpeechRecognitionLike | null = null;
  get supported() {
    return recognitionCtor() !== null;
  }
  start(h: SttHandlers) {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      h.onError("Voice input isn't supported in this browser.");
      h.onEnd();
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        if (r.isFinal) h.onFinal(r[0].transcript);
        else interim += r[0].transcript;
      }
      h.onInterim(interim);
    };
    rec.onerror = (e) => h.onError(e.error === "not-allowed" ? "Microphone access was blocked." : `Speech recognition error: ${e.error}`);
    rec.onend = () => h.onEnd();
    this.rec = rec;
    rec.start();
  }
  stop() {
    this.rec?.stop();
    this.rec = null;
  }
}

// ---- Push-to-talk controller (pure; unit-tested with a fake provider) ------

export interface PushToTalkState {
  listening: boolean;
  /** live, not-yet-final words */
  interim: string;
  error: string | null;
}

/**
 * Hold to talk: press() starts recognition, release() stops it; when the provider finishes,
 * `onTranscript` receives the whole final text (finals joined), ready for the chat input.
 */
export class PushToTalk {
  private finals: string[] = [];
  private stopping = false;
  state: PushToTalkState = { listening: false, interim: "", error: null };

  constructor(
    private provider: SttProvider,
    private onChange: (s: PushToTalkState) => void,
    private onTranscript: (text: string) => void,
  ) {}

  get supported() {
    return this.provider.supported;
  }

  press() {
    if (this.state.listening) return;
    this.finals = [];
    this.stopping = false;
    this.set({ listening: true, interim: "", error: null });
    this.provider.start({
      onInterim: (t) => this.set({ interim: t }),
      onFinal: (t) => this.finals.push(t.trim()),
      onError: (m) => this.set({ error: m }),
      onEnd: () => this.finish(),
    });
  }

  release() {
    if (!this.state.listening || this.stopping) return;
    this.stopping = true;
    this.provider.stop();
  }

  private finish() {
    // include any words still interim when the user let go
    const text = [...this.finals, this.state.interim.trim()].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    this.set({ listening: false, interim: "" });
    if (text) this.onTranscript(text);
  }

  private set(patch: Partial<PushToTalkState>) {
    this.state = { ...this.state, ...patch };
    this.onChange(this.state);
  }
}
