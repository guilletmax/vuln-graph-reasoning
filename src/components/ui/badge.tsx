import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "warning" | "danger";
};

const toneClasses: Record<Required<BadgeProps>["tone"], string> = {
  neutral: "bg-slate-800 text-slate-200 border-slate-700",
  success: "bg-emerald-900/60 text-emerald-200 border-emerald-700",
  warning: "bg-amber-900/60 text-amber-200 border-amber-700",
  danger: "bg-rose-900/60 text-rose-200 border-rose-700",
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
