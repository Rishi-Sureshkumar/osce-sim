"use client";
import { useEffect, useRef, useState } from "react";
import type { Action } from "@/domain/schemas";
import { sendChat } from "@/input/chatClient";

/** Conversation with the patient. Shows say/patient_say from the shared log plus the streaming reply. */
export function ChatPanel({
  sessionId,
  patientName,
  actions,
  append,
  disabled,
}: {
  sessionId: string;
  patientName: string;
  actions: Action[];
  append: (a: Action) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const turns = actions.filter((a) => a.type === "say" || a.type === "patient_say");

  useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [turns.length, streaming]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = text.trim();
    if (!msg || streaming !== null) return;
    setText("");
    setError(null);
    setStreaming("");
    try {
      await sendChat(sessionId, msg, {
        onStudent: append,
        onDelta: (d) => setStreaming((s) => (s ?? "") + d),
        onPatient: (a) => {
          append(a);
          setStreaming(null);
        },
      });
    } catch (err) {
      setError((err as Error).message);
      setText(msg);
    } finally {
      setStreaming(null);
    }
  };

  return (
    <section aria-labelledby="chat-h" className="flex min-h-[320px] flex-1 flex-col rounded-lg border border-slate-200 bg-white">
      <h2 id="chat-h" className="border-b border-slate-200 px-3 py-2 text-sm font-semibold">
        Conversation with {patientName}
      </h2>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" data-testid="chat-log">
        {turns.length === 0 && streaming === null && (
          <p className="text-sm text-slate-500">Greet the patient and introduce yourself to begin. Everything you type is part of the transcript that is graded.</p>
        )}
        {turns.map((a) =>
          a.type === "say" ? (
            <Bubble key={a.id} who="You" text={a.payload.text} mine />
          ) : a.type === "patient_say" ? (
            <Bubble key={a.id} who={patientName} text={a.payload.text} />
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
      <form onSubmit={submit} className="flex gap-2 border-t border-slate-200 p-2">
        <label htmlFor="chat-input" className="sr-only">
          Message to patient
        </label>
        <input
          id="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
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
    </section>
  );
}

function Bubble({ who, text, mine, streaming }: { who: string; text: string; mine?: boolean; streaming?: boolean }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`} data-streaming={streaming || undefined} aria-busy={streaming || undefined}>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-cyan-700 text-white" : "bg-slate-100"}`}>
        <span className={`block text-[10px] font-semibold uppercase ${mine ? "text-cyan-100" : "text-slate-500"}`}>{who}</span>
        {text}
      </div>
    </div>
  );
}
