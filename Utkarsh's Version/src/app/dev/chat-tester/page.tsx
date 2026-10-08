import { notFound } from "next/navigation";
import { getContent } from "@/content/load";
import { ChatTester } from "./ChatTester";

/** How the deterministic patient understands a line (coaches; development or QA only). */
export default function ChatTesterPage() {
  if (process.env.NODE_ENV === "production" && process.env.QA_HOOKS !== "true") notFound();
  const cases = getContent().cases.map((c) => ({ id: c.id, title: c.title }));
  return <ChatTester cases={cases} />;
}
