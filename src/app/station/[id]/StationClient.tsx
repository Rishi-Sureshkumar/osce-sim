"use client";
import { Station, type StationProps } from "@/components/station/Station";

export function StationClient(props: Omit<StationProps, "chat" | "finish">) {
  return <Station {...props} />;
}
