import { notFound } from "next/navigation";
import { getPublicCatalog } from "@/content/load";
import { getStudentView } from "@/server/session";
import { HttpError } from "@/server/errors";
import { StationClient } from "./StationClient";

export const dynamic = "force-dynamic";

export default async function StationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const view = await getStudentView(id);
    return <StationClient session={view.session} kase={view.kase} catalog={getPublicCatalog()} initialActions={view.actions} qa={process.env.QA_HOOKS === "true"} />;
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
}
