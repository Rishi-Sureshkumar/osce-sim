import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AppHeader } from "@/components/common/AppHeader";
import { themeScript } from "@/components/ui/ThemeToggle";
import { CommandPalette } from "@/components/common/CommandPalette";
import { getContent } from "@/content/load";

export const metadata: Metadata = {
  title: "OSCE Simulator",
  description: "Practise history taking, physical examination and clinical reasoning with feedback.",
  // inline so the icon never goes through the access-code middleware
  icons: { icon: "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20width%3D%2232%22%20height%3D%2232%22%20rx%3D%228%22%20fill%3D%22%231b43a3%22/%3E%3Cpath%20d%3D%22M6%2017h5l2.2-5%203.6%209%202.4-6.5%201.4%202.5H26%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-width%3D%222.4%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <AppHeader />
        <CommandPalette stations={getContent().cases.map((c) => ({ id: c.id, title: c.title, mode: c.mode }))} />
        {children}
      </body>
    </html>
  );
}
