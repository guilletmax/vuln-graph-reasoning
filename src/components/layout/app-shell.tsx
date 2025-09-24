import type { PropsWithChildren } from "react";
import { FooterStatus } from "./footer-status";
import { Header } from "./header";
import { SidebarNav } from "./sidebar-nav";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <SidebarNav />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto bg-slate-900/50 px-6 pb-16 pt-6">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
            {children}
          </div>
        </main>
        <FooterStatus />
      </div>
    </div>
  );
}
