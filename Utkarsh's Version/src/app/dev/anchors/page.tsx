import { notFound } from "next/navigation";
import { AnchorDebug } from "./AnchorDebug";

/** Calibration overlay for the hidden exam anchors. Development only. */
export default function DevAnchorsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AnchorDebug />;
}
