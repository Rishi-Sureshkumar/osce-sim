import { GateForm } from "./GateForm";

export default async function GatePage({ searchParams }: { searchParams: Promise<{ next?: string; coach?: string }> }) {
  const { next, coach } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return (
    <main className="mx-auto mt-16 max-w-sm p-6">
      <h1 className="text-xl font-semibold">OSCE Simulator</h1>
      <p className="mt-1 text-sm text-ink-3">{coach ? "This page needs the coach access code." : "Enter the access code you were given."}</p>
      <GateForm next={safeNext} />
    </main>
  );
}
