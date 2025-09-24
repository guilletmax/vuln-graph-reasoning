"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";

const STATUS_ITEMS = [
  { label: "Graph", status: "Healthy", tone: "success" },
  { label: "Agents", status: "Idle", tone: "neutral" },
  { label: "Rate Limit", status: "120 remaining", tone: "warning" },
];

type Tone = "neutral" | "success" | "warning" | "danger";

const toneDot: Record<Tone, string> = {
  neutral: "bg-slate-500",
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  danger: "bg-rose-500",
};

export function FooterStatus() {
  const items = useMemo(() => STATUS_ITEMS, []);

  return (
    <footer className="sticky bottom-0 border-t border-slate-800/80 bg-slate-950/80 px-6 py-3 text-xs text-slate-400">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-4">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                toneDot[item.tone as Tone] ?? toneDot.neutral,
              )}
            />
            <span className="font-medium text-slate-300">{item.label}</span>
            <span>{item.status}</span>
          </div>
        ))}
        <div className="ml-auto text-right text-slate-500">
          Demo data • Citations available for every answer
        </div>
      </div>
    </footer>
  );
}
