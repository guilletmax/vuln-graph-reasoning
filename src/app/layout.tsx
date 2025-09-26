import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/layout/app-providers";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "MindFort | Vulnerability Graph Reasoning",
  description:
    "Investigation workspace for ingesting findings, exploring the graph, and orchestrating remediation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="font-sans antialiased"
      >
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
