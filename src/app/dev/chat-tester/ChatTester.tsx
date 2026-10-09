"use client";
import { useState } from "react";

interface Result {
  normalized: string;
  clauses: { text: string; target: string | null; score: number; via: string; top: { id: string; score: number; cosine: number | null }[] }[];
  reply: string;
  embedding: string;
  thresholds: { accept: number; margin: number };
}

export function ChatTester({ cases }: { cases: { id: string; title: string }[] }) {
  const [caseId, setCaseId] = useState(cases[0]?.id ?? "");
  const [text, setText] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setError(null);
    const r = await fetch("/api/coach/dev/match", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseId, text }) });
    const body = await r.json();
    if (!r.ok) return setError(body.error ?? `Failed (${r.status})`);
    setRes(body as Result);
  };
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6 text-sm">
      <h1 className="text-xl font-semibold">Chat tester</h1>
      <p className="text-ink-3">How the deterministic patient understands a line. Replies are fixed case text; nothing is generated.</p>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Case" value={caseId} onChange={(e) => setCaseId(e.target.value)} className="rounded border border-line-strong px-2 py-1">
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <input aria-label="Student line" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void run()} placeholder="Do you get short of breath lying flat?" className="min-w-80 flex-1 rounded border border-line-strong px-2 py-1" />
        <button type="button" onClick={() => void run()} className="rounded bg-ink px-3 py-1 text-white">
          Match
        </button>
      </div>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {res && (
        <div className="space-y-3" data-testid="chat-tester-result">
          <p>
            <b>Normalised:</b> <code>{res.normalized}</code> · embeddings: {res.embedding} · accept ≥ {res.thresholds.accept} with margin ≥ {res.thresholds.margin}
          </p>
          {res.clauses.map((c, i) => (
            <div key={i} className="rounded border border-line p-3">
              <p>
                <b>Clause {i + 1}:</b> <code>{c.text}</code> → <b>{c.target ?? "no match"}</b> ({c.via}, {c.score.toFixed(3)})
              </p>
              <table className="mt-2 w-full text-xs">
                <thead>
                  <tr className="text-left text-ink-3">
                    <th>target</th>
                    <th>score</th>
                    <th>cosine</th>
                  </tr>
                </thead>
                <tbody>
                  {c.top.map((t) => (
                    <tr key={t.id}>
                      <td className="font-mono">{t.id}</td>
                      <td>{t.score.toFixed(3)}</td>
                      <td>{t.cosine === null ? "—" : t.cosine.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <p className="rounded bg-subtle p-3">
            <b>Patient:</b> {res.reply}
          </p>
        </div>
      )}
    </main>
  );
}
