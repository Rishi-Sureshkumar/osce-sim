"use client";
import { useEffect, useRef, useState } from "react";
import type { Region } from "@/domain/schemas";
import { PushToTalk, WebSpeechProvider, type PushToTalkState } from "@/input/adapters/voice";
import { Dialog } from "@/components/ui/Overlay";

/**
 * Verbal-only exams (the standardized patient stays masked: mouth and nose). The student describes
 * the maneuver and what they are looking for, by voice or typing. Becomes a `describe_exam` Action.
 */
export function DescribeDialog({ region, onSubmit, onClose }: { region: Region; onSubmit: (text: string, source: "text" | "voice") => Promise<void>; onClose: () => void }) {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState<PushToTalkState>({ listening: false, interim: "", error: null });
  const [fromVoice, setFromVoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const ptt = useRef<PushToTalk | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ptt.current = new PushToTalk(new WebSpeechProvider(), setVoice, (t) => {
      setText((x) => (x ? `${x} ${t}` : t));
      setFromVoice(true);
    });
  }, []);
  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onSubmit(text.trim(), fromVoice ? "voice" : "text");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog id="describe" kind="modal" title={`${region.label}: verbal exam`} onClose={onClose} initialFocus={area} className="w-full max-w-lg space-y-3 rounded-lg bg-white p-5 shadow-xl">
        <p className="text-sm text-slate-600">The patient stays masked. Describe the maneuver and what you are looking for. Be specific.</p>
        <label className="block text-sm">
          <span className="sr-only">Your description</span>
          <textarea
            ref={area}
            value={voice.listening && voice.interim ? `${text} ${voice.interim}` : text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={2000}
            className="input"
            aria-label="Describe the exam"
          />
        </label>
        {voice.error && <p className="text-xs text-red-700">{voice.error}</p>}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={!ptt.current?.supported}
            onPointerDown={() => ptt.current?.press()}
            onPointerUp={() => ptt.current?.release()}
            onPointerLeave={() => ptt.current?.release()}
            className="btn btn-secondary"
          >
            {voice.listening ? "Listening… release to stop" : "Hold to talk"}
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm">
              Cancel
            </button>
            <button type="button" disabled={busy || !text.trim()} onClick={() => void submit()} className="btn btn-primary">
              Done
            </button>
          </div>
        </div>
    </Dialog>
  );
}
