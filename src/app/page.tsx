import Link from "next/link";
import { getContent, toPublicCase } from "@/content/load";
import { CasePicker } from "@/components/home/CasePicker";

export const dynamic = "force-dynamic";

export default function Home() {
  const cases = getContent().cases.map(toPublicCase);
  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">OSCE Simulator</h1>
      <p className="mt-1 text-ink-3">
        Practise a station: take a history, examine the patient, present your differential, and get feedback against the mark sheet.
      </p>
      <CasePicker cases={cases} />
      <p className="mt-8 text-sm text-ink-3">
        Coach? Open the <Link href="/coach" className="text-brand underline">coach view</Link> (needs the coach code).
      </p>
    </main>
  );
}
