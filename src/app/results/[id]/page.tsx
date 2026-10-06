import Link from "next/link";
import { getStudentView } from "@/server/session";

export const dynamic = "force-dynamic";

/** Placeholder until scoring lands (M3). */
export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, kase } = await getStudentView(id);
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold">{kase.title}</h1>
      <p className="mt-2">Station {session.status === "active" ? "in progress" : "submitted"}. Scoring arrives in M3.</p>
      <Link href="/" className="mt-4 inline-block text-cyan-700 underline">
        Back to cases
      </Link>
    </main>
  );
}
