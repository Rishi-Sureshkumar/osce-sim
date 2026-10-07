"use client";
import { useEffect, useRef, useState } from "react";
import type { Action } from "@/domain/schemas";
import { sendChat } from "@/input/chatClient";
import { embedderState, warmUp } from "@/lang/embed/browser";
import { useEnhancedPatient } from "./useEnhancedPatient";
import { PushToTalk, WebSpeechProvider, type PushToTalkState } from "@/input/adapters/voice";

const PREFS = "osce.voicePrefs";

/** Conversation with the patient. Shows say/patient_say from the shared log plus the streaming reply. */
export function ChatPanel({
  sessionId,
  patientName,
  actions,
  append,
  disabled,
  onSpeaking,
}: {
  sessionId: string;
  patientName: string;
  actions: Action[];
  append: (a: Action) => void;
  disabled: boolean;
  /** the patient's reply is streaming (the 3D patient turns toward the student) */
  onSpeaking?: (speaking: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const speakingRef = useRef(onSpeaking);
  speakingRef.current = onSpeaking;
  // in-browser embeddings: loaded on first focus of the chat box or when the student is idle (never before the page has settled)
  const [embedder, setEmbedder] = useState(embedderState());
  const warm = () => {
    setEmbedder(embedderState() === "idle" ? "loading" : embedderState());
    void warmUp().then(() => setEmbedder(embedderState()));
  };
  useEffect(() => {
    const id = window.setTimeout(() => {
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
      if (ric) ric(warm);
      else warm();
    }, 8000);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    speakingRef.current?.(streaming !== null && streaming.length > 0);
  }, [streaming]);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // the current draft came from speech (kept if the student edits it before sending)
  const [fromVoice, setFromVoice] = useState(false);
  const [voice, setVoice] = useState<PushToTalkState>({ listening: false, interim: "", error: null });
  const [supported, setSupported] = useState(true);
  const [autoSend, setAutoSend] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
  const enhanced = useEnhancedPatient();
  const ptt = useRef<PushToTalk | null>(null);
  const sendRef = useRef<(msg: string, source: "text" | "voice") => Promise<void>>(async () => undefined);
  const prefsRef = useRef({ autoSend, speakReplies });
  prefsRef.current = { autoSend, speakReplies };

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS) ?? "null") as { autoSend: boolean; speakReplies: boolean } | null;
      if (p) {
        setAutoSend(p.autoSend);
        setSpeakReplies(p.speakReplies);
      }
    } catch {
      /* defaults */
    }
    const instance = new PushToTalk(new WebSpeechProvider(), setVoice, (t) => {
      if (prefsRef.current.autoSend) void sendRef.current(t, "voice");
      else {
        setText((cur) => (cur.trim() ? `${cur.trim()} ${t}` : t));
        setFromVoice(true);
        inputRef.current?.focus();
      }
    });
    ptt.current = instance;
    setSupported(instance.supported);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(PREFS, JSON.stringify({ autoSend, speakReplies }));
    } catch {
      /* ignore */
    }
  }, [autoSend, speakReplies]);

  // hold Space to talk when focus isn't in a text field
  useEffect(() => {
    const typing = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName));
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || disabled || typing(e.target) || !ptt.current?.supported) return;
      e.preventDefault();
      ptt.current.press();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !ptt.current?.state.listening) return;
      e.preventDefault();
      ptt.current.release();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [disabled]);
  const turns = actions.filter((a) => a.type === "say" || a.type === "patient_say");

  // block body: an effect must return nothing or a cleanup function (some hosts return a value from scrollIntoView)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns.length, streaming]);

  const send = async (msg: string, source: "text" | "voice") => {
    if (!msg || streaming !== null) return;
    setText("");
    setFromVoice(false);
    setError(null);
    setStreaming("");
    try {
      await sendChat(
        sessionId,
        msg,
        {
          onStudent: append,
          onDelta: (d) => setStreaming((s) => (s ?? "") + d),
          onPatient: (a) => {
            append(a);
            setStreaming(null);
            if (a.type !== "patient_say") return;
            // optional display-only rewording; the log keeps the original
            void enhanced.reword(a.id, a.payload.text).then((spoken) => {
              if (prefsRef.current.speakReplies && typeof window !== "undefined" && "speechSynthesis" in window) {
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(new SpeechSynthesisUtterance(spoken));
              }
            });
          },
        },
        source,
      );
    } catch (err) {
      setError((err as Error).message);
      setText(msg);
    } finally {
      setStreaming(null);
    }
  };
  sendRef.current = send;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await send(text.trim(), fromVoice ? "voice" : "text");
  };

  return (
    <section aria-labelledby="chat-h" className="flex min-h-[320px] flex-1 flex-col rounded-lg border border-slate-200 bg-white" data-embedder={embedder}>
      <h2 id="chat-h" className="border-b border-slate-200 px-3 py-2 text-sm font-semibold">
        Conversation with {patientName}
      </h2>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" data-testid="chat-log">
        {turns.length === 0 && streaming === null && (
          <p className="text-sm text-slate-500">Greet the patient and introduce yourself to begin. Everything you type is part of the transcript that is graded.</p>
        )}
        {turns.map((a) =>
          a.type === "say" ? (
            <Bubble key={a.id} who={a.source === "voice" ? "You (voice)" : "You"} text={a.payload.text} mine />
          ) : a.type === "patient_say" ? (
            <Bubble key={a.id} who={patientName} text={enhanced.reworded[a.id] ?? a.payload.text} original={enhanced.reworded[a.id] ? a.payload.text : undefined} />
          ) : null,
        )}
        {streaming !== null && <Bubble who={patientName} text={streaming || "…"} streaming />}
        <div ref={endRef} />
      </div>
      {error && (
        <p role="alert" className="px-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {(voice.listening || voice.error || !supported) && (
        <p className={`px-3 pt-1 text-xs ${voice.error || !supported ? "text-amber-800" : "text-cyan-800"}`} aria-live="polite" data-testid="voice-status">
          {!supported
            ? "Voice input isn't available in this browser (try Chrome, Edge or Safari). Type instead."
            : voice.error
              ? voice.error
              : `Listening… ${voice.interim}`}
        </p>
      )}
      <form onSubmit={submit} className="flex gap-2 border-t border-slate-200 p-2">
        <button
          type="button"
          disabled={disabled || !supported || streaming !== null}
          aria-pressed={voice.listening}
          aria-label="Hold to talk"
          title="Hold to talk (or hold Space)"
          onPointerDown={(e) => {
            e.preventDefault();
            ptt.current?.press();
          }}
          onPointerUp={() => ptt.current?.release()}
          onPointerLeave={() => ptt.current?.release()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
              e.preventDefault();
              ptt.current?.press();
            }
          }}
          onKeyUp={(e) => {
            if (e.key === "Enter" || e.key === " ") ptt.current?.release();
          }}
          className={`rounded-md px-3 py-2 text-sm font-medium ${voice.listening ? "bg-red-600 text-white" : "border border-slate-300 bg-white text-slate-700"} disabled:opacity-50`}
        >
          {voice.listening ? "● Rec" : "Hold to talk"}
        </button>
        <label htmlFor="chat-input" className="sr-only">
          Message to patient
        </label>
        <input
          id="chat-input"
          ref={inputRef}
          onFocus={warm}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (!e.target.value) setFromVoice(false);
          }}
          disabled={disabled}
          maxLength={2000}
          autoComplete="off"
          placeholder={disabled ? "Station finished" : "Ask the patient…"}
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="submit" disabled={disabled || streaming !== null || !text.trim()} className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          Send
        </button>
      </form>
      <div className="flex flex-wrap gap-4 px-3 pb-2 text-xs text-slate-600">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} disabled={!supported} />
          Send speech automatically
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={speakReplies} onChange={(e) => setSpeakReplies(e.target.checked)} />
          Patient speaks replies aloud
        </label>
        {enhanced.available && (
          <label className="flex items-center gap-1.5" title="Rewords the patient's replies in your browser for more natural speech. The facts, and what is graded, never change.">
            <input type="checkbox" checked={enhanced.state.status !== "off" && enhanced.state.status !== "error"} onChange={(e) => (e.target.checked ? enhanced.request() : enhanced.turnOff())} />
            Enhanced patient (beta)
          </label>
        )}
      </div>
      {enhanced.state.status === "confirm" && (
        <div className="mx-3 mb-2 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700" data-testid="enhanced-confirm">
          <span>Downloads a {enhanced.sizeMB} MB language model once, into this browser. Continue?</span>
          <button type="button" className="rounded bg-cyan-700 px-2 py-0.5 font-medium text-white" onClick={() => void enhanced.load()}>
            Download
          </button>
          <button type="button" className="rounded border border-slate-300 px-2 py-0.5" onClick={enhanced.turnOff}>
            Not now
          </button>
        </div>
      )}
      {enhanced.state.status === "loading" && (
        <p className="px-3 pb-2 text-xs text-slate-600" aria-live="polite">
          Loading the enhanced patient… {Math.round(enhanced.state.progress * 100)}%
        </p>
      )}
      {enhanced.state.status === "error" && (
        <p className="px-3 pb-2 text-xs text-amber-800" role="status">
          {enhanced.state.message}
        </p>
      )}
    </section>
  );
}

function Bubble({ who, text, mine, streaming, original }: { who: string; text: string; mine?: boolean; streaming?: boolean; original?: string }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`} data-streaming={streaming || undefined} aria-busy={streaming || undefined}>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-cyan-700 text-white" : "bg-slate-100"}`}>
        <span className={`block text-[10px] font-semibold uppercase ${mine ? "text-cyan-100" : "text-slate-500"}`}>
          {who}
          {original && (
            <span className="ml-1 font-normal normal-case text-slate-400" title={`Reworded in your browser. Original: ${original}`} data-testid="reworded">
              · reworded
            </span>
          )}
        </span>
        {text}
      </div>
    </div>
  );
}
