"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { NAV_ITEMS } from "./nav-data";

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 flex-col border-r border-slate-800 bg-slate-950/80 p-4 lg:flex">
      <div className="flex items-center gap-2 px-2 pb-6">
        <span className="text-xl">🛡️</span>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            MindFort
          </p>
          <p className="text-xs text-slate-500">Vuln Graph Reasoning</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group rounded-lg px-3 py-2 transition-colors",
                isActive ? "bg-slate-800/80" : "hover:bg-slate-800/40",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg" aria-hidden>
                  {item.icon}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-100">
                    {item.label}
                  </span>
                  {item.description && (
                    <span className="text-xs text-slate-400">
                      {item.description}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </nav>
      <p className="mt-auto px-2 pt-6 text-xs text-slate-500">
        Built for analysts to explore, reason, and brief with confidence.
      </p>
    </aside>
  );
}
