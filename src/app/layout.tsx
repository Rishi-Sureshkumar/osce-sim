import type { Metadata } from "next";
import "./globals.css";
import { SafetyBanner } from "@/components/common/SafetyBanner";

export const metadata: Metadata = {
  title: "OSCE Simulator",
  description: "Practise history taking, physical examination and clinical reasoning with feedback.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <SafetyBanner />
        {children}
      </body>
    </html>
  );
}
